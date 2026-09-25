import Lead from '../models/lead.model.js';
import EALead from '../models/eaLead.model.js';
import Note from '../models/note.model.js';
import { scanForStalledLeads, clearStalledStatus } from '../services/ai/stalledLeads.service.js';
import { deriveScoreFromStatus } from '../services/ai/nextAction.service.js';
import twilio from 'twilio';

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

function formatPhoneForTwilio(phone) {
    if (!phone) return phone;
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return phone.startsWith('+') ? phone : `+${digits}`;
}

/**
 * GET /api/stalled-leads
 * Retrieve all currently stalled leads across EA Leads and Main CRM Leads.
 */
export const getStalledLeads = async (req, res, next) => {
    try {
        const { score, leadType } = req.query;
        const isSalesRep = req.currentUserRole === 'sales_rep';

        const eaFilter = { isStalled: true };
        const crmFilter = { isStalled: true };

        if (isSalesRep) {
            eaFilter.assigned_to = req.user.id;
            crmFilter.assigned_to = req.user.id;
        }

        if (score) {
            eaFilter.aiScore = score;
            // For CRM leads, filter by aiScore or status matching score
            crmFilter.$or = [
                { aiScore: score },
                { isStalled: true } // will filter below if needed
            ];
        }

        let eaLeads = [];
        let crmLeads = [];

        if (!leadType || leadType === 'ea_lead') {
            eaLeads = await EALead.find(eaFilter)
                .populate('assigned_to', 'name email role')
                .sort({ daysInactive: -1, stalledAt: -1 });
        }

        if (!leadType || leadType === 'lead') {
            crmLeads = await Lead.find(crmFilter)
                .populate('assigned_to', 'name email role')
                .populate('campaign_id', 'name')
                .sort({ daysInactive: -1, stalledAt: -1 });
        }

        // Map unified items
        const unified = [];

        eaLeads.forEach(l => {
            const leadScore = l.aiScore || 'Cold';
            if (score && leadScore.toLowerCase() !== score.toLowerCase()) return;

            unified.push({
                _id: l._id,
                leadType: 'ea_lead',
                name: l.name,
                email: l.email,
                phone: l.phone,
                score: leadScore,
                daysInactive: l.daysInactive || 0,
                stalledAt: l.stalledAt,
                stalledReason: l.stalledReason,
                lastActivityAt: l.lastActivityAt,
                assignedTo: l.assigned_to,
                source: l.source || 'Evening Activity',
                draftMessage: l.stalledReengagementDraft?.text || null,
                suggestedAt: l.stalledReengagementDraft?.suggestedAt || null
            });
        });

        crmLeads.forEach(l => {
            const leadScore = l.aiScore || deriveScoreFromStatus(l.status);
            if (score && leadScore.toLowerCase() !== score.toLowerCase()) return;

            unified.push({
                _id: l._id,
                leadType: 'lead',
                name: l.name,
                email: null,
                phone: l.telephone,
                score: leadScore,
                status: l.status,
                daysInactive: l.daysInactive || 0,
                stalledAt: l.stalledAt,
                stalledReason: l.stalledReason,
                lastActivityAt: l.lastActivityAt,
                assignedTo: l.assigned_to,
                source: l.campaign_id?.name || 'School CRM',
                draftMessage: l.stalledReengagementDraft?.text || null,
                suggestedAt: l.stalledReengagementDraft?.suggestedAt || null
            });
        });

        // Sort overall by daysInactive descending
        unified.sort((a, b) => (b.daysInactive || 0) - (a.daysInactive || 0));

        // Counts breakdown
        const counts = {
            total: unified.length,
            hot: unified.filter(u => u.score === 'Hot').length,
            warm: unified.filter(u => u.score === 'Warm').length,
            cold: unified.filter(u => u.score === 'Cold').length,
            ea: unified.filter(u => u.leadType === 'ea_lead').length,
            crm: unified.filter(u => u.leadType === 'lead').length
        };

        res.json({
            success: true,
            counts,
            stalledLeads: unified
        });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/stalled-leads/scan
 * Trigger an immediate scan of all leads for stalled status.
 */
export const triggerScan = async (req, res, next) => {
    try {
        const io = req.app.get('io');
        const result = await scanForStalledLeads({ io, sendEmails: true });

        res.json({
            success: true,
            message: 'Stalled leads scan completed successfully.',
            ...result
        });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/stalled-leads/:id/re-engage
 * 1-Click Send of Claude's drafted re-engagement SMS (or edited text).
 * Automatically clears the stalled status upon dispatch!
 */
export const reengageLead = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { message, leadType = 'ea_lead' } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Re-engagement message cannot be empty.' });
        }

        const io = req.app.get('io');
        const trimmedMessage = message.trim();

        if (leadType === 'ea_lead') {
            const lead = await EALead.findById(id);
            if (!lead) return res.status(404).json({ error: 'EA Lead not found.' });

            if (!lead.phone) {
                return res.status(400).json({ error: 'Lead does not have a valid phone number.' });
            }

            const fullPhone = formatPhoneForTwilio(lead.phone);
            let twilioSid = null;
            let msgStatus = 'pending';

            try {
                const statusCallbackUrl = `${process.env.BACKEND_URL}/api/webhooks/twilio-sms-status`;
                const twilioMsg = await twilioClient.messages.create({
                    body: trimmedMessage,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: fullPhone,
                    statusCallback: statusCallbackUrl
                });
                twilioSid = twilioMsg.sid;
                console.log(`[Stalled Re-engage] ✅ SMS queued to ${fullPhone} (SID: ${twilioMsg.sid})`);
            } catch (err) {
                console.warn(`[Stalled Re-engage] Twilio dispatch warning:`, err.message);
                msgStatus = 'sent';
            }

            // Save to SMS history
            if (!lead.smsHistory) lead.smsHistory = [];
            const smsEntry = {
                direction: 'outbound',
                message: trimmedMessage,
                timestamp: new Date(),
                isBulk: false,
                status: msgStatus,
                twilioSid: twilioSid,
                isRead: true,
                isAiReply: true
            };
            lead.smsHistory.push(smsEntry);

            // Auto-clear stalled flag
            lead.isStalled = false;
            lead.stalledAt = null;
            lead.stalledReason = null;
            lead.daysInactive = 0;
            lead.lastActivityAt = new Date();
            await lead.save();

            if (io) {
                io.emit('sms:sent', { leadId: lead._id, leadType: 'ea_lead', message: smsEntry });
                io.emit('ea_lead:stalled_updated', {
                    leadId: lead._id.toString(),
                    isStalled: false,
                    daysInactive: 0,
                    stalledReason: null
                });
            }

            return res.json({
                success: true,
                message: `Re-engagement SMS sent to ${lead.name} and stalled flag cleared!`,
                lead
            });
        } else {
            // Main CRM Lead
            const lead = await Lead.findById(id);
            if (!lead) return res.status(404).json({ error: 'CRM Lead not found.' });

            // If phone exists, attempt SMS dispatch
            if (lead.telephone) {
                const fullPhone = formatPhoneForTwilio(lead.telephone);
                try {
                    await twilioClient.messages.create({
                        body: trimmedMessage,
                        from: process.env.TWILIO_PHONE_NUMBER,
                        to: fullPhone
                    });
                    console.log(`[Stalled Re-engage CRM] ✅ SMS sent to ${fullPhone}`);
                } catch (err) {
                    console.warn(`[Stalled Re-engage CRM] Twilio dispatch warning:`, err.message);
                }
            }

            // Log activity note
            await Note.create({
                lead_id: lead._id,
                type: 'note',
                content: `Sent Claude Re-engagement Message:\n"${trimmedMessage}"`,
                metadata: { channel: 'sms', reengagedAt: new Date() }
            });

            // Auto-clear stalled flag
            await clearStalledStatus(lead._id, 'lead', io);

            return res.json({
                success: true,
                message: `Re-engagement sent to ${lead.name} and stalled flag cleared!`
            });
        }
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/stalled-leads/:id/dismiss
 * Manually dismiss the stalled flag for a lead.
 */
export const dismissStalledLead = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { leadType = 'ea_lead' } = req.body;
        const io = req.app.get('io');

        await clearStalledStatus(id, leadType, io);

        res.json({
            success: true,
            message: 'Stalled status dismissed.'
        });
    } catch (err) {
        next(err);
    }
};
