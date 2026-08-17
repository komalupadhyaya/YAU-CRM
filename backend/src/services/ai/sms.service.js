/**
 * sms.service.js
 * ─────────────────────────────────────────────────────────────────
 * Features 3 & 4 — Automated Personalized SMS & AI Two-Way Reply Assistant
 * Handles creation of initial personalized SMS for new EA leads, phrasing variation,
 * evaluation of inbound replies, auto-replies for FAQs, and draft generation for reps.
 * ─────────────────────────────────────────────────────────────────
 */

import { executeAiCompletion } from './provider.service.js';
import { getKnowledgeBasePromptContext } from './knowledgeBase.service.js';
import EALead from '../../models/eaLead.model.js';
import Lead from '../../models/lead.model.js';
import twilio from 'twilio';
import { sendGeneralEmail } from '../sendgrid.service.js';
import presenceService from '../presence.service.js';

let twilioClient = null;
function getTwilioClient() {
    if (!twilioClient && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    }
    return twilioClient;
}

// ── Feature 3: Initial Personalized SMS Generation ────────────────

function buildInitialSmsPrompt() {
    return `You are a warm, helpful sales coordinator for YAU Sports (youth sports programs in MD, VA, and DC).
Your task is to write a short, friendly, personalized introductory SMS message for a lead who just filled out a form.

RULES:
- Length: Under 160 characters (1 SMS segment).
- Tone: Natural, conversational, and human (as if written by a real staff member, NOT a bot).
- Content: Mention their name, express enthusiasm for their sport or county if provided, and ask a simple open question to start a conversation.
- Phrasing Variation: Varies sentence openers naturally.
- Output: Return ONLY the SMS message text. No quotes, labels, or extra commentary.`;
}

function buildInitialSmsUserContent({ name, sport, county, source, previousMessages }) {
    const prevText = (previousMessages && previousMessages.length > 0)
        ? previousMessages.map(m => m.message).join(' | ')
        : 'None (First SMS)';

    return `Lead Details:
- Name: ${name || 'there'}
- Sport Interest: ${sport || 'youth sports'}
- County / Area: ${county || 'your area'}
- Lead Acquisition Source: ${source || 'YAU Form'}
- Previous Sent SMS Texts (Avoid repeating these phrasings): ${prevText}

Write the personalized introductory SMS text now:`;
}

/**
 * Generate personalized initial SMS text for a lead.
 */
export async function generateInitialPersonalizedSms(leadData) {
    const systemPrompt = buildInitialSmsPrompt();
    const userContent = buildInitialSmsUserContent({
        name: leadData.name?.split(' ')[0] || leadData.name,
        sport: leadData.sport || leadData.department,
        county: leadData.county || leadData.city,
        source: leadData.source || leadData.type,
        previousMessages: (leadData.smsHistory || []).filter(m => m.direction === 'outbound')
    });

    try {
        const text = await executeAiCompletion({
            systemPrompt,
            userContent,
            jsonMode: false,
            maxTokens: 150
        });

        if (text && text.trim().length > 5) {
            return text.trim().replace(/^["']|["']$/g, '');
        }
    } catch (err) {
        console.error('[AI Initial SMS Error] Falling back to default SMS:', err.message);
    }

    const firstName = leadData.name ? leadData.name.split(' ')[0] : 'there';
    return `Hey ${firstName}! Thanks for reaching out to YAU Sports. We'd love to share program details for your area — when's a good time to chat?`;
}

/**
 * Send initial automated SMS (or SendGrid email fallback if SMS consent is missing) for a newly created EA Lead.
 */
export async function processInitialEALeadSms(eaLeadId) {
    try {
        const lead = await EALead.findById(eaLeadId);
        if (!lead) return;

        // Verify SMS consent
        if (lead.isConsent === false) {
            console.log(`[AI Initial SMS] Lead ${eaLeadId} did not opt into SMS. Sending email fallback...`);
            if (lead.email && lead.isEmailConsent !== false) {
                const firstName = lead.name ? lead.name.split(' ')[0] : 'there';
                await sendGeneralEmail({
                    to: lead.email,
                    subject: `Welcome to YAU Sports, ${firstName}!`,
                    html: `<p>Hi ${firstName},</p><p>Thank you for submitting your interest in YAU Sports programs! Our team is reviewing your details and will follow up with schedule and location information shortly.</p><p>Best regards,<br>The YAU Sports Team</p>`
                }).catch(e => console.error('[AI Email Fallback Error]:', e.message));
            }
            return;
        }

        // Generate personalized text
        const smsText = await generateInitialPersonalizedSms(lead);

        // Send via Twilio if configured
        const client = getTwilioClient();
        const fromNumber = process.env.TWILIO_PHONE_NUMBER;

        let twilioSid = null;
        let smsStatus = 'pending';

        if (client && fromNumber && lead.phone) {
            try {
                const messageRes = await client.messages.create({
                    body: smsText,
                    from: fromNumber,
                    to: lead.phone
                });
                twilioSid = messageRes.sid;
                smsStatus = 'sent';
                console.log(`[AI Initial SMS] Twilio SMS dispatched to ${lead.phone} (SID: ${twilioSid})`);
            } catch (twErr) {
                console.error(`[AI Initial SMS] Twilio send failed for ${lead.phone}:`, twErr.message);
                smsStatus = 'failed';
            }
        } else {
            console.warn(`[AI Initial SMS] Twilio client or phone number not configured. Logged SMS internally.`);
            smsStatus = 'sent';
        }

        // Log in lead's smsHistory
        lead.smsHistory.push({
            direction: 'outbound',
            message: smsText,
            timestamp: new Date(),
            status: smsStatus,
            twilioSid: twilioSid,
            sentBy: 'ai'
        });

        await lead.save();

        if (presenceService?.io) {
            presenceService.io.emit('ai:initial_contact', {
                leadId: lead._id,
                leadName: lead.name,
                text: smsText
            });
        }
    } catch (err) {
        console.error('[AI Initial SMS Process Error]:', err.message);
    }
}


// ── Feature 4: Two-Way SMS Reply Assistant ────────────────────────

function buildReplyAssistantPrompt() {
    const kbContext = getKnowledgeBasePromptContext();
    return `You are the AI Assistant for YAU Sports (youth sports program provider).
Your job is to read an inbound SMS reply from a parent or school administrator, along with conversation history, and evaluate how the CRM should respond.

${kbContext}

EVALUATION CATEGORIES:
- "FAQ": Simple questions about practice schedules, locations, pricing, age groups, or registration policies.
- "INTERESTED": Lead wants to enroll, sign up, schedule a call, or request a meeting.
- "COMPLAINT": Complaints, dissatisfaction, refund requests, or sensitive issues.
- "ACKNOWLEDGMENT": Simple confirmations (e.g. "Thanks", "Okay", "Got it", "Sounds good").

RULES:
- Return strictly a JSON object with:
  "category": "FAQ" | "INTERESTED" | "COMPLAINT" | "ACKNOWLEDGMENT",
  "confidenceScore": number (0-100),
  "autoSendAllowed": boolean (true ONLY for FAQ or ACKNOWLEDGMENT with confidence >= 85%),
  "suggestedReply": string (natural, concise reply under 200 chars using KB context)
`;
}

function buildReplyAssistantUserContent(leadData, incomingMessage) {
    const historyText = (leadData.smsHistory || []).slice(-6).map(m => {
        const sender = m.direction === 'inbound' ? '[LEAD]' : '[STAFF]';
        return `${sender}: ${m.message}`;
    }).join('\n');

    return `Lead Information:
- Name: ${leadData.name || 'Valued Lead'}
- Source / Category: ${leadData.source || leadData.type || 'N/A'}
- Current CRM Status: ${leadData.status || 'Active'}

Recent SMS Conversation History:
${historyText || '(No previous messages)'}

INCOMING INBOUND SMS REPLY FROM LEAD:
"${incomingMessage}"

Evaluate this incoming reply and return JSON now:`;
}

/**
 * Evaluate an inbound SMS reply and perform auto-reply or save draft for rep approval.
 */
export async function handleInboundSmsReplyAi({ leadId, leadType = 'ea_lead', incomingMessage, leadDoc }) {
    try {
        if (!leadDoc) {
            leadDoc = leadType === 'ea_lead' ? await EALead.findById(leadId) : await Lead.findById(leadId);
        }
        if (!leadDoc || !incomingMessage) return null;

        const systemPrompt = buildReplyAssistantPrompt();
        const userContent = buildReplyAssistantUserContent(leadDoc, incomingMessage);

        const aiResult = await executeAiCompletion({
            systemPrompt,
            userContent,
            jsonMode: true,
            maxTokens: 350
        }).catch(err => {
            console.error('[AI Reply Assistant] AI call failed:', err.message);
            return null;
        });

        if (!aiResult) return null;

        const { category, confidenceScore = 0, autoSendAllowed, suggestedReply } = aiResult;
        console.log(`[AI Reply Assistant] Evaluated message: "${incomingMessage}" → Category: ${category}, Confidence: ${confidenceScore}%, AutoSend: ${autoSendAllowed}`);

        const client = getTwilioClient();
        const fromNumber = process.env.TWILIO_PHONE_NUMBER;
        const targetPhone = leadDoc.phone || leadDoc.telephone;

        // 1. Auto-Respond directly if allowed & high confidence & Twilio ready
        if (autoSendAllowed && confidenceScore >= 85 && suggestedReply && client && fromNumber && targetPhone && leadDoc.isConsent !== false) {
            try {
                const messageRes = await client.messages.create({
                    body: suggestedReply,
                    from: fromNumber,
                    to: targetPhone
                });

                leadDoc.smsHistory.push({
                    direction: 'outbound',
                    message: suggestedReply,
                    timestamp: new Date(),
                    status: 'sent',
                    twilioSid: messageRes.sid,
                    sentBy: 'ai'
                });

                leadDoc.aiReplyDraft = {
                    text: suggestedReply,
                    category: category || 'FAQ',
                    generatedAt: new Date(),
                    status: 'auto_sent'
                };

                await leadDoc.save();
                console.log(`[AI Reply Assistant] Auto-responded via Twilio SID: ${messageRes.sid}`);

                if (presenceService?.io) {
                    presenceService.io.emit('ai:reply_assistant', {
                        leadId: leadDoc._id,
                        leadName: leadDoc.name,
                        autoSent: true,
                        text: suggestedReply,
                        category
                    });
                }

                return { autoSent: true, text: suggestedReply };
            } catch (sendErr) {
                console.error('[AI Reply Assistant] Auto-reply send failed:', sendErr.message);
            }
        }

        // 2. Draft Reply for Rep Review (or Complaint Flagging)
        leadDoc.aiReplyDraft = {
            text: suggestedReply || `Hi ${leadDoc.name?.split(' ')[0] || ''}, thanks for your message! Our team is reviewing this and will reply shortly.`,
            category: category || 'INTERESTED',
            confidenceScore: confidenceScore,
            generatedAt: new Date(),
            status: category === 'COMPLAINT' ? 'flagged_complaint' : 'pending'
        };

        await leadDoc.save();
        console.log(`[AI Reply Assistant] Draft reply saved for rep approval on ${leadType} (${leadDoc._id})`);

        if (presenceService?.io) {
            presenceService.io.emit('ai:reply_assistant', {
                leadId: leadDoc._id,
                leadName: leadDoc.name,
                autoSent: false,
                text: leadDoc.aiReplyDraft.text,
                category
            });
        }

        return { autoSent: false, draft: leadDoc.aiReplyDraft };

    } catch (err) {
        console.error('[AI Reply Assistant Error]:', err.message);
        return null;
    }
}

export default { generateInitialPersonalizedSms, processInitialEALeadSms, handleInboundSmsReplyAi };
