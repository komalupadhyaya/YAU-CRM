import { google } from 'googleapis';
import Note from '../models/note.model.js';
import Lead from '../models/lead.model.js';
import EALead from '../models/eaLead.model.js';
import Contact from '../models/contact.model.js';
import EmailCampaign from '../models/emailCampaign.model.js';
import EmailHistory from '../models/emailHistory.model.js';
import { sendSendGridMail } from '../services/sendgrid.service.js';
import aiService from '../services/ai.service.js';
import dns from 'dns/promises';
import mongoose from 'mongoose';
import { resolveSegmentRecipients } from './segments.controller.js';

// --- Existing google verify domain ---
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
    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
      return res.json({ success: true, valid: false, message: 'Domain does not exist' });
    }
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

// --- Existing individual OAuth Gmail sender ---
export const sendEmail = async (req, res, next) => {
    try {
        const { lead_id, to, cc, subject, body } = req.body;

        if (!to || !subject || !body) {
            res.status(400);
            throw new Error('to, subject, and body are required');
        }

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
        console.log("Sending Email - To:", to, "Subject:", subject);

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
            requestBody: { raw: encodedMessage },
        });

        if (lead_id) {
            await Note.create({
                lead_id,
                type: 'email',
                content: `Email Sent: ${subject}${cc ? ` (CC: ${cc})` : ''}`,
                metadata: { to, cc, subject, body }
            });
        }

        await EmailHistory.create({
            leadId: lead_id || null,
            type: 'direct',
            direction: 'outbound',
            to: to,
            cc: cc || '',
            subject: subject,
            body: body,
            status: 'sent',
            sentAt: new Date()
        });

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

// --- Existing AI generate draft ---
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

        if (leadType !== 'ea_lead' && req.currentUserRole === 'sales_rep') {
            const assignedId = lead.assigned_to ? lead.assigned_to.toString() : null;
            if (assignedId && assignedId !== req.user.id) {
                return res.status(403).json({ error: 'Access denied. This lead is not assigned to you.' });
            }
        }

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

// ── CAMPAIGNS CRUD ──────────────────────────────────────────────────────────

export const getCampaigns = async (req, res, next) => {
    try {
        const campaigns = await EmailCampaign.find()
            .populate('segmentId')
            .sort({ createdAt: -1 });
        res.json(campaigns);
    } catch (err) { next(err); }
};

export const getCampaign = async (req, res, next) => {
    try {
        const campaign = await EmailCampaign.findById(req.params.id).populate('segmentId');
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        res.json(campaign);
    } catch (err) { next(err); }
};

export const createCampaign = async (req, res, next) => {
    try {
        const { title, subject, content, segmentId, sendAt, templateId } = req.body;
        const campaign = await EmailCampaign.create({
            title,
            subject,
            content,
            segmentId,
            templateId: templateId || null,
            sendAt: sendAt ? new Date(sendAt) : null,
            status: sendAt ? 'scheduled' : 'draft'
        });
        res.status(201).json(campaign);
    } catch (err) { next(err); }
};

export const updateCampaign = async (req, res, next) => {
    try {
        const { title, subject, content, segmentId, sendAt, status, templateId } = req.body;
        const campaign = await EmailCampaign.findByIdAndUpdate(
            req.params.id,
            { 
                title, 
                subject, 
                content, 
                segmentId, 
                templateId,
                sendAt: sendAt ? new Date(sendAt) : null,
                status: status || (sendAt ? 'scheduled' : 'draft')
            },
            { new: true }
        );
        res.json(campaign);
    } catch (err) { next(err); }
};

// Immediately dispatch or queue/schedule a campaign
export const sendCampaign = async (req, res, next) => {
    try {
        const campaign = await EmailCampaign.findById(req.params.id).populate('segmentId');
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        // If scheduled for future
        if (campaign.sendAt && campaign.sendAt > new Date()) {
            campaign.status = 'scheduled';
            await campaign.save();
            return res.json({ success: true, message: 'Campaign successfully scheduled', campaign });
        }

        campaign.status = 'sending';
        await campaign.save();

        // Resolve Segment
        const recipients = await resolveSegmentRecipients(campaign.segmentId);
        
        // Dispatch in background
        dispatchCampaignInBackground(campaign, recipients);

        res.json({ 
            success: true, 
            message: `Dispatched campaign in background to ${recipients.length} recipients.`, 
            campaign 
        });
    } catch (err) { next(err); }
};

// Re-run an existing campaign (re-dispatches to current segment contacts)
export const rerunCampaign = async (req, res, next) => {
    try {
        const campaign = await EmailCampaign.findById(req.params.id).populate('segmentId');
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        // Reset status and stats for re-run
        campaign.status = 'sending';
        campaign.stats = {
            sent: 0,
            delivered: 0,
            opens: 0,
            clicks: 0,
            unsubscribes: 0,
            bounces: 0
        };
        campaign.recipientLogs = [];
        await campaign.save();

        // Resolve Segment Contacts
        const recipients = await resolveSegmentRecipients(campaign.segmentId);
        
        // Dispatch in background
        dispatchCampaignInBackground(campaign, recipients);

        res.json({ 
            success: true, 
            message: `Re-dispatched campaign in background to ${recipients.length} recipients.`, 
            campaign 
        });
    } catch (err) { next(err); }
};

// Dispatch loop
export const dispatchCampaignInBackground = async (campaign, recipients) => {
    let sentCount = 0;
    const recipientLogs = [];

    for (const rec of recipients) {
        const personalizedHtml = campaign.content.replace(/\{\{name\}\}/gi, rec.name);

        const result = await sendSendGridMail({
            to: rec.email,
            subject: campaign.subject,
            html: personalizedHtml,
            leadId: rec.leadId,
            leadModel: rec.leadModel,
            campaignId: campaign._id
        });

        const logStatus = result.success ? 'sent' : 'failed';
        const msgId = result.success ? result.messageId : null;
        const errStr = result.success ? null : result.error;

        recipientLogs.push({
            leadId: rec.leadId,
            leadModel: rec.leadModel,
            name: rec.name || rec.email.split('@')[0],
            email: rec.email,
            status: logStatus,
            error: errStr,
            messageId: msgId
        });

        // Store into central EmailHistory collection!
        await EmailHistory.create({
            leadId: rec.leadId || null,
            leadModel: rec.leadModel || 'Lead',
            campaignId: campaign._id,
            campaignTitle: campaign.title,
            type: 'bulk',
            direction: 'outbound',
            recipientName: rec.name || '',
            to: rec.email,
            subject: campaign.subject,
            body: personalizedHtml,
            status: logStatus,
            error: errStr,
            messageId: msgId,
            sentAt: new Date()
        });

        if (result.success) {
            sentCount++;
        }
    }

    campaign.status = 'sent';
    campaign.sentAt = new Date();
    campaign.stats.sent = sentCount;
    campaign.recipientLogs = recipientLogs;
    await campaign.save();

    console.log(`[SendGrid Campaign] Dispatch complete. Title: "${campaign.title}" | Sent to ${sentCount}/${recipients.length} recipients.`);
};

// ── PUBLIC UNSUBSCRIBE PORTAL ───────────────────────────────────────────────

export const unsubscribeLead = async (req, res, next) => {
    try {
        const { leadId } = req.params;
        const { model } = req.query; // 'Lead' or 'EALead'

        let emailToOptOut = '';

        if (model === 'EALead') {
            const ea = await EALead.findByIdAndUpdate(leadId, { isEmailConsent: false });
            if (ea) emailToOptOut = ea.email;
        } else {
            const lead = await Lead.findByIdAndUpdate(leadId, { isEmailConsent: false });
            if (lead) {
                const contact = await Contact.findOne({ lead_id: lead._id, is_primary: true });
                if (contact) emailToOptOut = contact.email;
            }
        }

        // Also opt out from all segments containing this email
        const emailQuery = req.query.email || emailToOptOut;
        if (emailQuery) {
            const cleanEmail = emailQuery.trim().toLowerCase();
            const EmailSegment = mongoose.model('EmailSegment');
            await EmailSegment.updateMany(
                { "contacts.email": cleanEmail },
                { $set: { "contacts.$.status": "opted_out" } }
            );
        }

        // Render confirmation page directly
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Unsubscribed Successfully</title>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
                <style>
                    body {
                        font-family: 'Inter', sans-serif;
                        background: #f8fafc;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        margin: 0;
                    }
                    .card {
                        background: white;
                        padding: 30px;
                        border-radius: 16px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                        text-align: center;
                        max-width: 400px;
                        width: 90%;
                    }
                    h2 { color: #0f172a; margin-top: 0; }
                    p { color: #64748b; font-size: 14px; line-height: 1.6; }
                    .icon { font-size: 40px; margin-bottom: 15px; }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="icon">✉️</div>
                    <h2>Unsubscribed</h2>
                    <p>You have been successfully removed from our mailing list. You will no longer receive marketing emails from Youth Athlete University.</p>
                </div>
            </body>
            </html>
        `);
    } catch (err) { next(err); }
};

export const getEmailConversations = async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.currentUserRole;
        const isPrivileged = userRole === 'admin' || userRole === 'manager';

        // 1. Fetch central EmailHistory logs
        const emailHistoryDocs = await EmailHistory.find().sort({ sentAt: -1 }).lean();

        // 2. Fetch legacy email notes
        const emailNotes = await Note.find({ type: 'email' }).lean();

        // 3. Fetch legacy campaigns with recipient logs
        const allCampaigns = await EmailCampaign.find({ 'recipientLogs.0': { $exists: true } }).lean();

        // Collect all lead IDs and email addresses that have email activity
        const leadIdsWithActivity = new Set(emailHistoryDocs.map(h => h.leadId?.toString()).filter(Boolean));
        const emailsWithActivity = new Set(emailHistoryDocs.map(h => h.to?.toLowerCase().trim()).filter(Boolean));

        emailNotes.forEach(n => {
            if (n.lead_id) leadIdsWithActivity.add(n.lead_id.toString());
            if (n.metadata?.to) emailsWithActivity.add(n.metadata.to.toLowerCase().trim());
        });

        allCampaigns.forEach(camp => {
            camp.recipientLogs.forEach(log => {
                if (log.leadId) leadIdsWithActivity.add(log.leadId.toString());
                if (log.email) emailsWithActivity.add(log.email.toLowerCase().trim());
            });
        });

        // Gather EALeads
        const eaQuery = isPrivileged ? {} : { assigned_to: userId };
        const eaLeads = await EALead.find(eaQuery).lean();

        // Gather main CRM leads
        const mainQuery = isPrivileged ? {} : { assigned_to: userId };
        const mainLeads = await Lead.find(mainQuery).lean();

        const conversations = [];
        const processedEmails = new Set();

        // 1. Process EALeads (ONLY if they have received email activity)
        for (const ea of eaLeads) {
            const eaEmail = ea.email ? ea.email.toLowerCase().trim() : '';
            const hasActivity = leadIdsWithActivity.has(ea._id.toString()) || (eaEmail && emailsWithActivity.has(eaEmail));
            if (!hasActivity) continue; // Skip leads with no email activity!

            let lastMessage = 'Campaign Email Dispatched';
            let lastTime = ea.updatedAt;

            // Check EmailHistory collection first
            const leadHistories = emailHistoryDocs.filter(h => 
                (h.leadId && h.leadId.toString() === ea._id.toString()) || 
                (eaEmail && h.to && h.to.toLowerCase().trim() === eaEmail)
            );

            if (leadHistories.length > 0) {
                const latest = leadHistories[0]; // Already sorted sentAt: -1
                lastMessage = latest.type === 'bulk' ? `Campaign: ${latest.campaignTitle} - ${latest.subject}` : `Direct: ${latest.subject}`;
                lastTime = latest.sentAt || latest.createdAt;
            } else {
                // Fallback to legacy campaign logs / notes
                const eaNotes = emailNotes.filter(n => n.lead_id?.toString() === ea._id.toString());
                const leadCampaigns = allCampaigns.filter(c => c.recipientLogs.some(l => l.leadId?.toString() === ea._id.toString() || (l.email && l.email.toLowerCase() === eaEmail)));
                
                if (leadCampaigns.length > 0) {
                    const lastCamp = leadCampaigns.sort((a, b) => new Date(b.sentAt || b.createdAt).getTime() - new Date(a.sentAt || a.createdAt).getTime())[0];
                    lastMessage = `Campaign: ${lastCamp.title} - ${lastCamp.subject}`;
                    lastTime = lastCamp.sentAt || lastCamp.createdAt;
                }

                if (eaNotes.length > 0) {
                    const lastNote = eaNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                    if (new Date(lastNote.createdAt).getTime() > new Date(lastTime).getTime()) {
                        lastMessage = lastNote.content;
                        lastTime = lastNote.createdAt;
                    }
                }
            }

            conversations.push({
                _id: ea._id,
                leadType: 'ea_lead',
                name: ea.name,
                email: ea.email,
                phone: ea.phone,
                categoryTag: 'EA Lead',
                isConsent: ea.isEmailConsent !== false,
                lastMessage: lastMessage,
                lastMessageTimestamp: lastTime
            });

            if (eaEmail) processedEmails.add(eaEmail);
        }

        // 2. Process Main CRM Leads (ONLY if they have received email activity)
        const leadIds = mainLeads.map(l => l._id);
        const contacts = await Contact.find({ lead_id: { $in: leadIds } }).lean();

        for (const lead of mainLeads) {
            const leadContacts = contacts.filter(c => c.lead_id.toString() === lead._id.toString());
            const primaryContact = leadContacts.find(c => c.is_primary) || leadContacts[0];
            const email = primaryContact?.email ? primaryContact.email.toLowerCase().trim() : '';

            const hasActivity = leadIdsWithActivity.has(lead._id.toString()) || (email && emailsWithActivity.has(email));
            if (!hasActivity) continue; // Skip leads with no email activity!

            let lastMessage = 'Campaign Email Dispatched';
            let lastTime = lead.updatedAt;

            const leadHistories = emailHistoryDocs.filter(h => 
                (h.leadId && h.leadId.toString() === lead._id.toString()) || 
                (email && h.to && h.to.toLowerCase().trim() === email)
            );

            if (leadHistories.length > 0) {
                const latest = leadHistories[0];
                lastMessage = latest.type === 'bulk' ? `Campaign: ${latest.campaignTitle} - ${latest.subject}` : `Direct: ${latest.subject}`;
                lastTime = latest.sentAt || latest.createdAt;
            } else {
                const leadNotes = emailNotes.filter(n => n.lead_id?.toString() === lead._id.toString());
                const leadCampaigns = allCampaigns.filter(c => c.recipientLogs.some(l => l.leadId?.toString() === lead._id.toString() || (email && l.email && l.email.toLowerCase() === email)));
                
                if (leadCampaigns.length > 0) {
                    const lastCamp = leadCampaigns.sort((a, b) => new Date(b.sentAt || b.createdAt).getTime() - new Date(a.sentAt || a.createdAt).getTime())[0];
                    lastMessage = `Campaign: ${lastCamp.title} - ${lastCamp.subject}`;
                    lastTime = lastCamp.sentAt || lastCamp.createdAt;
                }

                if (leadNotes.length > 0) {
                    const lastNote = leadNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                    if (new Date(lastNote.createdAt).getTime() > new Date(lastTime).getTime()) {
                        lastMessage = lastNote.content;
                        lastTime = lastNote.createdAt;
                    }
                }
            }

            const displayName = primaryContact?.name ? `${lead.name} (${primaryContact.name})` : lead.name;

            conversations.push({
                _id: lead._id,
                leadType: 'main_lead',
                name: displayName,
                email: primaryContact?.email || '',
                phone: primaryContact?.direct_phone || lead.telephone || '',
                categoryTag: 'CRM Lead',
                isConsent: lead.isEmailConsent !== false,
                lastMessage: lastMessage,
                lastMessageTimestamp: lastTime
            });

            if (email) processedEmails.add(email);
        }

        // 3. Process remaining EmailHistory recipients (CSV segment contacts or manual email recipients)
        for (const historyDoc of emailHistoryDocs) {
            const docEmail = historyDoc.to ? historyDoc.to.toLowerCase().trim() : '';
            if (!docEmail || processedEmails.has(docEmail)) continue;

            const contactHistories = emailHistoryDocs.filter(h => h.to && h.to.toLowerCase().trim() === docEmail);
            const latest = contactHistories[0];

            conversations.push({
                _id: historyDoc.leadId || historyDoc._id,
                leadType: historyDoc.leadModel === 'EALead' ? 'ea_lead' : 'main_lead',
                name: latest.recipientName || docEmail.split('@')[0],
                email: latest.to,
                phone: '',
                categoryTag: 'Segment Contact',
                isConsent: true,
                lastMessage: latest.type === 'bulk' ? `Campaign: ${latest.campaignTitle} - ${latest.subject}` : `Direct: ${latest.subject}`,
                lastMessageTimestamp: latest.sentAt || latest.createdAt
            });

            processedEmails.add(docEmail);
        }

        // Sort by recency
        conversations.sort((a, b) => new Date(b.lastMessageTimestamp).getTime() - new Date(a.lastMessageTimestamp).getTime());

        res.json(conversations);
    } catch (err) {
        console.error('Error fetching email conversations:', err);
        res.status(500).json({ error: 'Failed to load conversations' });
    }
};

export const getEmailHistory = async (req, res) => {
    try {
        const { leadId } = req.params;

        // Fetch lead email if present
        let contactEmail = '';
        if (leadId && leadId.includes('@')) {
            contactEmail = leadId.toLowerCase().trim();
        } else if (leadId) {
            const eaLead = await EALead.findById(leadId).catch(() => null);
            if (eaLead) {
                contactEmail = eaLead.email;
            } else {
                const leadContacts = await Contact.find({ lead_id: leadId }).catch(() => []);
                if (leadContacts.length > 0) {
                    contactEmail = (leadContacts.find(c => c.is_primary) || leadContacts[0]).email;
                } else {
                    const histDoc = await EmailHistory.findById(leadId).catch(() => null);
                    if (histDoc) {
                        contactEmail = histDoc.to;
                    }
                }
            }
        }

        const historyMap = new Map();

        // 1. Fetch records from central EmailHistory collection
        const isObjectId = mongoose.Types.ObjectId.isValid(leadId);
        const historyDocs = await EmailHistory.find({
            $or: [
                { leadId: isObjectId ? leadId : null },
                { _id: isObjectId ? leadId : null },
                ...(contactEmail ? [{ to: contactEmail.toLowerCase().trim() }] : [])
            ].filter(Boolean)
        }).sort({ sentAt: 1 }).lean();

        historyDocs.forEach(rec => {
            historyMap.set(rec._id.toString(), {
                _id: rec._id,
                direction: rec.direction || 'outbound',
                campaignTitle: rec.campaignTitle || '',
                subject: rec.subject,
                body: rec.body,
                cc: rec.cc || '',
                to: rec.to,
                timestamp: rec.sentAt || rec.createdAt,
                type: rec.type, // 'direct' or 'bulk'
                status: rec.status || 'sent',
                error: rec.error || null
            });
        });

        // 2. Fetch legacy email notes
        if (isObjectId) {
            const notes = await Note.find({ 
                lead_id: leadId, 
                type: 'email' 
            }).sort({ createdAt: 1 }).lean();

            notes.forEach(note => {
                const subject = note.metadata?.subject || 'Direct Email Note';
                const body = note.metadata?.body || note.content;
                const to = note.metadata?.to || contactEmail;
                const cc = note.metadata?.cc || '';

                const isAlreadyMapped = Array.from(historyMap.values()).some(h => 
                    h.subject === subject && Math.abs(new Date(h.timestamp) - new Date(note.createdAt)) < 5000
                );

                if (!isAlreadyMapped) {
                    historyMap.set(`note-${note._id}`, {
                        _id: note._id,
                        direction: 'outbound',
                        subject: subject,
                        body: body,
                        cc: cc,
                        to: to,
                        timestamp: note.createdAt,
                        type: 'direct',
                        status: 'delivered'
                    });
                }
            });
        }

        // 3. Fetch legacy EmailCampaign recipientLogs
        const campaigns = await EmailCampaign.find({
            $or: [
                ...(isObjectId ? [{ 'recipientLogs.leadId': leadId }] : []),
                ...(contactEmail ? [{ 'recipientLogs.email': contactEmail.toLowerCase().trim() }] : [])
            ].filter(Boolean)
        }).lean();

        campaigns.forEach(camp => {
            const logItems = camp.recipientLogs.filter(log => 
                (isObjectId && log.leadId && log.leadId.toString() === leadId) || 
                (contactEmail && log.email && log.email.toLowerCase() === contactEmail.toLowerCase())
            );
            logItems.forEach((logItem, idx) => {
                const isAlreadyMapped = Array.from(historyMap.values()).some(h => 
                    h.campaignTitle === camp.title && Math.abs(new Date(h.timestamp) - new Date(camp.sentAt || camp.createdAt)) < 5000
                );

                if (!isAlreadyMapped) {
                    historyMap.set(`camp-${camp._id}-${logItem._id || idx}`, {
                        _id: `${camp._id}-${logItem._id || idx}`,
                        direction: 'outbound',
                        campaignTitle: camp.title,
                        subject: camp.subject,
                        body: camp.content,
                        cc: '',
                        to: logItem.email,
                        timestamp: camp.sentAt || camp.createdAt,
                        type: 'bulk',
                        status: logItem.status || 'sent',
                        error: logItem.error || null
                    });
                }
            });
        });

        // Sort chronologically
        const emailHistory = Array.from(historyMap.values()).sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        res.json(emailHistory);
    } catch (err) {
        console.error('Error fetching email history:', err);
        res.status(500).json({ error: 'Failed to load email history thread' });
    }
};
