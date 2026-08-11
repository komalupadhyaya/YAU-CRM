import { google } from 'googleapis';
import Note from '../models/note.model.js';
import Lead from '../models/lead.model.js';
import EALead from '../models/eaLead.model.js';
import aiService from '../services/ai.service.js';
import dns from 'dns/promises';

export const verifyEmailDomain = async (req, res) => {
  const { email } = req.query;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'Invalid email' });
  }

  const domain = email.split('@')[1];
  try {
    const mxRecords = await dns.resolveMx(domain);
    if (mxRecords && mxRecords.length > 0) {
      return res.json({ success: true, valid: true });
    }
    return res.json({ success: true, valid: false, message: 'No active mail servers found' });
  } catch (err) {
    // Only mark as invalid if we are SURE the domain doesn't exist
    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
      return res.json({ success: true, valid: false, message: 'Domain does not exist' });
    }
    // For network timeouts or other errors, we assume it's valid to avoid false positives
    return res.json({ success: true, valid: true });
  }
};

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

if (process.env.GOOGLE_REFRESH_TOKEN) {
  oAuth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
}

export const sendEmail = async (req, res, next) => {
    try {
        const { lead_id, to, cc, subject, body } = req.body;

        if (!to || !subject || !body) {
            res.status(400);
            throw new Error('to, subject, and body are required');
        }

        // Sales Rep ownership check
        if (lead_id) {
            const lead = await Lead.findById(lead_id).select('assigned_to');
            if (!lead) {
                res.status(404);
                throw new Error('Lead not found');
            }
            if (req.currentUserRole === 'sales_rep' && (!lead.assigned_to || lead.assigned_to.toString() !== req.user.id)) {
                res.status(403);
                throw new Error('Access denied. This lead is not assigned to you.');
            }
        }

        const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

        // Encode the email
        console.log("Sending Email - To:", to, "Subject:", subject);
        console.log("Body length:", body.length, "Content preview:", body.substring(0, 50));

        // Encode the email
        const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
        const messageParts = [
            `To: ${to}`,
            cc ? `Cc: ${cc}` : null,
            'Content-Type: text/html; charset=utf-8',
            'MIME-Version: 1.0',
            `Subject: ${utf8Subject}`,
            '',
            `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">${body.replace(/\n/g, '<br/>')}</div>`,
        ].filter(v => v !== null);
        
        const message = messageParts.join('\r\n');
        const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage,
            },
        });

        // Log to activity feed
        if (lead_id) {
            await Note.create({
                lead_id,
                type: 'email',
                content: `Email Sent: ${subject}${cc ? ` (CC: ${cc})` : ''}`,
                metadata: { to, cc, subject, body }
            });
        }

        res.json({ success: true });
    } catch (err) {
        console.error("Gmail Send Error:", err.message);
        if (err.response && err.response.data) {
            return res.status(err.response.status || 500).json({
                success: false,
                message: err.message,
                details: err.response.data
            });
        }
        next(err);
    }
};

/**
 * Generate an AI-suggested Email subject and body for a lead
 * POST /api/emails/ai-generate-email
 *
 * Body: { leadId, leadType, contactId, contactName, userPrompt }
 * Returns: { success: true, subject: "...", body: "..." }
 */
export const generateEmailMessage = async (req, res) => {
    try {
        const { leadId, leadType, contactName, userPrompt } = req.body;

        if (!leadId) {
            return res.status(400).json({ error: 'leadId is required' });
        }

        let lead = null;
        if (leadType === 'ea_lead') {
            lead = await EALead.findById(leadId).lean();
        } else {
            lead = await Lead.findById(leadId).lean();
        }

        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        // Sales rep access check for main leads
        if (leadType !== 'ea_lead' && req.currentUserRole === 'sales_rep') {
            const assignedId = lead.assigned_to ? lead.assigned_to.toString() : null;
            if (assignedId && assignedId !== req.user.id) {
                return res.status(403).json({ error: 'Access denied. This lead is not assigned to you.' });
            }
        }

        // Fetch recent notes for context
        let recentNotes = [];
        try {
            const notes = await Note.find({ lead_id: leadId }).sort({ createdAt: -1 }).limit(5).lean();
            recentNotes = notes.map(n => ({
                type: n.type,
                content: n.content,
                date: n.createdAt
            }));
        } catch (e) {
            console.warn('Could not fetch notes for email AI context:', e.message);
        }

        const personName = contactName || lead.contacts?.[0]?.name || lead.main_contact_name || '';
        const personTitle = lead.contacts?.[0]?.title || '';

        const result = await aiService.generateEmailMessage({
            leadName:     lead.name,
            contactName:  personName,
            contactTitle: personTitle,
            leadStatus:   lead.status,
            leadCategory: lead.category_group || lead.type || '',
            recentNotes,
            userPrompt:   userPrompt || ''
        });

        return res.json({
            success: true,
            subject: result.subject,
            body:    result.body
        });

    } catch (error) {
        console.error('AI Generate Email Error:', error);
        return res.status(500).json({
            error: error.message || 'Failed to generate AI email'
        });
    }
};

