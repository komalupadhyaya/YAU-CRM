import RetellKnowledgeBase from '../models/retellKnowledgeBase.model.js';
import Call from '../models/call.model.js';
import Lead from '../models/lead.model.js';
import Contact from '../models/contact.model.js';
import Note from '../models/note.model.js';
import EALead from '../models/eaLead.model.js';
import { 
    buildPromptFromKnowledgeBase, 
    syncKnowledgeBaseToRetell, 
    getRetellAgentDetails 
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
                    phoneNumber: kb.humanTransferPhone || '+919896233745',
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

        // Retell sends events like: call_started, call_ended, call_analyzed
        const callData = payload.call || payload;
        const callId = callData.call_id;
        const eventType = payload.event || (callData.end_timestamp ? 'call_ended' : 'call_update');

        if (!callId) {
            return res.status(200).json({ received: true, ignored: true, reason: 'missing_call_id' });
        }

        const callerNumber = callData.from_number || callData.caller_number || 'Unknown';
        const toNumber = callData.to_number || process.env.TWILIO_PHONE_NUMBER || '+18886879139';
        const direction = callData.direction === 'outbound' ? 'outbound' : 'inbound';
        
        // For inbound calls, lead is caller (from_number).
        // For outbound calls, lead is the called recipient (to_number).
        const targetLeadNumber = direction === 'outbound' ? toNumber : callerNumber;

        // Calculate duration in seconds
        let durationSeconds = 0;
        if (callData.duration_ms) {
            durationSeconds = Math.round(callData.duration_ms / 1000);
        } else if (callData.start_timestamp && callData.end_timestamp) {
            durationSeconds = Math.round((callData.end_timestamp - callData.start_timestamp) / 1000);
        }

        const recordingUrl = callData.recording_url || null;
        const transcript = callData.transcript || callData.transcript_object?.map(t => `${t.role}: ${t.content}`).join('\n') || null;
        const aiSummary = callData.call_analysis?.call_summary || callData.summary || null;
        const callerSentiment = callData.call_analysis?.user_sentiment || callData.sentiment || null;
        const disconnectionReason = callData.disconnection_reason || callData.status || 'completed';

        // 1. Find all matching main leads and EA leads (by phone number AND by existing call ID)
        const { mainLeads: phoneMainLeads, eaLeads: phoneEALeads } = await findMatchingLeadsByPhone(targetLeadNumber);
        
        const directMainLeadsByCall = await Lead.find({
            $or: [
                { 'callHistory.callSid': `retell_${callId}` },
                { 'callHistory.retellCallId': callId }
            ]
        });

        const directEALeadsByCall = await EALead.find({
            $or: [
                { 'callHistory.callSid': `retell_${callId}` },
                { 'callHistory.retellCallId': callId }
            ]
        });

        // Combine and deduplicate
        const mainLeadMap = new Map();
        [...phoneMainLeads, ...directMainLeadsByCall].forEach(l => {
            if (l && l._id) mainLeadMap.set(l._id.toString(), l);
        });
        const targetMainLeads = Array.from(mainLeadMap.values());

        const eaLeadMap = new Map();
        [...phoneEALeads, ...directEALeadsByCall].forEach(l => {
            if (l && l._id) eaLeadMap.set(l._id.toString(), l);
        });
        const targetEALeads = Array.from(eaLeadMap.values());

        let associatedLeadId = targetMainLeads.length > 0 ? targetMainLeads[0]._id : (targetEALeads.length > 0 ? targetEALeads[0]._id : null);

        // 2. Create or Update Call Record in CRM
        let callRecord = await Call.findOne({ retellCallId: callId });
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
                lead_id: associatedLeadId,
                transcript,
                aiSummary,
                callerSentiment
            });
            console.log(`✅ [Retell Webhook] Created Call record: ${callRecord._id} for ${callerNumber}`);
        } else {
            if (durationSeconds) callRecord.duration = durationSeconds;
            if (recordingUrl) callRecord.recordingUrl = recordingUrl;
            if (disconnectionReason) callRecord.status = disconnectionReason;
            if (transcript) callRecord.transcript = transcript;
            if (aiSummary) callRecord.aiSummary = aiSummary;
            if (callerSentiment) callRecord.callerSentiment = callerSentiment;
            if (associatedLeadId && !callRecord.lead_id) {
                callRecord.lead_id = associatedLeadId;
            }
            await callRecord.save();
            console.log(`✅ [Retell Webhook] Updated Call record: ${callRecord._id}`);
        }

        // 3. Save / Update callHistory to ALL matching Main Leads non-destructively
        for (const lead of targetMainLeads) {
            if (!lead.callHistory) lead.callHistory = [];
            const existingIndex = lead.callHistory.findIndex(c => c.callSid === `retell_${callId}` || c.retellCallId === callId);
            if (existingIndex >= 0) {
                const existing = lead.callHistory[existingIndex];
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
            console.log(`📞 [Retell Webhook] Saved/Updated callHistory on Main Lead: ${lead.name || lead._id} (Summary: ${aiSummary ? 'YES' : 'Pending'})`);
        }

        // 4. Save / Update callHistory to ALL matching EA Leads non-destructively
        for (const eaLead of targetEALeads) {
            if (!eaLead.callHistory) eaLead.callHistory = [];
            const existingIndex = eaLead.callHistory.findIndex(c => c.callSid === `retell_${callId}` || c.retellCallId === callId);
            if (existingIndex >= 0) {
                const existing = eaLead.callHistory[existingIndex];
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
            console.log(`📞 [Retell Webhook] Saved/Updated callHistory on EA Lead: ${eaLead.name || eaLead._id} (Summary: ${aiSummary ? 'YES' : 'Pending'})`);
        }

        return res.status(200).json({
            success: true,
            received: true,
            callId,
            callRecordId: callRecord?._id
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
