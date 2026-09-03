import RetellKnowledgeBase from '../models/retellKnowledgeBase.model.js';
import Call from '../models/call.model.js';
import Lead from '../models/lead.model.js';
import Contact from '../models/contact.model.js';
import Note from '../models/note.model.js';
import EALead from '../models/eaLead.model.js';
import Voicemail from '../models/voicemail.model.js';
import twilio from 'twilio';
import { sendVoicemailEmailNotification } from '../services/email/mailer.js';
import { 
    buildPromptFromKnowledgeBase, 
    syncKnowledgeBaseToRetell, 
    getRetellAgentDetails,
    getRetellCallDetails,
    getSanitizedToolName
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

    // 5. Automated Voicemail / Message Creation & Multi-Channel Targeted Alerts
    try {
        // 1. Check for explicit negative intent / declined message offer
        const isDeclinedOrNoMessage = 
            /(declined|refused|did not want|chose not|decided not|opted not|hung up without|without leaving)\s+(to\s+leave\s+)?(a\s+)?(message|voicemail)/i.test(aiSummary || '') ||
            /(no\s+message\s+(was\s+)?left|caller\s+declined|no\s+voicemail\s+left|declined\s+(the\s+)?offer\s+to\s+leave\s+a\s+message)/i.test(aiSummary || '') ||
            /(caller\s+(stated|said)\s+(they\s+)?(do\s+not|did\s+not|don't|dont)\s+want\s+to\s+leave\s+(a\s+)?(message|voicemail))/i.test(transcript || '') ||
            /(no\s+thanks.*call\s+back\s+later|no\s+need.*call\s+back|don't\s+want\s+to\s+leave\s+a\s+message|dont\s+want\s+to\s+leave\s+a\s+message|not\s+leaving\s+a\s+message|will\s+call\s+back\s+later)/i.test(transcript || '');

        // 2. Strict explicit voicemail & message intent detection
        const isExplicitVoicemailSummary = 
            !isDeclinedOrNoMessage && (
                /(left|leave|leaving)\s+(a\s+)?(voice\s*mail|message)/i.test(aiSummary || '') ||
                /(caller\s+left\s+a\s+message|voicemail\s+received|recorded\s+a\s+voicemail|caller\s+requested\s+a\s+callback)/i.test(aiSummary || '') ||
                /voicemail\s+recorded/i.test(aiSummary || '')
            );

        const isExplicitVoicemailTranscript = 
            !isDeclinedOrNoMessage && (
                /(leave\s+your\s+name\s+and\s+number|recorded\s+message|transfer\s+failed.*message)/i.test(transcript || '') ||
                /called\s+after\s+hours.*message/i.test(transcript || '')
            );

        const isVoicemailOrMessage = !isDeclinedOrNoMessage && (
            isExplicitVoicemailSummary || 
            isExplicitVoicemailTranscript || 
            disconnectionReason === 'voicemail_reached'
        );

        if (isVoicemailOrMessage && (aiSummary || transcript)) {
            // Determine attempted department & targeted destination phone number
            let targetDepartment = null;
            let targetNumber = null;

            const kb = await RetellKnowledgeBase.findOne().lean();
            const departments = kb?.transferDepartments || [
                { departmentName: 'Executive Management & Escalations', phoneNumber: '+12027013900' },
                { departmentName: 'Program Coordination & Support', phoneNumber: '+12023413778' }
            ];

            // Match department by tool invocation or department name mention
            for (const dept of departments) {
                const toolName = getSanitizedToolName(dept.departmentName);
                if (
                    (transcript && (transcript.includes(toolName) || transcript.toLowerCase().includes(dept.departmentName.toLowerCase()))) ||
                    (aiSummary && aiSummary.toLowerCase().includes(dept.departmentName.toLowerCase()))
                ) {
                    targetDepartment = dept.departmentName;
                    targetNumber = dept.phoneNumber;
                    break;
                }
            }

            if (!targetNumber) {
                targetNumber = departments[0]?.phoneNumber || '+12027013900';
            }

            // Extract caller name if mentioned or matched from CRM leads
            const callerName = targetMainLeads[0]?.name || targetEALeads[0]?.name || callData.call_analysis?.custom_analysis_data?.user_name || null;

            // Create or update authoritative Voicemail document
            const voicemail = await Voicemail.findOneAndUpdate(
                { retellCallId: callId },
                {
                    fromNumber: callerNumber,
                    callerName,
                    recordingUrl: recordingUrl || '',
                    duration: durationSeconds,
                    callSid: `retell_${callId}`,
                    retellCallId: callId,
                    source: 'retell',
                    targetDepartment,
                    targetNumber,
                    transcript,
                    aiSummary,
                    callerSentiment,
                    lead_id: associatedMainLeadId,
                    ea_lead_id: associatedEALeadId,
                    createdAt: callData.start_timestamp ? new Date(callData.start_timestamp) : new Date()
                },
                { upsert: true, new: true }
            );

            console.log(`📼 [Retell Voicemail] Created/Updated Voicemail ${voicemail._id} for ${callerNumber} (Dept: ${targetDepartment || 'General'} -> ${targetNumber}, SMS Sent: ${Boolean(voicemail.smsAlertSent)})`);

            // Send Email Notification to central admin inbox (once per call)
            if (!voicemail.emailAlertSent) {
                const adminEmail = process.env.ADMIN_EMAIL || 'team@yausports.com';
                await sendVoicemailEmailNotification({
                    to: adminEmail,
                    fromNumber: callerNumber,
                    callerName,
                    targetDepartment,
                    duration: durationSeconds,
                    recordingUrl,
                    aiSummary,
                    transcript
                }).catch(err => console.error('⚠️ [Retell Voicemail] Email alert error:', err.message));
            }

            // Send Targeted SMS Alert to department / admin phone (EXACTLY ONCE per call, with summary)
            if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER && targetNumber && !voicemail.smsAlertSent) {
                // Only dispatch if AI summary is ready or this is the final analysis stage
                if (aiSummary || payload?.event === 'call_analyzed') {
                    try {
                        const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
                        const cleanSummary = aiSummary || 'Caller left a voicemail message with Retell AI.';
                        const smsBody = `📼 New Y-A-U Voicemail from ${callerName ? `${callerName} (${callerNumber})` : callerNumber}${targetDepartment ? ` [${targetDepartment}]` : ''}:\n"${cleanSummary}"\n\n📞 Return Call: ${callerNumber}`;

                        await twilioClient.messages.create({
                            from: process.env.TWILIO_PHONE_NUMBER,
                            to: targetNumber,
                            body: smsBody
                        });
                        voicemail.smsAlertSent = true;
                        await voicemail.save();
                        console.log(`📱 [Retell Voicemail] Exactly 1 Targeted SMS alert sent to ${targetNumber} (Full Summary Length: ${cleanSummary.length} chars)`);
                    } catch (smsErr) {
                        console.warn(`⚠️ [Retell Voicemail] Failed to send SMS to ${targetNumber}:`, smsErr.message);
                    }
                }
            }
        }
    } catch (vmErr) {
        console.error('⚠️ [Retell Voicemail] Error handling voicemail pipeline:', vmErr.message);
    }

    // 6. Background Direct API Fallback: If aiSummary is missing after call_ended, fetch via REST API
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
            'agentName', 'phoneNumber', 'voiceId', 'welcomeMessage',
            'enableVoicemailDetection', 'outboundVoicemailMessage', 'voicemailDetectionTimeoutMs',
            'webhookEnvironment', 'customWebhookUrl', 'webhookUrl', 'timezone',
            'businessHours', 'afterHoursScript', 'takeMessageScript',
            'personalityTraits', 'toneRules', 'goldenRule',
            'organizationName', 'motto', 'mission', 'differentiators',
            'contactPhone', 'contactEmail', 'contactWebsite',
            'sportsPrograms', 'locations', 'gameSchedule', 'outOfAreaScript',
            'pricingPlans', 'monthlyPrice', 'seasonalPrice', 'monthlyIncludes', 'seasonalIncludes', 'refundPolicy', 'refundHandlingScript',
            'inboundOpeningScript', 'hesitantCallerScript', 'positiveCloseScript',
            'thinkAboutItCloseScript', 'voicemailScript', 'warmTransferScript',
            'cancellationHandlingScript', 'afterSchoolScript',
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
