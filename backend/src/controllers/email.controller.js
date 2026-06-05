import { google } from 'googleapis';
import Note from '../models/note.model.js';
import Lead from '../models/lead.model.js';
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
