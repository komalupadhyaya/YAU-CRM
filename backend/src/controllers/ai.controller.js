/**
 * ai.controller.js
 * ─────────────────────────────────────────────────────────────────
 * Express Controller handling AI API Endpoints for YAU CRM.
 * ─────────────────────────────────────────────────────────────────
 */

import EALead from '../models/eaLead.model.js';
import Lead from '../models/lead.model.js';
import Settings from '../models/settings.model.js';
import WeeklyReport from '../models/weeklyReport.model.js';
import { scoreAndUpdateLead } from '../services/ai/scoring.service.js';
import { acceptNextAction } from '../services/ai/nextAction.service.js';
import { generateWeeklyReport } from '../services/ai/weeklyReport.service.js';
import twilio from 'twilio';

let twilioClient = null;
function getTwilioClient() {
    if (!twilioClient && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    }
    return twilioClient;
}

// 1. Manual Score Override
export const overrideLeadScore = async (req, res) => {
    try {
        const { id } = req.params;
        const { score, reason, leadType = 'ea_lead' } = req.body;

        if (!['Hot', 'Warm', 'Cold'].includes(score)) {
            return res.status(400).json({ success: false, message: 'Invalid score tier. Must be Hot, Warm, or Cold.' });
        }

        let lead = leadType === 'ea_lead' ? await EALead.findById(id) : await Lead.findById(id);
        if (!lead) return res.status(404).json({ success: false, message: 'Lead not found.' });

        lead.aiScore = {
            score,
            reason: reason || 'Manually set by admin.',
            scoreUpdated: new Date(),
            isManualOverride: true
        };

        await lead.save();
        res.json({ success: true, aiScore: lead.aiScore });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 2. Re-trigger AI Lead Rescore
export const rescoreLead = async (req, res) => {
    try {
        const { id } = req.params;
        const { leadType = 'ea_lead' } = req.query;

        const aiScore = await scoreAndUpdateLead(id, leadType, true);
        if (!aiScore) return res.status(404).json({ success: false, message: 'Lead not found or rescore failed.' });

        res.json({ success: true, aiScore });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 3. Approve AI Reply Draft
export const approveReplyDraft = async (req, res) => {
    try {
        const { id } = req.params;
        const { leadType = 'ea_lead', customText } = req.body;

        let lead = leadType === 'ea_lead' ? await EALead.findById(id) : await Lead.findById(id);
        if (!lead || !lead.aiReplyDraft?.text) {
            return res.status(404).json({ success: false, message: 'No active AI draft found for lead.' });
        }

        const messageToSend = customText || lead.aiReplyDraft.text;
        const targetPhone = lead.phone || lead.telephone;

        const client = getTwilioClient();
        const fromNumber = process.env.TWILIO_PHONE_NUMBER;
        let twilioSid = null;
        let smsStatus = 'sent';

        if (client && fromNumber && targetPhone && lead.isConsent !== false) {
            try {
                const twRes = await client.messages.create({
                    body: messageToSend,
                    from: fromNumber,
                    to: targetPhone
                });
                twilioSid = twRes.sid;
            } catch (twErr) {
                console.error('[AI Approve Reply] Twilio error:', twErr.message);
                smsStatus = 'failed';
            }
        }

        lead.smsHistory.push({
            direction: 'outbound',
            message: messageToSend,
            timestamp: new Date(),
            status: smsStatus,
            twilioSid,
            sentBy: 'ai'
        });

        lead.aiReplyDraft.status = 'approved';
        await lead.save();

        res.json({ success: true, message: 'Reply draft approved and sent.', lead });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 4. Dismiss AI Reply Draft
export const dismissReplyDraft = async (req, res) => {
    try {
        const { id } = req.params;
        const { leadType = 'ea_lead' } = req.body;

        let lead = leadType === 'ea_lead' ? await EALead.findById(id) : await Lead.findById(id);
        if (!lead) return res.status(404).json({ success: false, message: 'Lead not found.' });

        if (lead.aiReplyDraft) {
            lead.aiReplyDraft.status = 'dismissed';
            await lead.save();
        }

        res.json({ success: true, message: 'Reply draft dismissed.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 5. Get Stalled Leads List & Statistics
export const getStalledLeads = async (req, res) => {
    try {
        const eaStalled = await EALead.find({ 'stalledInfo.isStalled': true }).populate('assigned_to', 'name email');
        const mainStalled = await Lead.find({ 'stalledInfo.isStalled': true }).populate('assigned_to', 'name email');

        const combined = [
            ...eaStalled.map(l => ({ ...l.toObject(), leadType: 'ea_lead' })),
            ...mainStalled.map(l => ({ ...l.toObject(), leadType: 'main_lead' }))
        ];

        res.json({
            success: true,
            totalStalledCount: combined.length,
            stalledLeads: combined
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 6. Send Stalled Lead Follow-Up
export const sendStalledFollowup = async (req, res) => {
    try {
        const { id } = req.params;
        const { leadType = 'ea_lead', customMessage } = req.body;

        let lead = leadType === 'ea_lead' ? await EALead.findById(id) : await Lead.findById(id);
        if (!lead) return res.status(404).json({ success: false, message: 'Lead not found.' });

        const messageToSend = customMessage || lead.stalledInfo?.draftFollowup || `Hi ${lead.name}, following up from YAU Sports!`;
        const targetPhone = lead.phone || lead.telephone;

        const client = getTwilioClient();
        const fromNumber = process.env.TWILIO_PHONE_NUMBER;
        let twilioSid = null;
        let smsStatus = 'sent';

        if (client && fromNumber && targetPhone && lead.isConsent !== false) {
            try {
                const twRes = await client.messages.create({
                    body: messageToSend,
                    from: fromNumber,
                    to: targetPhone
                });
                twilioSid = twRes.sid;
            } catch (twErr) {
                console.error('[AI Stalled Send] Twilio error:', twErr.message);
                smsStatus = 'failed';
            }
        }

        lead.smsHistory.push({
            direction: 'outbound',
            message: messageToSend,
            timestamp: new Date(),
            status: smsStatus,
            twilioSid,
            sentBy: 'ai'
        });

        lead.stalledInfo.isStalled = false;
        await lead.save();

        res.json({ success: true, message: 'Stalled lead follow-up sent and alert cleared.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 7. Accept Next Action Suggestion
export const acceptNextActionEndpoint = async (req, res) => {
    try {
        const { id } = req.params;
        const { leadType = 'ea_lead' } = req.body;

        const task = await acceptNextAction(id, leadType, req.user?._id);
        res.json({ success: true, message: 'Next action accepted and task created successfully.', task });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 8. Dismiss Next Action Suggestion
export const dismissNextActionEndpoint = async (req, res) => {
    try {
        const { id } = req.params;
        const { leadType = 'ea_lead' } = req.body;

        let lead = leadType === 'ea_lead' ? await EALead.findById(id) : await Lead.findById(id);
        if (lead) {
            lead.aiNextAction = null;
            await lead.save();
        }

        res.json({ success: true, message: 'Next action recommendation dismissed.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 9. Fetch Latest Weekly AI Performance Report
export const getLatestWeeklyReport = async (req, res) => {
    try {
        const latestReport = await WeeklyReport.findOne().sort({ createdAt: -1 });
        res.json({ success: true, report: latestReport });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 10. Trigger Manual Generation of Weekly Report
export const triggerWeeklyReportGeneration = async (req, res) => {
    try {
        const report = await generateWeeklyReport();
        res.json({ success: true, message: 'Weekly report generated successfully.', report });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 11. Get AI Settings
export const getAiSettings = async (req, res) => {
    try {
        let settings = await Settings.findOne();
        res.json({ success: true, aiSettings: settings?.aiSettings || {} });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 12. Update AI Settings
export const updateAiSettings = async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) settings = new Settings();

        settings.aiSettings = {
            ...(settings.aiSettings || {}),
            ...req.body
        };

        await settings.save();
        res.json({ success: true, aiSettings: settings.aiSettings });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
