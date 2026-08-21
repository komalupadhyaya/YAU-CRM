import { google } from 'googleapis';
import Note from '../models/note.model.js';
import Lead from '../models/lead.model.js';
import EALead from '../models/eaLead.model.js';
import Contact from '../models/contact.model.js';
import EmailCampaign from '../models/emailCampaign.model.js';
import EmailHistory from '../models/emailHistory.model.js';
import EmailQueue from '../models/emailQueue.model.js';
import { sendSendGridMail } from '../services/email/sendgrid.service.js';
import aiService from '../services/ai/ai.service.js';
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

// --- 1-to-1 Individual Email Sender via SendGrid ---
export const sendEmail = async (req, res, next) => {
    try {
        const { lead_id, leadModel, to, subject, body } = req.body;

        if (!to || !subject || !body) {
            res.status(400);
            throw new Error('Recipient email (to), subject, and body content are required');
        }

        if (lead_id && leadModel !== 'EALead') {
            const lead = await Lead.findById(lead_id).select('assigned_to');
            if (lead && req.currentUserRole === 'sales_rep' && (!lead.assigned_to || lead.assigned_to.toString() !== req.user.id)) {
                res.status(403);
                throw new Error('Access denied. This lead is not assigned to you.');
            }
        }

        console.log(`[1-to-1 SendGrid Dispatch] Sending to: ${to}, Subject: ${subject}`);

        // Send via SendGrid service
        const result = await sendSendGridMail({
            to,
            subject,
            html: body,
            leadId: lead_id || null,
            leadModel: leadModel || (lead_id ? 'Lead' : undefined),
            campaignId: undefined
        });

        // Record in central EmailHistory collection
        const historyDoc = await EmailHistory.create({
            leadId: lead_id || null,
            leadModel: leadModel || 'Lead',
            type: 'direct',
            direction: 'outbound',
            to: to,
            subject: subject,
            body: body,
            status: result.success ? 'delivered' : 'failed',
            messageId: result.messageId || null,
            sentAt: new Date()
        });

        // Record CRM Activity Note
        if (lead_id && leadModel !== 'EALead') {
            await Note.create({
                lead_id,
                type: 'email',
                content: `1-to-1 Email Sent: ${subject}`,
                metadata: { to, subject, body }
            }).catch(() => {});
        }

        return res.json({
            success: true,
            message: 'Email delivered successfully via SendGrid',
            history: historyDoc
        });
    } catch (err) {
        console.error('[SendGrid 1-to-1 Email Error]:', err.message);
        return res.status(500).json({
            success: false,
            message: err.message || 'Failed to deliver email through SendGrid.'
        });
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
            .populate('templateId', 'name category isAiGenerated subject')
            .sort({ createdAt: -1 });
        res.json(campaigns);
    } catch (err) { next(err); }
};

export const getCampaign = async (req, res, next) => {
    try {
        const campaign = await EmailCampaign.findById(req.params.id)
            .populate('segmentId')
            .populate('templateId', 'name category isAiGenerated subject');
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        res.json(campaign);
    } catch (err) { next(err); }
};

export const createCampaign = async (req, res, next) => {
    try {
        const { title, subject, content, segmentId, sendAt, templateId } = req.body;

        let parsedSendAt = null;
        if (sendAt) {
            parsedSendAt = new Date(sendAt);
            if (isNaN(parsedSendAt.getTime()) || parsedSendAt <= new Date()) {
                return res.status(400).json({ error: 'Scheduled time must be in the future.' });
            }
        }

        const campaign = await EmailCampaign.create({
            title,
            subject,
            content,
            segmentId,
            templateId: (templateId && mongoose.Types.ObjectId.isValid(templateId)) ? templateId : null,
            sendAt: parsedSendAt,
            status: parsedSendAt ? 'scheduled' : 'draft'
        });
        const populated = await EmailCampaign.findById(campaign._id)
            .populate('segmentId')
            .populate('templateId', 'name category isAiGenerated subject');
        res.status(201).json(populated || campaign);
    } catch (err) { next(err); }
};

export const updateCampaign = async (req, res, next) => {
    try {
        const { title, subject, content, segmentId, sendAt, status, templateId } = req.body;

        let parsedSendAt = null;
        if (sendAt) {
            parsedSendAt = new Date(sendAt);
            if (isNaN(parsedSendAt.getTime()) || parsedSendAt <= new Date()) {
                return res.status(400).json({ error: 'Scheduled time must be in the future.' });
            }
        }

        const campaign = await EmailCampaign.findByIdAndUpdate(
            req.params.id,
            { 
                title, 
                subject, 
                content, 
                segmentId, 
                templateId: (templateId && mongoose.Types.ObjectId.isValid(templateId)) ? templateId : null,
                sendAt: parsedSendAt,
                status: status || (parsedSendAt ? 'scheduled' : 'draft')
            },
            { new: true }
        ).populate('segmentId').populate('templateId', 'name category isAiGenerated subject');
        res.json(campaign);
    } catch (err) { next(err); }
};

export const deleteCampaign = async (req, res, next) => {
    try {
        const campaign = await EmailCampaign.findByIdAndDelete(req.params.id);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        await EmailQueue.deleteMany({ campaignId: req.params.id, status: 'pending' });
        res.json({ message: 'Campaign deleted successfully', id: req.params.id });
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
            message: `Campaign sent & delivered in background to ${recipients.length} recipients.`, 
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
            message: `Campaign re-sent & delivered in background to ${recipients.length} recipients.`, 
            campaign 
        });
    } catch (err) { next(err); }
};

// Dispatch loop - now queues campaign emails in the database
export const dispatchCampaignInBackground = async (campaign, recipients) => {
    try {
        // Special branch for AI-Personalized Campaigns: individual copy per recipient is already in recipientLogs
        if (campaign.isAiPersonalized && campaign.recipientLogs && campaign.recipientLogs.length > 0) {
            console.log(`[Campaign Queue] Preparing queue injection for AI-Personalized Campaign "${campaign.title}" with ${campaign.recipientLogs.length} recipients.`);
            
            const queueItems = campaign.recipientLogs.map(log => ({
                campaignId: campaign._id,
                leadId: log.leadId || null,
                leadModel: log.leadModel || 'Lead',
                recipientName: log.name || '',
                email: log.email,
                subject: log.personalizedSubject || campaign.subject,
                body: log.personalizedContent || campaign.content,
                status: 'pending'
            }));

            if (queueItems.length > 0) {
                await EmailQueue.insertMany(queueItems);
            }

            console.log(`[Campaign Queue] Successfully queued ${queueItems.length} AI-personalized emails for campaign "${campaign.title}".`);
            return;
        }

        console.log(`[Campaign Queue] Preparing queue injection for "${campaign.title}" with ${(recipients || []).length} recipients.`);
        
        // Generate recipients logs with status "pending"
        campaign.recipientLogs = (recipients || []).map(rec => ({
            leadId: rec.leadId,
            leadModel: rec.leadModel || 'Lead',
            name: rec.name || rec.email.split('@')[0],
            email: rec.email,
            status: 'pending'
        }));
        
        // Save the campaign status as 'sending' with pending recipients
        await campaign.save();

        const queueItems = (recipients || []).map(rec => {
            const personalizedHtml = campaign.content.replace(/\{\{name\}\}/gi, rec.name);
            return {
                campaignId: campaign._id,
                leadId: rec.leadId,
                leadModel: rec.leadModel || 'Lead',
                recipientName: rec.name,
                email: rec.email,
                subject: campaign.subject,
                body: personalizedHtml,
                status: 'pending'
            };
        });

        // Insert into EmailQueue in bulk
        if (queueItems.length > 0) {
            await EmailQueue.insertMany(queueItems);
        }

        console.log(`[Campaign Queue] Successfully queued ${queueItems.length} emails for campaign "${campaign.title}".`);
    } catch (err) {
        console.error(`[Campaign Queue] Failed to queue campaign "${campaign.title}":`, err);
        campaign.status = 'failed';
        await campaign.save();
    }
};

// ── PUBLIC UNSUBSCRIBE PORTAL ───────────────────────────────────────────────

export const unsubscribeLead = async (req, res, next) => {
    try {
        const { leadId } = req.params;
        const { model, campaignId } = req.query;

        let emailToOptOut = (req.query.email ? decodeURIComponent(req.query.email).trim().toLowerCase() : '');

        // Safely check if leadId is a valid MongoDB ObjectId before querying Lead/EALead models
        const isValidLeadId = leadId && mongoose.Types.ObjectId.isValid(leadId) && leadId !== 'direct';

        if (isValidLeadId) {
            if (model === 'EALead') {
                const ea = await EALead.findByIdAndUpdate(leadId, { isEmailConsent: false }, { new: true });
                if (ea && ea.email) emailToOptOut = ea.email.toLowerCase().trim();
            } else {
                const lead = await Lead.findByIdAndUpdate(leadId, { isEmailConsent: false }, { new: true });
                if (lead) {
                    const contact = await Contact.findOne({ lead_id: lead._id, is_primary: true });
                    if (contact && contact.email) emailToOptOut = contact.email.toLowerCase().trim();
                }
            }
        }

        // Opt out from all segment lists matching this email address
        if (emailToOptOut) {
            const EmailSegment = mongoose.model('EmailSegment');
            await EmailSegment.updateMany(
                { "contacts.email": emailToOptOut },
                { $set: { "contacts.$.status": "opted_out" } }
            );
        }

        // Update Campaign recipient logs & statistics if campaignId is present and valid
        if (campaignId && mongoose.Types.ObjectId.isValid(campaignId)) {
            const EmailCampaign = mongoose.model('EmailCampaign');
            const campaign = await EmailCampaign.findById(campaignId);
            if (campaign && campaign.recipientLogs && campaign.recipientLogs.length > 0) {
                const logItem = campaign.recipientLogs.find(log => 
                    (isValidLeadId && log.leadId && log.leadId.toString() === leadId) ||
                    (log.email && emailToOptOut && log.email.toLowerCase().trim() === emailToOptOut)
                );
                if (logItem) {
                    logItem.status = 'unsubscribe';
                    
                    // Recalculate campaign unsubscribe stats
                    let unsubscribesCount = 0;
                    campaign.recipientLogs.forEach(log => {
                        if (log.status === 'unsubscribe') {
                            unsubscribesCount++;
                        }
                    });
                    campaign.stats.unsubscribes = unsubscribesCount;
                    await campaign.save();
                }
            }

            // Update central EmailHistory status
            if (emailToOptOut) {
                const EmailHistory = mongoose.model('EmailHistory');
                await EmailHistory.updateMany(
                    { campaignId, to: emailToOptOut },
                    { $set: { status: 'unsubscribe' } }
                );
            }
        }

        // Return response based on HTTP method
        if (req.method === 'POST') {
            // Support Gmail native List-Unsubscribe background call
            return res.status(200).json({ success: true, message: 'Unsubscribed successfully.', email: emailToOptOut });
        }

        // Render modern, high-end confirmation card directly for browser GET clicks matching official YAU brand palette
        const displayEmail = emailToOptOut || 'your email address';
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Unsubscribed Successfully | Youth Athlete University</title>
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Outfit:wght@700;800;900&display=swap" rel="stylesheet">
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background: radial-gradient(circle at 50% 20%, #101c3d 0%, #080e1e 70%, #040711 100%);
                        color: #f8fafc;
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 24px;
                    }
                    .card {
                        background: #0d172e;
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        border-radius: 28px;
                        padding: 44px 36px 36px;
                        max-width: 500px;
                        width: 100%;
                        box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05);
                        text-align: center;
                        position: relative;
                        overflow: hidden;
                    }
                    .card::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        height: 5px;
                        background: linear-gradient(90deg, #dc2626 0%, #2563eb 50%, #dc2626 100%);
                    }
                    .logo-wrapper {
                        margin-bottom: 24px;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .yau-crest {
                        width: 88px;
                        height: auto;
                        filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.4));
                    }
                    .icon-badge {
                        width: 56px;
                        height: 56px;
                        background: rgba(16, 185, 129, 0.12);
                        border: 1.5px solid rgba(16, 185, 129, 0.35);
                        border-radius: 18px;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        margin-bottom: 20px;
                        box-shadow: 0 10px 20px -5px rgba(16, 185, 129, 0.25);
                    }
                    .brand-pill {
                        display: inline-block;
                        font-size: 10px;
                        font-weight: 800;
                        text-transform: uppercase;
                        letter-spacing: 0.12em;
                        color: #ffffff;
                        background: #dc2626;
                        padding: 4px 14px;
                        border-radius: 100px;
                        margin-bottom: 12px;
                        box-shadow: 0 2px 8px rgba(220, 38, 38, 0.4);
                    }
                    h1 {
                        font-size: 24px;
                        font-weight: 800;
                        color: #ffffff;
                        margin-bottom: 12px;
                        letter-spacing: -0.02em;
                        line-height: 1.3;
                    }
                    .email-badge {
                        display: inline-block;
                        background: rgba(15, 23, 42, 0.85);
                        border: 1px solid rgba(148, 163, 184, 0.2);
                        padding: 7px 16px;
                        border-radius: 10px;
                        font-family: monospace;
                        font-size: 13px;
                        color: #38bdf8;
                        font-weight: 600;
                        margin: 6px 0 18px;
                        word-break: break-all;
                    }
                    p {
                        color: #94a3b8;
                        font-size: 14px;
                        line-height: 1.6;
                        margin-bottom: 24px;
                    }
                    .divider {
                        height: 1px;
                        background: rgba(255, 255, 255, 0.08);
                        margin: 24px 0;
                    }
                    .footer-note {
                        font-size: 12px;
                        color: #64748b;
                        line-height: 1.5;
                    }
                    .footer-note a {
                        color: #38bdf8;
                        text-decoration: none;
                        font-weight: 600;
                        transition: color 0.2s;
                    }
                    .footer-note a:hover {
                        color: #f87171;
                        text-decoration: underline;
                    }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="logo-wrapper">
                        <!-- YAU Official Diamond Shield SVG Crest -->
                        <svg class="yau-crest" viewBox="0 0 160 180" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <!-- Diamond Outer Border -->
                            <polygon points="80,6 154,58 126,168 80,174 34,168 6,58" fill="#ffffff" stroke="#0f3b7d" stroke-width="4"/>
                            <!-- Diamond Red Border -->
                            <polygon points="80,12 148,60 122,162 80,168 38,162 12,60" fill="#dc2626"/>
                            <!-- Diamond Inner Navy Shield -->
                            <polygon points="80,18 142,62 118,156 80,162 42,156 18,62" fill="#0f2b5c"/>
                            
                            <!-- White & Red Diagonal Team Stripes in Center -->
                            <path d="M52 75 L108 75 L104 87 L48 87 Z" fill="#ffffff"/>
                            <path d="M50 89 L110 89 L106 101 L46 101 Z" fill="#dc2626"/>
                            
                            <!-- Bold Athletic YAU Letters -->
                            <text x="80" y="78" font-family="'Outfit', 'Arial Black', sans-serif" font-weight="900" font-size="34" fill="#ffffff" text-anchor="middle" letter-spacing="1">YAU</text>
                            
                            <!-- Ribbon Banner -->
                            <rect x="26" y="106" width="108" height="20" rx="3" fill="#dc2626"/>
                            <text x="80" y="120" font-family="'Plus Jakarta Sans', sans-serif" font-weight="800" font-size="8.5" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">YOUTH ATHLETE</text>
                            
                            <!-- University Subtext -->
                            <rect x="36" y="128" width="88" height="15" rx="2" fill="#ffffff"/>
                            <text x="80" y="139" font-family="'Plus Jakarta Sans', sans-serif" font-weight="800" font-size="8" fill="#0f2b5c" text-anchor="middle" letter-spacing="0.5">UNIVERSITY</text>
                            
                            <!-- Bottom Chevron Stripes -->
                            <polygon points="76,146 80,158 84,146" fill="#dc2626"/>
                        </svg>
                    </div>

                    <div class="icon-badge">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                    </div>

                    <div>
                        <span class="brand-pill">Youth Athlete University</span>
                        <h1>Unsubscribed Successfully</h1>
                        <div class="email-badge">${displayEmail}</div>
                        <p>You have been removed from our marketing mailing list. You will no longer receive marketing or promotional campaign emails from Youth Athlete University.</p>
                    </div>
                    <div class="divider"></div>
                    <div class="footer-note">
                        Was this a mistake? If you wish to resubscribe or have questions, please reach out to us at <a href="mailto:support@youthathleteuniversity.org">support@youthathleteuniversity.org</a>.
                    </div>
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
                    (h.campaignId && h.campaignId.toString() === camp._id.toString()) ||
                    (h.campaignTitle && camp.title && h.campaignTitle === camp.title && Math.abs(new Date(h.timestamp) - new Date(camp.sentAt || camp.createdAt)) < 5000)
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
