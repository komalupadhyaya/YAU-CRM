import RetellKnowledgeBase from '../models/retellKnowledgeBase.model.js';
import Call from '../models/call.model.js';
import Lead from '../models/lead.model.js';
import Contact from '../models/contact.model.js';
import Note from '../models/note.model.js';
import EALead from '../models/eaLead.model.js';
import { 
    buildPromptFromKnowledgeBase, 
    syncKnowledgeBaseToRetell, 
    getRetellAgentDetails,
    getRetellCallDetails
} from '../services/ai/retell.service.js';

/**
 * Helper to build format-tolerant regex matching 10 digits
 */
function buildPhoneRegex(phoneNumber) {
    if (!phoneNumber) return null;
    const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length < 7) return null;
    // Match digits allowing optional separators between them
    const pattern = cleanPhone.split('').map(d => `${d}[^0-9]*`).join('');
    return new RegExp(pattern);
}

/**
 * Helper to match all leads (Main Leads and EA Leads) by phone number (last 10 digits)
 */
async function findMatchingLeadsByPhone(phoneNumber) {
    if (!phoneNumber) return { mainLeads: [], eaLeads: [] };
    const regex = buildPhoneRegex(phoneNumber);
    if (!regex) return { mainLeads: [], eaLeads: [] };

    // 1. Check Lead collection (telephone, phone, altPhone)
    const directMainLeads = await Lead.find({
        $or: [
            { telephone: { $regex: regex } },
            { phone: { $regex: regex } },
            { altPhone: { $regex: regex } }
        ]
    });

    // 2. Check Contact collection (direct_phone, phone, mobilePhone)
    const contacts = await Contact.find({
        $or: [
            { direct_phone: { $regex: regex } },
            { phone: { $regex: regex } },
            { mobilePhone: { $regex: regex } }
        ],
        lead_id: { $exists: true, $ne: null }
    });

    let contactLinkedLeads = [];
    const contactLeadIds = contacts.map(c => c.lead_id).filter(Boolean);
    if (contactLeadIds.length > 0) {
        contactLinkedLeads = await Lead.find({ _id: { $in: contactLeadIds } });
    }

    // Deduplicate main leads
    const mainLeadMap = new Map();
    [...directMainLeads, ...contactLinkedLeads].forEach(l => {
        if (l && l._id) mainLeadMap.set(l._id.toString(), l);
    });
    const mainLeads = Array.from(mainLeadMap.values());

    // 3. Check EALead collection (phone, parentPhone)
    const eaLeads = await EALead.find({
        $or: [
            { phone: { $regex: regex } },
            { parentPhone: { $regex: regex } }
        ]
    });

    return { mainLeads, eaLeads };
}

/**
 * Helper to persist Note for call activity timeline
 */
async function syncCallNote(leadId, callId, callData, aiSummary) {
    if (!leadId || !aiSummary) return;
    try {
        const noteExists = await Note.findOne({
            lead_id: leadId,
            $or: [
                { 'metadata.retellCallId': callId },
                { 'metadata.callSid': `retell_${callId}` }
            ]
        });

        const content = `🤖 RETELL AI CALL SUMMARY:\n${aiSummary}\n\nOutcome: ${callData.status || 'completed'}`;
        if (!noteExists) {
            await Note.create({
                lead_id: leadId,
                content,
                type: 'call',
                metadata: {
                    callSid: `retell_${callId}`,
                    retellCallId: callId,
                    source: 'retell',
                    outcome: callData.status || 'completed',
                    recording_url: callData.recordingUrl || null,
                    recording_duration: callData.duration || 0,
                    aiSummary
                }
            });
            console.log(`📝 [Retell Webhook] Created activity Note for lead ${leadId}`);
        } else {
            noteExists.content = content;
            noteExists.metadata = {
                ...noteExists.metadata,
                aiSummary,
                recording_url: callData.recordingUrl || noteExists.metadata?.recording_url,
                recording_duration: callData.duration || noteExists.metadata?.recording_duration
            };
            noteExists.markModified('metadata');
            await noteExists.save();
            console.log(`📝 [Retell Webhook] Updated activity Note for lead ${leadId}`);
        }
    } catch (noteErr) {
        console.warn('⚠️ Could not persist Call Note:', noteErr.message);
    }
}

/**
 * Helper to process and persist call data into Call, Lead, and EALead
 */
async function processRetellCallData(callData, payload) {
    const callId = callData.call_id || payload?.call_id;
    if (!callId) return null;

    const callerNumber = callData.from_number || callData.caller_number || payload?.from_number || 'Unknown';
    const toNumber = callData.to_number || payload?.to_number || process.env.TWILIO_PHONE_NUMBER || '+18886879139';
    const direction = (callData.direction || payload?.direction) === 'outbound' ? 'outbound' : 'inbound';
    const targetLeadNumber = direction === 'outbound' ? toNumber : callerNumber;

    let durationSeconds = 0;
    if (callData.duration_ms) {
        durationSeconds = Math.round(callData.duration_ms / 1000);
    } else if (callData.start_timestamp && callData.end_timestamp) {
        durationSeconds = Math.round((callData.end_timestamp - callData.start_timestamp) / 1000);
    }

    const recordingUrl = callData.recording_url || payload?.recording_url || null;
    const transcript = callData.transcript || payload?.transcript || callData.transcript_object?.map(t => `${t.role}: ${t.content}`).join('\n') || null;
    
    // Exhaustive AI Summary and Sentiment extraction across all Retell payload structures
    const aiSummary = 
        callData.call_analysis?.call_summary ||
        payload?.call_analysis?.call_summary ||
        callData.summary ||
        payload?.summary ||
        callData.call_analysis?.custom_analysis_data?.call_summary ||
        payload?.call_analysis?.custom_analysis_data?.call_summary ||
        null;

    const callerSentiment = 
        callData.call_analysis?.user_sentiment ||
        payload?.call_analysis?.user_sentiment ||
        callData.sentiment ||
        payload?.sentiment ||
        null;

    const disconnectionReason = callData.disconnection_reason || payload?.disconnection_reason || callData.status || payload?.status || 'completed';

    // 1. Resolve matching leads using multiple strategies
    let existingCall = await Call.findOne({ retellCallId: callId });
    const { mainLeads: phoneMainLeads, eaLeads: phoneEALeads } = await findMatchingLeadsByPhone(targetLeadNumber);

    const directMainLeadsByCall = await Lead.find({
        $or: [
            { 'callHistory.callSid': `retell_${callId}` },
            { 'callHistory.retellCallId': callId },
            ...(existingCall ? [{ calls: existingCall._id }] : [])
        ]
    });

    const directEALeadsByCall = await EALead.find({
        $or: [
            { 'callHistory.callSid': `retell_${callId}` },
            { 'callHistory.retellCallId': callId },
            ...(existingCall ? [{ calls: existingCall._id }] : [])
        ]
    });

    let directMainLeadById = [];
    if (existingCall?.lead_id) {
        const l = await Lead.findById(existingCall.lead_id);
        if (l) directMainLeadById.push(l);
    }

    let directEALeadById = [];
    if (existingCall?.ea_lead_id) {
        const el = await EALead.findById(existingCall.ea_lead_id);
        if (el) directEALeadById.push(el);
    }

    // Combine and deduplicate
    const mainLeadMap = new Map();
    [...phoneMainLeads, ...directMainLeadsByCall, ...directMainLeadById].forEach(l => {
        if (l && l._id) mainLeadMap.set(l._id.toString(), l);
    });
    const targetMainLeads = Array.from(mainLeadMap.values());

    const eaLeadMap = new Map();
    [...phoneEALeads, ...directEALeadsByCall, ...directEALeadById].forEach(l => {
        if (l && l._id) eaLeadMap.set(l._id.toString(), l);
    });
    const targetEALeads = Array.from(eaLeadMap.values());

    let associatedMainLeadId = targetMainLeads.length > 0 ? targetMainLeads[0]._id : (existingCall?.lead_id || null);
    let associatedEALeadId = targetEALeads.length > 0 ? targetEALeads[0]._id : (existingCall?.ea_lead_id || null);

    // 2. Create or Update authoritative Call Record in CRM
    let callRecord = existingCall;
    if (!callRecord) {
        callRecord = await Call.create({
            callSid: `retell_${callId}`,
            retellCallId: callId,
            source: 'retell',
            direction,
            fromNumber: callerNumber,
            toNumber,
            duration: durationSeconds,
            recordingUrl,
            status: disconnectionReason,
            timestamp: callData.start_timestamp ? new Date(callData.start_timestamp) : new Date(),
            lead_id: associatedMainLeadId,
            ea_lead_id: associatedEALeadId,
            transcript,
            aiSummary,
            callerSentiment
        });
        console.log(`✅ [Retell Webhook] Created Call record: ${callRecord._id} for ${callerNumber} (Summary: ${aiSummary ? 'YES' : 'Pending'})`);
    } else {
        if (durationSeconds) callRecord.duration = durationSeconds;
        if (recordingUrl) callRecord.recordingUrl = recordingUrl;
        if (disconnectionReason) callRecord.status = disconnectionReason;
        if (transcript) callRecord.transcript = transcript;
        if (aiSummary) callRecord.aiSummary = aiSummary;
        if (callerSentiment) callRecord.callerSentiment = callerSentiment;
        if (associatedMainLeadId && !callRecord.lead_id) callRecord.lead_id = associatedMainLeadId;
        if (associatedEALeadId && !callRecord.ea_lead_id) callRecord.ea_lead_id = associatedEALeadId;
        await callRecord.save();
        console.log(`✅ [Retell Webhook] Updated Call record: ${callRecord._id} (Summary: ${aiSummary ? 'YES' : 'Pending'})`);
    }

    const callRefId = callRecord._id;
    const targetMainLeadIds = targetMainLeads.map(l => l._id);
    const targetEALeadIds = targetEALeads.map(l => l._id);

    // 3. Update Main Leads: Add Call reference ID and atomic callHistory sync
    if (targetMainLeadIds.length > 0) {
        // Atomic Reference Array update
        await Lead.updateMany(
            { _id: { $in: targetMainLeadIds } },
            { $addToSet: { calls: callRefId } }
        );

        // Atomic subdocument update for backward compatibility
        for (const lead of targetMainLeads) {
            if (!lead.callHistory) lead.callHistory = [];
            const existingIdx = lead.callHistory.findIndex(c => c.callSid === `retell_${callId}` || c.retellCallId === callId);
            if (existingIdx >= 0) {
                const existing = lead.callHistory[existingIdx];
                if (durationSeconds) existing.duration = durationSeconds;
                if (recordingUrl) existing.recordingUrl = recordingUrl;
                if (disconnectionReason) existing.status = disconnectionReason;
                if (transcript) existing.transcript = transcript;
                if (aiSummary) existing.aiSummary = aiSummary;
                if (callerSentiment) existing.callerSentiment = callerSentiment;
            } else {
                lead.callHistory.unshift({
                    callSid: `retell_${callId}`,
                    retellCallId: callId,
                    source: 'retell',
                    direction,
                    duration: durationSeconds,
                    recordingUrl,
                    status: disconnectionReason,
                    timestamp: callData.start_timestamp ? new Date(callData.start_timestamp) : new Date(),
                    aiSummary: aiSummary || null,
                    callerSentiment: callerSentiment || null,
                    transcript: transcript || null
                });
            }
            lead.markModified('callHistory');
            await lead.save();
        }

        // Persist Timeline Note
        if (associatedMainLeadId && aiSummary) {
            await syncCallNote(associatedMainLeadId, callId, { status: disconnectionReason, recordingUrl, duration: durationSeconds }, aiSummary);
        }
    }

    // 4. Update EA Leads: Add Call reference ID and atomic callHistory sync
    if (targetEALeadIds.length > 0) {
        // Atomic Reference Array update
        await EALead.updateMany(
            { _id: { $in: targetEALeadIds } },
            { $addToSet: { calls: callRefId } }
        );

        // Atomic subdocument update for backward compatibility
        for (const eaLead of targetEALeads) {
            if (!eaLead.callHistory) eaLead.callHistory = [];
            const existingIdx = eaLead.callHistory.findIndex(c => c.callSid === `retell_${callId}` || c.retellCallId === callId);
            if (existingIdx >= 0) {
                const existing = eaLead.callHistory[existingIdx];
                if (durationSeconds) existing.duration = durationSeconds;
                if (recordingUrl) existing.recordingUrl = recordingUrl;
                if (disconnectionReason) existing.status = disconnectionReason;
                if (transcript) existing.transcript = transcript;
                if (aiSummary) existing.aiSummary = aiSummary;
                if (callerSentiment) existing.callerSentiment = callerSentiment;
            } else {
                eaLead.callHistory.unshift({
                    callSid: `retell_${callId}`,
                    retellCallId: callId,
                    source: 'retell',
                    direction,
                    duration: durationSeconds,
                    recordingUrl,
                    status: disconnectionReason,
                    timestamp: callData.start_timestamp ? new Date(callData.start_timestamp) : new Date(),
                    aiSummary: aiSummary || null,
                    callerSentiment: callerSentiment || null,
                    transcript: transcript || null
                });
            }
            eaLead.markModified('callHistory');
            await eaLead.save();
        }
    }

    // 5. Background Direct API Fallback: If aiSummary is missing after call_ended, fetch via REST API
    if (!aiSummary && (callData.end_timestamp || payload?.event === 'call_ended')) {
        setTimeout(async () => {
            try {
                console.log(`⏳ [Retell Background Fallback] Checking call ${callId} for late-arriving AI summary...`);
                const latestCallData = await getRetellCallDetails(callId);
                if (latestCallData) {
                    const fallbackSummary = 
                        latestCallData.call_analysis?.call_summary ||
                        latestCallData.summary ||
                        latestCallData.call_analysis?.custom_analysis_data?.call_summary;
                    
                    if (fallbackSummary) {
                        console.log(`🎯 [Retell Background Fallback] Successfully fetched AI summary for call ${callId}`);
                        await processRetellCallData(latestCallData, { event: 'call_analyzed' });
                    }
                }
            } catch (fbErr) {
                console.warn(`[Retell Background Fallback] Error checking call ${callId}:`, fbErr.message);
            }
        }, 6000);
    }

    return { callRecord, targetMainLeads, targetEALeads };
}

/**
 * GET /api/retell/knowledge-base
 * Fetch the active Retell Knowledge Base configuration
 */
export async function getKnowledgeBase(req, res, next) {
    try {
        const kb = await RetellKnowledgeBase.getOrCreateDefault();
        
        // Ensure pricingPlans is populated if empty or legacy doc
        if (!kb.pricingPlans || kb.pricingPlans.length === 0) {
            kb.pricingPlans = [
                {
                    name: 'Monthly Membership',
                    price: kb.monthlyPrice || 50,
                    interval: 'month',
                    isRecommended: true,
                    includes: kb.monthlyIncludes || 'All 4 sports (soccer, basketball, flag football, cheer) — rotate anytime. No re-registration fees. Uniform purchased separately.'
                },
                {
                    name: 'Seasonal Fee',
                    price: kb.seasonalPrice || 200,
                    interval: 'season',
                    isRecommended: false,
                    includes: kb.seasonalIncludes || 'One sport per season (3–4 months). Uniform included.'
                }
            ];
            await kb.save();
        }

        // Ensure transferDepartments is populated if empty or legacy doc
        if (!kb.transferDepartments || kb.transferDepartments.length === 0) {
            kb.transferDepartments = [
                {
                    departmentName: 'Executive Management / Escalations',
                    phoneNumber: kb.humanTransferPhone || '+18002930354',
                    triggers: 'Director requests, serious complaints, special circumstance reviews',
                    transferType: 'cold_transfer'
                }
            ];
            await kb.save();
        }

        const compiledPrompt = buildPromptFromKnowledgeBase(kb);

        return res.json({
            success: true,
            knowledgeBase: kb,
            compiledPrompt
        });
    } catch (err) {
        next(err);
    }
}

/**
 * PUT /api/retell/knowledge-base
 * Update the Knowledge Base fields in MongoDB
 */
export async function updateKnowledgeBase(req, res, next) {
    try {
        let kb = await RetellKnowledgeBase.findOne();
        if (!kb) {
            kb = new RetellKnowledgeBase();
        }

        // Allowed update keys
        const updateFields = [
            'agentName', 'phoneNumber', 'welcomeMessage',
            'personalityTraits', 'toneRules', 'goldenRule',
            'organizationName', 'motto', 'mission', 'differentiators',
            'contactPhone', 'contactEmail', 'contactWebsite',
            'sportsPrograms', 'locations', 'gameSchedule', 'outOfAreaScript',
            'pricingPlans', 'monthlyPrice', 'seasonalPrice', 'monthlyIncludes', 'seasonalIncludes', 'refundPolicy',
            'inboundOpeningScript', 'hesitantCallerScript', 'positiveCloseScript',
            'thinkAboutItCloseScript', 'voicemailScript', 'warmTransferScript',
            'faqs', 'objections',
            'humanTransferPhone', 'humanTransferTriggers',
            'transferDepartments'
        ];

        updateFields.forEach(field => {
            if (req.body[field] !== undefined) {
                kb[field] = req.body[field];
            }
        });

        await kb.save();
        const compiledPrompt = buildPromptFromKnowledgeBase(kb);

        return res.json({
            success: true,
            message: 'Knowledge Base saved successfully',
            knowledgeBase: kb,
            compiledPrompt
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/retell/sync
 * Sync the Knowledge Base directly to Retell AI Agent via REST API
 */
export async function syncToRetell(req, res, next) {
    try {
        const kb = await RetellKnowledgeBase.getOrCreateDefault();
        const syncResult = await syncKnowledgeBaseToRetell(kb);

        return res.json({
            success: true,
            message: 'Knowledge Base successfully synced with Retell AI Agent!',
            syncResult,
            lastSyncedAt: kb.lastSyncedAt
        });
    } catch (err) {
        return res.status(400).json({
            success: false,
            message: err.message || 'Failed to sync with Retell AI Agent'
        });
    }
}

/**
 * GET /api/retell/agent-status
 * Fetch live agent status from Retell AI
 */
export async function getRetellAgentStatus(req, res, next) {
    try {
        const kb = await RetellKnowledgeBase.getOrCreateDefault();
        const agentId = process.env.RETELL_AGENT_ID || 'agent_1c01375d88b99ba36b050ef0f8';
        
        let liveAgent = null;
        let isConnected = false;

        if (process.env.RETELL_API_KEY) {
            try {
                liveAgent = await getRetellAgentDetails(agentId);
                isConnected = true;
            } catch (apiErr) {
                console.warn('[Retell Controller] Could not fetch live agent details:', apiErr.message);
            }
        }

        return res.json({
            success: true,
            agentId,
            phoneNumber: kb.phoneNumber || '+18886879139',
            lastSyncedAt: kb.lastSyncedAt,
            lastSyncStatus: kb.lastSyncStatus,
            lastSyncMessage: kb.lastSyncMessage,
            hasApiKey: !!process.env.RETELL_API_KEY,
            isConnected,
            liveAgent
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/retell/webhook
 * Public webhook endpoint called by Retell AI after a call ends
 */
export async function handleRetellWebhook(req, res, next) {
    try {
        const payload = req.body;
        console.log(`[Retell Webhook] Received event: ${payload.event || 'call_update'} | Call ID: ${payload.call?.call_id || payload.call_id || 'unknown'}`);

        const callData = payload.call || payload;
        const callId = callData.call_id;

        if (!callId) {
            return res.status(200).json({ received: true, ignored: true, reason: 'missing_call_id' });
        }

        const result = await processRetellCallData(callData, payload);

        return res.status(200).json({
            success: true,
            received: true,
            callId,
            callRecordId: result?.callRecord?._id
        });
    } catch (err) {
        console.error('[Retell Webhook Error]:', err);
        // Always return 200 to Retell so it does not keep retrying errored payloads
        return res.status(200).json({ success: false, error: err.message });
    }
}

export default {
    getKnowledgeBase,
    updateKnowledgeBase,
    syncToRetell,
    getRetellAgentStatus,
    handleRetellWebhook
};
