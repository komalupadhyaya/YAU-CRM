import mongoose from 'mongoose';
import Lead from '../models/lead.model.js';
import EALead from '../models/eaLead.model.js';
import Contact from '../models/contact.model.js';
import Note from '../models/note.model.js';
import EmailHistory from '../models/emailHistory.model.js';
import EmailSegment from '../models/emailSegment.model.js';
import EmailCampaign from '../models/emailCampaign.model.js';
import EmailQueue from '../models/emailQueue.model.js';
import EmailTemplate from '../models/emailTemplate.model.js';
import aiService from '../services/ai/ai.service.js';
import { resolveSegmentRecipients } from './segments.controller.js';

/**
 * Helper to fetch complete cross-channel interaction context for a contact.
 */
async function fetchRecipientContext(recipient) {
    let leadName = recipient.name || '';
    let contactName = recipient.name || '';
    let contactTitle = '';
    let leadStatus = 'Active';
    let leadCategory = 'Organization';
    let smsHistory = [];
    let emailHistory = [];
    let notesHistory = [];

    const email = (recipient.email || '').toLowerCase().trim();

    try {
        if (recipient.leadModel === 'Lead' && recipient.leadId) {
            const lead = await Lead.findById(recipient.leadId).lean();
            if (lead) {
                leadName = lead.name || leadName;
                leadStatus = lead.status || leadStatus;
                leadCategory = lead.category_group || lead.type || leadCategory;
                smsHistory = (lead.smsHistory || []).map(s => ({
                    direction: s.direction,
                    message: s.message,
                    timestamp: s.timestamp
                }));

                const contact = await Contact.findOne({ lead_id: lead._id, email: email }).lean();
                if (contact) {
                    contactName = contact.name || contactName;
                    contactTitle = contact.title || '';
                }

                const rawNotes = await Note.find({ lead_id: lead._id })
                    .sort({ createdAt: -1 })
                    .limit(8)
                    .lean();

                notesHistory = rawNotes.map(n => ({
                    type: n.type,
                    content: n.content,
                    createdAt: n.createdAt
                }));
            }
        } else if (recipient.leadModel === 'EALead' && recipient.leadId) {
            const ea = await EALead.findById(recipient.leadId).lean();
            if (ea) {
                leadName = ea.name || leadName;
                contactName = ea.name || contactName;
                contactTitle = ea.title || ea.role || '';
                leadStatus = ea.status || leadStatus;
                leadCategory = ea.sport || ea.category || leadCategory;
                smsHistory = (ea.smsHistory || []).map(s => ({
                    direction: s.direction,
                    message: s.message,
                    timestamp: s.timestamp
                }));
            }
        }

        // Fetch prior email history for this address across CRM
        const rawEmails = await EmailHistory.find({
            $or: [
                { to: email },
                ...(recipient.leadId ? [{ leadId: recipient.leadId }] : [])
            ]
        })
        .sort({ sentAt: -1, createdAt: -1 })
        .limit(6)
        .lean();

        emailHistory = rawEmails.map(e => ({
            direction: e.direction || 'outbound',
            subject: e.subject || '',
            body: e.body || '',
            sentAt: e.sentAt || e.createdAt
        }));

    } catch (err) {
        console.warn(`[AI Campaign] Context aggregation warning for ${email}:`, err.message);
    }

    return {
        profile: {
            leadName,
            contactName,
            contactTitle,
            leadStatus,
            leadCategory,
            email
        },
        smsHistory,
        emailHistory,
        notesHistory
    };
}

/**
 * POST /api/campaigns/ai-personalized/preview
 * Aggregates recipient history from segment and generates personalized email drafts
 * strictly preserving the sample template's styling, layout, and colors.
 */
export const generateAiCampaignPreview = async (req, res, next) => {
    try {
        const { segmentId, campaignGoal, tone, sampleLimit, templateId, baseTemplateHtml, templateSubject } = req.body;

        if (!segmentId) {
            return res.status(400).json({ success: false, message: 'segmentId is required.' });
        }

        const segment = await EmailSegment.findById(segmentId);
        if (!segment) {
            return res.status(404).json({ success: false, message: 'Target segment not found.' });
        }

        let resolvedTemplateHtml = baseTemplateHtml || '';
        let resolvedTemplateSubject = templateSubject || '';

        if (templateId) {
            const dbTemplate = await EmailTemplate.findById(templateId).lean();
            if (dbTemplate) {
                resolvedTemplateHtml = dbTemplate.content || resolvedTemplateHtml;
                resolvedTemplateSubject = dbTemplate.subject || resolvedTemplateSubject;
            }
        }

        const allRecipients = await resolveSegmentRecipients(segment);
        if (!allRecipients || allRecipients.length === 0) {
            return res.status(400).json({ success: false, message: 'The selected segment contains no active recipients.' });
        }

        // Default to fast 5-sample preview for instant review
        const PREVIEW_LIMIT = (sampleLimit && Number(sampleLimit) > 0) ? Number(sampleLimit) : 5;
        const recipients = allRecipients.slice(0, PREVIEW_LIMIT);

        console.log(`[AI Campaign Preview] Fast preview generation for ${recipients.length} of ${allRecipients.length} recipients in "${segment.name}" (Template: ${templateId || (resolvedTemplateHtml ? 'Custom' : 'None')})...`);

        // Concurrent batch processing (batches of 5 for instant parallel generation)
        const BATCH_SIZE = 5;
        const drafts = [];

        for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
            const chunk = recipients.slice(i, i + BATCH_SIZE);
            const chunkResults = await Promise.all(chunk.map(async (recipient) => {
                const context = await fetchRecipientContext(recipient);
                
                try {
                    // Exactly 1 AI call per recipient
                    const aiResult = await aiService.generatePersonalizedEmailMessage({
                        recipient: context.profile,
                        smsHistory: context.smsHistory,
                        emailHistory: context.emailHistory,
                        notesHistory: context.notesHistory,
                        campaignGoal: campaignGoal || 'Partner with YAU Sports for youth athletic enrichment and clinics',
                        tone: tone || 'Professional & Warm',
                        baseTemplateHtml: resolvedTemplateHtml,
                        templateSubject: resolvedTemplateSubject
                    });

                    return {
                        leadId: recipient.leadId,
                        leadModel: recipient.leadModel,
                        name: context.profile.contactName || recipient.name,
                        leadName: context.profile.leadName,
                        contactTitle: context.profile.contactTitle,
                        email: recipient.email,
                        subject: aiResult.subject,
                        body: aiResult.body,
                        contextReasoning: aiResult.contextReasoning,
                        historySummary: {
                            smsCount: context.smsHistory.length,
                            emailCount: context.emailHistory.length,
                            notesCount: context.notesHistory.length
                        }
                    };
                } catch (aiErr) {
                    console.error(`[AI Campaign] Single generation fallback for ${recipient.email}:`, aiErr.message);
                    // Safe fallback without retry loop
                    return {
                        leadId: recipient.leadId,
                        leadModel: recipient.leadModel,
                        name: context.profile.contactName || recipient.name,
                        leadName: context.profile.leadName,
                        contactTitle: context.profile.contactTitle,
                        email: recipient.email,
                        subject: resolvedTemplateSubject || `Youth Athletic Programs for ${context.profile.leadName || 'Your School'}`,
                        body: resolvedTemplateHtml 
                            ? resolvedTemplateHtml.replace(/\{\{\s*name\s*\}\}/gi, context.profile.contactName || recipient.name || 'there')
                            : `<p>Hi ${context.profile.contactName || 'there'},</p><p>We wanted to reach out from YAU Sports regarding our upcoming youth athletic programs and school clinics.</p><p>Best regards,<br/>The YAU Sports Team</p>`,
                        contextReasoning: 'Preserved template styling; applied contact profile fallback.',
                        historySummary: {
                            smsCount: context.smsHistory.length,
                            emailCount: context.emailHistory.length,
                            notesCount: context.notesHistory.length
                        }
                    };
                }
            }));

            drafts.push(...chunkResults);
        }

        return res.json({
            success: true,
            totalSegmentCount: allRecipients.length,
            generatedCount: drafts.length,
            isSamplePreview: true,
            templateUsed: !!resolvedTemplateHtml,
            drafts
        });

    } catch (err) {
        console.error('[AI Campaign Preview Error]:', err);
        next(err);
    }
};

/**
 * Background generator to process remaining recipients without blocking the UI.
 * Strict 1-to-1 call limit: exactly 1 call per remaining recipient, no infinite loops.
 */
async function generateAndEnqueueRemainingAiRecipients({ campaignId, segment, existingDrafts, campaignGoal, tone, templateId, isScheduled }) {
    try {
        const allRecipients = await resolveSegmentRecipients(segment);
        const existingEmailSet = new Set(existingDrafts.map(d => (d.email || '').toLowerCase().trim()));
        const remainingRecipients = allRecipients.filter(r => !existingEmailSet.has((r.email || '').toLowerCase().trim()));

        if (remainingRecipients.length === 0) return;

        console.log(`[AI Campaign Background Generator] Starting background generation for remaining ${remainingRecipients.length} recipients of campaign ${campaignId}...`);

        let resolvedTemplateHtml = '';
        let resolvedTemplateSubject = '';
        if (templateId) {
            const dbTemplate = await EmailTemplate.findById(templateId).lean();
            if (dbTemplate) {
                resolvedTemplateHtml = dbTemplate.content || '';
                resolvedTemplateSubject = dbTemplate.subject || '';
            }
        }

        const BATCH_SIZE = 5;
        for (let i = 0; i < remainingRecipients.length; i += BATCH_SIZE) {
            const chunk = remainingRecipients.slice(i, i + BATCH_SIZE);
            const chunkResults = await Promise.all(chunk.map(async (recipient) => {
                const context = await fetchRecipientContext(recipient);
                try {
                    // Exactly 1 AI call per recipient
                    const aiResult = await aiService.generatePersonalizedEmailMessage({
                        recipient: context.profile,
                        smsHistory: context.smsHistory,
                        emailHistory: context.emailHistory,
                        notesHistory: context.notesHistory,
                        campaignGoal: campaignGoal || 'Partner with YAU Sports for youth athletic enrichment and clinics',
                        tone: tone || 'Professional & Warm',
                        baseTemplateHtml: resolvedTemplateHtml,
                        templateSubject: resolvedTemplateSubject
                    });

                    return {
                        leadId: recipient.leadId,
                        leadModel: recipient.leadModel,
                        name: context.profile.contactName || recipient.name,
                        email: recipient.email,
                        subject: aiResult.subject,
                        body: aiResult.body,
                        contextReasoning: aiResult.contextReasoning || 'AI personalized from interaction history'
                    };
                } catch (aiErr) {
                    console.warn(`[AI Campaign Background] Fallback for ${recipient.email}:`, aiErr.message);
                    // Fallback immediately without loop retries
                    return {
                        leadId: recipient.leadId,
                        leadModel: recipient.leadModel,
                        name: context.profile.contactName || recipient.name,
                        email: recipient.email,
                        subject: resolvedTemplateSubject || `Youth Athletic Programs for ${context.profile.leadName || 'Your School'}`,
                        body: resolvedTemplateHtml 
                            ? resolvedTemplateHtml.replace(/\{\{\s*name\s*\}\}/gi, context.profile.contactName || recipient.name || 'there')
                            : `<p>Hi ${context.profile.contactName || 'there'},</p><p>We wanted to reach out regarding our upcoming athletic programs and clinics.</p><p>Best regards,<br/>YAU Sports</p>`,
                        contextReasoning: 'Preserved template styling; applied contact profile fallback.'
                    };
                }
            }));

            // Append to Campaign recipientLogs
            const newLogs = chunkResults.map(r => ({
                leadId: r.leadId || null,
                leadModel: r.leadModel || 'Lead',
                name: r.name || '',
                email: r.email,
                personalizedSubject: r.subject,
                personalizedContent: r.body,
                contextReasoning: r.contextReasoning,
                status: 'pending'
            }));

            await EmailCampaign.findByIdAndUpdate(campaignId, {
                $push: { recipientLogs: { $each: newLogs } }
            });

            // If not scheduled, enqueue immediately in EmailQueue
            if (!isScheduled) {
                const queueItems = chunkResults.map(r => ({
                    campaignId,
                    leadId: r.leadId || null,
                    leadModel: r.leadModel || 'Lead',
                    recipientName: r.name || '',
                    email: r.email,
                    subject: r.subject,
                    body: r.body,
                    status: 'pending'
                }));

                await EmailQueue.insertMany(queueItems);
            }

            // Paced 250ms pause between chunks to protect AI rate quotas
            await new Promise(resolve => setTimeout(resolve, 250));
        }

        console.log(`[AI Campaign Background Generator] Finished background processing for campaign ${campaignId}.`);
    } catch (bgErr) {
        console.error(`[AI Campaign Background Generator Error]:`, bgErr);
    }
}

/**
 * POST /api/campaigns/ai-personalized/regenerate-single
 * Re-runs AI generation for a single recipient with optional custom tweak instructions and template preservation.
 */
export const regenerateSingleRecipientDraft = async (req, res, next) => {
    try {
        const { leadId, leadModel, email, name, campaignGoal, tone, customInstruction, templateId, baseTemplateHtml, templateSubject } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Recipient email is required.' });
        }

        let resolvedTemplateHtml = baseTemplateHtml || '';
        let resolvedTemplateSubject = templateSubject || '';

        if (templateId) {
            const dbTemplate = await EmailTemplate.findById(templateId).lean();
            if (dbTemplate) {
                resolvedTemplateHtml = dbTemplate.content || resolvedTemplateHtml;
                resolvedTemplateSubject = dbTemplate.subject || resolvedTemplateSubject;
            }
        }

        const context = await fetchRecipientContext({ leadId, leadModel: leadModel || 'Lead', email, name });

        const aiResult = await aiService.generatePersonalizedEmailMessage({
            recipient: context.profile,
            smsHistory: context.smsHistory,
            emailHistory: context.emailHistory,
            notesHistory: context.notesHistory,
            campaignGoal: campaignGoal || '',
            tone: tone || 'Professional & Warm',
            customInstruction: customInstruction || '',
            baseTemplateHtml: resolvedTemplateHtml,
            templateSubject: resolvedTemplateSubject
        });

        return res.json({
            success: true,
            draft: {
                leadId,
                leadModel: leadModel || 'Lead',
                email,
                name: context.profile.contactName || name,
                leadName: context.profile.leadName,
                contactTitle: context.profile.contactTitle,
                subject: aiResult.subject,
                body: aiResult.body,
                contextReasoning: aiResult.contextReasoning,
                historySummary: {
                    smsCount: context.smsHistory.length,
                    emailCount: context.emailHistory.length,
                    notesCount: context.notesHistory.length
                }
            }
        });

    } catch (err) {
        console.error('[AI Campaign Single Regenerate Error]:', err);
        next(err);
    }
};

/**
 * POST /api/campaigns/ai-personalized/dispatch
 * Creates the campaign record, dispatches previewed drafts, and triggers background generation for the rest.
 */
export const dispatchAiPersonalizedCampaign = async (req, res, next) => {
    try {
        const { title, segmentId, templateId, drafts, sendAt, campaignGoal, tone } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: 'Campaign title is required.' });
        }

        if (!segmentId) {
            return res.status(400).json({ success: false, message: 'Segment ID is required.' });
        }

        const segment = await EmailSegment.findById(segmentId);
        if (!segment) {
            return res.status(404).json({ success: false, message: 'Target segment not found.' });
        }

        if (!drafts || !Array.isArray(drafts) || drafts.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one draft recipient is required.' });
        }

        const isScheduled = !!sendAt && new Date(sendAt) > new Date();

        const campaign = await EmailCampaign.create({
            title: title.trim(),
            subject: `[AI Personalized] ${title.trim()}`,
            content: '<p>Personalized AI Campaign with individualized copy per recipient.</p>',
            segmentId,
            templateId: templateId || null,
            isAiPersonalized: true,
            aiGoalPrompt: campaignGoal || '',
            status: isScheduled ? 'scheduled' : 'sending',
            sendAt: isScheduled ? new Date(sendAt) : null,
            sentAt: isScheduled ? null : new Date(),
            recipientLogs: drafts.map(d => ({
                leadId: d.leadId || null,
                leadModel: d.leadModel || 'Lead',
                name: d.name || '',
                email: d.email,
                personalizedSubject: d.subject,
                personalizedContent: d.body,
                contextReasoning: d.contextReasoning || '',
                status: 'pending'
            }))
        });

        // 1. Immediately enqueue the preview drafts (NO re-generation)
        if (!isScheduled) {
            const queueItems = drafts.map(d => ({
                campaignId: campaign._id,
                leadId: d.leadId || null,
                leadModel: d.leadModel || 'Lead',
                recipientName: d.name || '',
                email: d.email,
                subject: d.subject,
                body: d.body,
                status: 'pending'
            }));

            await EmailQueue.insertMany(queueItems);

            // Log activity notes for associated leads
            for (const d of drafts) {
                if (d.leadId && d.leadModel === 'Lead') {
                    try {
                        await Note.create({
                            lead_id: d.leadId,
                            content: `Enqueued AI Personalized Campaign: "${d.subject}"`,
                            type: 'email',
                            metadata: {
                                campaignId: campaign._id,
                                campaignTitle: campaign.title,
                                subject: d.subject,
                                isAiPersonalized: true
                            }
                        });
                    } catch (noteErr) {
                        // non-fatal note creation
                    }
                }
            }
        }

        // 2. Asynchronously process remaining recipients on the server in the background
        generateAndEnqueueRemainingAiRecipients({
            campaignId: campaign._id,
            segment,
            existingDrafts: drafts,
            campaignGoal,
            tone,
            templateId,
            isScheduled
        }).catch(err => {
            console.error('[Background AI Dispatch Error]:', err);
        });

        return res.json({
            success: true,
            message: isScheduled 
                ? `AI Personalized Campaign scheduled for ${new Date(sendAt).toLocaleString()} (${drafts.length} personalized email${drafts.length === 1 ? '' : 's'})`
                : `AI Campaign launched! ${drafts.length} reviewed email${drafts.length === 1 ? '' : 's'} enqueued; remaining recipients are being generated in the background.`,
            campaign
        });

    } catch (err) {
        console.error('[AI Campaign Dispatch Error]:', err);
        next(err);
    }
};
