import axios from 'axios';
import twilio from 'twilio';
import EALead from '../models/eaLead.model.js';
import Lead from '../models/lead.model.js';
import Contact from '../models/contact.model.js';
import Note from '../models/note.model.js';
import Campaign from '../models/campaign.model.js';
import RetellKnowledgeBase from '../models/retellKnowledgeBase.model.js';
import aiService from '../services/ai/ai.service.js';
import { getCCAccessToken } from '../utils/constantContact.js';
import { sendEAWelcomeEmail } from '../services/email/mailer.js';

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

/**
 * Formats a phone number string to E.164 format required by Twilio
 */
export function formatPhoneForTwilio(phone) {
    const trimmed = (phone || '').trim();
    const clean = trimmed.replace(/\D/g, '');
    
    // If it has 10 digits, it's a US local number (e.g. 9896233745 or +9896233745)
    if (clean.length === 10) {
        return `+1${clean}`;
    }
    
    // If it already starts with '+' (e.g., +91... or +1...), keep as is
    if (trimmed.startsWith('+')) {
        return trimmed.replace(/\s+/g, '');
    }
    
    // If it has 11 digits and starts with 1, it's a US number with country code (e.g. 15555555555)
    if (clean.length === 11 && clean.startsWith('1')) {
        return `+${clean}`;
    }
    
    // Fallback: prepend '+' to digits (e.g. 919896233745 -> +919896233745)
    return `+${clean}`;
}

/**
 * Syncs lead to Constant Contact list using OAuth client credentials token
 */
async function addToConstantContact(name, email) {
    try {
        const token = await getCCAccessToken();
        
        // Split name into first and last name
        const nameParts = name.trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        await axios.post(
            'https://api.cc.email/v3/contacts',
            {
                email_address: { address: email, permission_scheme: 'implicit' },
                first_name: firstName,
                last_name: lastName,
                create_source: 'Contact',
                list_memberships: [process.env.CC_LIST_ID]
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log(`✅ Added ${email} to Constant Contact list`);
    } catch (err) {
        console.error('❌ Constant Contact sync failed:', err.response?.data || err.message);
    }
}

/**
 * Sends the auto welcome text via Twilio with AI generation and fallback mechanism.
 * Guaranteed to execute strictly once per lead (deduplicated by welcomeSmsSent flag).
 * Maximum length: 140 characters.
 */
async function sendWelcomeSMS(leadInput, io = null) {
    try {
        if (!leadInput?._id) return;

        // Atomic check: Re-fetch lead to check welcomeSmsSent flag
        const lead = await EALead.findById(leadInput._id);
        if (!lead || lead.welcomeSmsSent === true || lead.isConsent === false) {
            console.log(`[Welcome SMS] Skipped for lead "${lead?.name || leadInput._id}" (already sent or consent revoked).`);
            return;
        }

        // Check Twilio configuration
        const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;
        if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
            console.error('[Welcome SMS] Twilio credentials not configured.');
            return;
        }

        const fullPhone = formatPhoneForTwilio(lead.phone);
        const firstName = lead.name ? lead.name.trim().split(/\s+/)[0] : 'there';
        const fallbackText = `Hey ${firstName}! Welcome to YAU Sports. We're excited to help your athlete. Which sport are you looking into?`;

        let welcomeMessage = '';
        let isAiGenerated = false;

        // 1. Try generating with AI (max 140 chars)
        try {
            const knowledgeBase = await RetellKnowledgeBase.getOrCreateDefault();
            const aiDraft = await aiService.generateEALeadWelcomeSms({
                leadName: lead.name,
                source: lead.source,
                knowledgeBase
            });

            if (aiDraft && aiDraft.trim()) {
                welcomeMessage = aiDraft.trim().slice(0, 140);
                isAiGenerated = true;
                console.log(`[Welcome SMS] ✅ Claude AI generated welcome text (${welcomeMessage.length} chars): "${welcomeMessage}"`);
            }
        } catch (aiErr) {
            console.warn('[Welcome SMS] ⚠️ AI generation failed, falling back to default message:', aiErr.message);
        }

        // 2. Fallback to handcoded default if AI failed or returned empty
        if (!welcomeMessage || !welcomeMessage.trim()) {
            welcomeMessage = fallbackText.slice(0, 140);
            isAiGenerated = false;
            console.log(`[Welcome SMS] ℹ️ Using handcoded default welcome text (${welcomeMessage.length} chars): "${welcomeMessage}"`);
        }

        let twilioSid = null;
        let msgStatus = 'pending';
        const statusCallbackUrl = `${process.env.BACKEND_URL}/api/webhooks/twilio-sms-status`;

        try {
            const twilioMsg = await twilioClient.messages.create({
                body: welcomeMessage,
                from: TWILIO_PHONE_NUMBER,
                to: fullPhone,
                statusCallback: statusCallbackUrl
            });
            twilioSid = twilioMsg.sid;
            console.log(`✅ Welcome SMS sent to ${fullPhone} (SID: ${twilioMsg.sid})`);
        } catch (twilioErr) {
            console.warn(`[Welcome SMS] ⚠️ Twilio dispatch error (saving to history):`, twilioErr.message);
            msgStatus = 'sent';
        }

        // 3. Mark welcomeSmsSent = true and save outbound message to history
        lead.welcomeSmsSent = true;
        lead.welcomeSmsSentAt = new Date();

        const smsEntry = {
            direction: 'outbound',
            message: welcomeMessage,
            timestamp: new Date(),
            isBulk: false,
            status: msgStatus,
            twilioSid: twilioSid,
            isRead: true,
            isAiReply: isAiGenerated
        };

        if (!lead.smsHistory) lead.smsHistory = [];
        lead.smsHistory.push(smsEntry);
        await lead.save();

        // 4. Emit socket event for real-time CRM UI update
        if (io) {
            io.emit('sms:sent', {
                leadId: lead._id,
                leadType: 'ea_lead',
                message: smsEntry
            });
        }
    } catch (err) {
        console.error('❌ Failed in sendWelcomeSMS:', err.message);
    }
}

/**
 * Handle form submissions (Public Endpoint)
 * POST /api/ea-leads/submit
 */
export const submitEALead = async (req, res) => {
    try {
        console.log('--- EA LEAD FORM SUBMISSION RECEIVED ---', req.body);
        let { name, email, phone, areaCode, phoneNum, source, isConsent } = req.body;

        // If form submits areaCode and phoneNum separately, combine them
        if (areaCode && phoneNum) {
            phone = `${areaCode}${phoneNum}`;
        }

        // Basic validation
        if (!name || !email || !phone) {
            return res.status(400).json({ 
                success: false, 
                message: 'Name, email, and phone number are required fields.' 
            });
        }

        const cleanEmail = email.trim().toLowerCase();
        const cleanPhone = phone.trim();
        const hasConsent = isConsent === undefined ? true : (isConsent === true || isConsent === 'true' || isConsent === 'on' || isConsent === 1 || isConsent === '1');

        // Format number to ensure E.164 format (with country code like +1 or +91)
        let formattedPhone;
        if (areaCode && phoneNum) {
            formattedPhone = `+1${areaCode}${phoneNum}`;
        } else {
            formattedPhone = formatPhoneForTwilio(cleanPhone);
        }

        // Duplicate check: Look for a lead with matching email OR phone (using exact string or last 10 digits regex)
        const digitsPhone = formattedPhone.replace(/\D/g, '');
        const last10Phone = digitsPhone.slice(-10);

        // Build flexible regex to match phone regardless of formatting characters
        const flexibleRegex = last10Phone.length >= 7 
            ? last10Phone.split('').map(d => `${d}\\D*`).join('') + '$'
            : null;

        let duplicateLead = await EALead.findOne({
            $or: [
                { email: cleanEmail },
                { phone: formattedPhone },
                ...(flexibleRegex ? [{ phone: { $regex: flexibleRegex } }] : [])
            ]
        });

        if (duplicateLead) {
            console.log(`Duplicate EA Lead found for email "${cleanEmail}" or phone "${formattedPhone}". Returning conflict.`);
            duplicateLead.submissionCount += 1;
            duplicateLead.dateSubmitted = new Date();
            await duplicateLead.save();

            const welcomeMessage = "Welcome back! It looks like you've already completed this form. Click below to continue to the next step .";

            const acceptsJson = req.headers.accept && req.headers.accept.includes('application/json');
            const isJsonRequest = req.headers['content-type'] && req.headers['content-type'].includes('application/json');

            if (acceptsJson || isJsonRequest) {
                return res.status(409).json({
                    success: false,
                    message: welcomeMessage,
                    lead_id: duplicateLead._id,
                    alreadySubmitted: true
                });
            } else {
                return res.status(409).send(welcomeMessage);
            }
        }

        // If no duplicate is found, create a new lead
        console.log(`Creating new EA Lead for email "${cleanEmail}"...`);
        let lead = await EALead.create({
            name: name.trim(),
            email: cleanEmail,
            phone: formattedPhone,
            source: source ? source.trim() : 'YAU Website',
            isConsent: hasConsent,
            dateSubmitted: new Date(),
            submissionCount: 1
        });

        // Fire-and-forget integrations (background execution)
        addToConstantContact(lead.name, lead.email);
        
        if (hasConsent) {
            sendWelcomeSMS(lead, req.app?.get('io'));
        }

        sendEAWelcomeEmail({ name: lead.name, email: lead.email });

        // Determine redirect vs JSON response
        const acceptsJson = req.headers.accept && req.headers.accept.includes('application/json');
        const isJsonRequest = req.headers['content-type'] && req.headers['content-type'].includes('application/json');

        const redirectUrl = 'https://youthathleteuniversity.org/love/';

        if (acceptsJson || isJsonRequest) {
            return res.status(200).json({
                success: true,
                message: 'Lead captured successfully',
                redirectUrl,
                lead_id: lead._id,
                lead
            });
        } else {
            // Browser native form submit redirect
            return res.redirect(302, redirectUrl);
        }

    } catch (error) {
        console.error('EA Lead Submission Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error processing lead submission',
            error: error.message
        });
    }
};

/**
 * Fetch all EA leads (Protected)
 * GET /api/ea-leads
 */
export const getEALeads = async (req, res) => {
    try {
        const leads = await EALead.find().sort({ dateSubmitted: -1 });
        return res.status(200).json(leads);
    } catch (error) {
        console.error('Error fetching EA leads:', error);
        return res.status(500).json({ error: 'Failed to fetch EA leads' });
    }
};

/**
 * Fetch a single EA lead by ID (Protected)
 * GET /api/ea-leads/:id
 */
export const getEALeadById = async (req, res) => {
    try {
        const lead = await EALead.findById(req.params.id).lean();
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        // Fetch authoritative calls from Call collection for this EA Lead
        const Call = (await import('../models/call.model.js')).default;
        const callRecords = await Call.find({
            $or: [
                { ea_lead_id: lead._id },
                { lead_id: lead._id },
                ...(lead.calls && lead.calls.length > 0 ? [{ _id: { $in: lead.calls } }] : []),
                ...(lead.phone ? [{ fromNumber: { $regex: new RegExp(lead.phone.replace(/\D/g, '').slice(-10) + '$') } }, { toNumber: { $regex: new RegExp(lead.phone.replace(/\D/g, '').slice(-10) + '$') } }] : [])
            ]
        }).sort({ timestamp: -1 }).lean();

        // Merge call records into lead.callHistory ensuring fresh AI summaries
        const callMap = new Map();
        callRecords.forEach(c => {
            const key = c.callSid || c.retellCallId || c._id.toString();
            callMap.set(key, {
                _id: c._id,
                callSid: c.callSid,
                parentCallSid: c.parentCallSid,
                direction: c.direction,
                duration: c.duration,
                recordingUrl: c.recordingUrl,
                status: c.status,
                timestamp: c.timestamp,
                source: c.source || 'twilio',
                retellCallId: c.retellCallId,
                aiSummary: c.aiSummary,
                callerSentiment: c.callerSentiment,
                transcript: c.transcript
            });
        });

        if (lead.callHistory && lead.callHistory.length > 0) {
            lead.callHistory.forEach(c => {
                const key = c.callSid || c.retellCallId || c._id?.toString();
                if (key && !callMap.has(key)) {
                    callMap.set(key, c);
                }
            });
        }

        const consolidatedCallHistory = Array.from(callMap.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return res.status(200).json({ ...lead, callHistory: consolidatedCallHistory });
    } catch (error) {
        console.error('Error fetching EA lead:', error);
        return res.status(500).json({ error: 'Failed to fetch lead details' });
    }
};

/**
 * Update an EA lead by ID (Protected)
 * PUT /api/ea-leads/:id
 */
export const updateEALead = async (req, res) => {
    try {
        const { name, email, phone, source, dateSubmitted, isConsent } = req.body;
        
        const lead = await EALead.findById(req.params.id);
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        // Check duplicate email or phone among other EA Leads
        if (email || phone) {
            const cleanEmail = email ? email.trim().toLowerCase() : undefined;
            const formattedPhone = phone ? formatPhoneForTwilio(phone) : undefined;
            
            const orConditions = [];
            if (cleanEmail) orConditions.push({ email: cleanEmail });
            if (formattedPhone) {
                orConditions.push({ phone: formattedPhone });
                const digitsPhone = formattedPhone.replace(/\D/g, '');
                const last10Phone = digitsPhone.slice(-10);
                const flexibleRegex = last10Phone.length >= 7 
                    ? last10Phone.split('').map(d => `${d}\\D*`).join('') + '$'
                    : null;
                if (flexibleRegex) {
                    orConditions.push({ phone: { $regex: flexibleRegex } });
                }
            }

            if (orConditions.length > 0) {
                const duplicateLead = await EALead.findOne({
                    _id: { $ne: req.params.id },
                    $or: orConditions
                });

                if (duplicateLead) {
                    return res.status(400).json({ error: 'A lead with this email or phone number already exists.' });
                }
            }
        }

        if (name) lead.name = name.trim();
        if (email) lead.email = email.trim().toLowerCase();
        if (phone) lead.phone = formatPhoneForTwilio(phone);
        if (source) lead.source = source.trim();
        if (dateSubmitted) lead.dateSubmitted = new Date(dateSubmitted);
        if (isConsent !== undefined) lead.isConsent = !!isConsent;

        await lead.save();
        console.log(`EA Lead "${lead.name}" (ID: ${lead._id}) updated successfully.`);

        return res.status(200).json(lead);
    } catch (error) {
        console.error('Error updating EA lead:', error);
        return res.status(500).json({ error: 'Failed to update lead details' });
    }
};

/**
 * Delete an EA lead by ID (Protected)
 * DELETE /api/ea-leads/:id
 */
export const deleteEALead = async (req, res) => {
    try {
        const lead = await EALead.findByIdAndDelete(req.params.id);
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }
        console.log(`EA Lead "${lead.name}" (ID: ${lead._id}) deleted successfully.`);
        return res.status(200).json({ message: 'Lead deleted successfully' });
    } catch (error) {
        console.error('Error deleting EA lead:', error);
        return res.status(500).json({ error: 'Failed to delete lead' });
    }
};

/**
 * Send bulk SMS to selected EA leads
 * POST /api/ea-leads/bulk-sms
 */
export const sendBulkSMS = async (req, res) => {
    try {
        const { message, leadIds } = req.body;
        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message content is required.' });
        }

        const filter = {};
        if (leadIds && leadIds.length > 0) {
            filter._id = { $in: leadIds };
        }
        // Only send to consented leads
        filter.isConsent = { $ne: false };

        const leads = await EALead.find(filter);
        if (leads.length === 0) {
            return res.status(200).json({ message: 'No leads found matching the criteria with SMS consent.' });
        }

        let successCount = 0;
        let failCount = 0;

        for (const lead of leads) {
            if (!lead.phone) {
                failCount++;
                console.warn(`[Bulk SMS] Skipping lead ${lead._id} — no phone number.`);
                continue;
            }

            const fullPhone = formatPhoneForTwilio(lead.phone);
            console.log(`[Bulk SMS] Attempting send to: ${fullPhone} (original: ${lead.phone})`);
            
            // Support {{name}} personalization
            const personalizedMessage = message.replace(/\{\{name\}\}/gi, lead.name);

            try {
                const statusCallbackUrl = `${process.env.BACKEND_URL}/api/webhooks/twilio-sms-status`;
                const twilioMsg = await twilioClient.messages.create({
                    body: personalizedMessage,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: fullPhone,
                    statusCallback: statusCallbackUrl
                });
                console.log(`[Bulk SMS] ✅ Queued to ${fullPhone} (SID: ${twilioMsg.sid})`);

                // Save as 'pending' — real status will be updated via statusCallback webhook
                lead.smsHistory.push({
                    direction: 'outbound',
                    message: personalizedMessage,
                    timestamp: new Date(),
                    isBulk: true,
                    status: 'pending',
                    twilioSid: twilioMsg.sid
                });
                await lead.save();

                successCount++;
            } catch (err) {
                console.error(`[Bulk SMS] ❌ Twilio API rejected send to ${fullPhone} (lead: ${lead._id}):`, err.message, err.code || '');

                // API-level failure (e.g. invalid format, account error) — save as failed immediately
                lead.smsHistory.push({
                    direction: 'outbound',
                    message: personalizedMessage,
                    timestamp: new Date(),
                    isBulk: true,
                    status: 'failed',
                    twilioSid: null
                });
                await lead.save();

                failCount++;
            }
        }

        return res.status(200).json({
            success: successCount > 0,
            successCount,
            failCount,
            message: failCount === 0
                ? `Bulk SMS sent successfully to ${successCount} lead${successCount !== 1 ? 's' : ''}.`
                : successCount === 0
                    ? `Bulk SMS failed for all ${failCount} lead${failCount !== 1 ? 's' : ''}. Check Twilio configuration and Console logs.`
                    : `Bulk SMS sent to ${successCount} lead${successCount !== 1 ? 's' : ''}, but failed for ${failCount}. Check Twilio Console logs for details.`
        });
    } catch (error) {
        console.error('Bulk SMS Error:', error);
        return res.status(500).json({ error: 'Failed to process bulk SMS.' });
    }
};

/**
 * Send 1-on-1 SMS to a single EA lead
 * POST /api/ea-leads/:id/send-sms
 */
export const sendSingleSMS = async (req, res) => {
    try {
        const { message } = req.body;
        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message content is required.' });
        }

        const lead = await EALead.findById(req.params.id);
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        if (lead.isConsent === false) {
            return res.status(400).json({ error: 'This recipient has opted out of SMS communication (sent STOP).' });
        }

        if (!lead.phone) {
            return res.status(400).json({ error: 'Lead does not have a valid phone number.' });
        }

        const fullPhone = formatPhoneForTwilio(lead.phone);

        try {
            const statusCallbackUrl = `${process.env.BACKEND_URL}/api/webhooks/twilio-sms-status`;
            const twilioMsg = await twilioClient.messages.create({
                body: message,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: fullPhone,
                statusCallback: statusCallbackUrl
            });
            console.log(`[Single SMS] ✅ Queued to ${fullPhone} (SID: ${twilioMsg.sid})`);

            // Save as 'pending' — real status will be updated via statusCallback webhook
            lead.smsHistory.push({
                direction: 'outbound',
                message: message,
                timestamp: new Date(),
                isBulk: false,
                status: 'pending',
                twilioSid: twilioMsg.sid
            });
            await lead.save();

            return res.status(200).json(lead);
        } catch (err) {
            console.error(`Twilio SMS send failure:`, err.message);
            return res.status(500).json({ error: `Twilio send failed: ${err.message}` });
        }
    } catch (error) {
        console.error('Send single SMS Error:', error);
        return res.status(500).json({ error: 'Failed to send SMS.' });
    }
};

/**
 * Create an EA Lead manually (Protected)
 * POST /api/ea-leads
 */
export const createEALead = async (req, res) => {
    try {
        console.log('--- EA LEAD MANUAL CREATION ---', req.body);
        let { name, email, phone, source, isConsent } = req.body;

        // Basic validation
        if (!name || !email || !phone) {
            return res.status(400).json({ 
                success: false, 
                message: 'Name, email, and phone number are required fields.' 
            });
        }

        const cleanEmail = email.trim().toLowerCase();
        const cleanPhone = phone.trim();
        const hasConsent = isConsent === undefined ? true : !!isConsent;

        // Duplicate check
        const digitsPhone = cleanPhone.replace(/\D/g, '');
        const last10Phone = digitsPhone.slice(-10);

        // Build flexible regex to match phone regardless of formatting characters
        const flexibleRegex = last10Phone.length >= 7 
            ? last10Phone.split('').map(d => `${d}\\D*`).join('') + '$'
            : null;

        let duplicateLead = await EALead.findOne({
            $or: [
                { email: cleanEmail },
                { phone: cleanPhone },
                ...(flexibleRegex ? [{ phone: { $regex: flexibleRegex } }] : [])
            ]
        });

        if (duplicateLead) {
            return res.status(409).json({
                success: false,
                message: 'A lead with this email or phone number already exists.',
                lead_id: duplicateLead._id,
                alreadySubmitted: true
            });
        }

        let lead = await EALead.create({
            name: name.trim(),
            email: cleanEmail,
            phone: cleanPhone,
            source: source ? source.trim() : 'Manual Add',
            isConsent: hasConsent,
            dateSubmitted: new Date(),
            submissionCount: 1
        });

        // Format number for Twilio to ensure +1 format
        const fullPhone = formatPhoneForTwilio(cleanPhone);

        // Fire-and-forget integrations
        addToConstantContact(lead.name, lead.email);
        
        if (hasConsent) {
            sendWelcomeSMS(lead, req.app?.get('io'));
        }

        sendEAWelcomeEmail({ name: lead.name, email: lead.email });

        return res.status(201).json(lead);

    } catch (error) {
        console.error('EA Lead Manual Creation Error:', error);
        return res.status(500).json({ error: 'Failed to create lead details' });
    }
};

/**
 * Convert an EA Lead into a main CRM Lead
 * POST /api/ea-leads/:id/convert
 */
export const convertEALead = async (req, res) => {
    try {
        const {
            campaignId,
            name, type, category_group, department, telephone, telephone_extension, website, start_time, end_time,
            address_number, address, city, state, zip,
            // Primary Contact Person
            main_contact_name, contact_title, contact_department, contact_direct_phone, contact_extension, contact_email, contact_best_time, contact_preferred_method,
            // Secondary Contact
            secondary_contact_name, secondary_contact_title, secondary_contact_department, secondary_contact_phone, secondary_contact_extension, secondary_contact_email
        } = req.body;
        
        if (!campaignId || !name || !main_contact_name || !contact_title || !contact_department || !contact_direct_phone || !contact_email || !contact_best_time || !contact_preferred_method) {
            return res.status(400).json({ error: 'All primary contact details, campaign, and organization name are required.' });
        }

        const eaLead = await EALead.findById(req.params.id);
        if (!eaLead) {
            return res.status(404).json({ error: 'EA Lead not found.' });
        }

        let resolvedCampaignId = campaignId;
        if (campaignId === 'default-ea-lead-campaign') {
            let campaign = await Campaign.findOne({ name: { $regex: /^ea-lead$/i } });
            if (!campaign) {
                campaign = await Campaign.create({ name: 'EA-Lead' });
                console.log('[Convert EA Lead] Automatically created "EA-Lead" campaign.');
            }
            resolvedCampaignId = campaign._id;
        }

        // Check if lead already exists in target campaign by contact email or direct phone
        const cleanEmail = contact_email.trim().toLowerCase();
        const cleanPhone = contact_direct_phone.trim();

        const campaignLeads = await Lead.find({ campaign_id: resolvedCampaignId }, '_id');
        const leadIdsInCampaign = campaignLeads.map(l => l._id);

        if (leadIdsInCampaign.length > 0) {
            const duplicateContact = await Contact.findOne({
                lead_id: { $in: leadIdsInCampaign },
                $or: [
                    { email: cleanEmail },
                    { direct_phone: cleanPhone }
                ]
            });

            if (duplicateContact) {
                return res.status(400).json({ 
                    error: 'A contact with this email or phone number already exists in the selected campaign.' 
                });
            }
        }

        // Create main CRM Lead
        const mainLead = await Lead.create({
            campaign_id: resolvedCampaignId,
            name: name.trim(),
            type,
            category_group,
            department,
            telephone,
            telephone_extension,
            website,
            start_time,
            end_time,
            address_number,
            address,
            city,
            state,
            zip,
            status: 'Not Contacted',
            assigned_to: null
        });

        // Create primary contact for the new Lead using the submitted details
        await Contact.create({
            lead_id: mainLead._id,
            name: main_contact_name.trim(),
            email: contact_email.trim().toLowerCase(),
            direct_phone: contact_direct_phone,
            extension: contact_extension,
            title: contact_title,
            department: contact_department.trim(),
            best_time: contact_best_time,
            preferred_method: contact_preferred_method,
            is_primary: true
        });

        // Create secondary contact if name is provided
        if (secondary_contact_name && secondary_contact_name.trim()) {
            await Contact.create({
                lead_id: mainLead._id,
                name: secondary_contact_name.trim(),
                title: secondary_contact_title,
                department: secondary_contact_department,
                direct_phone: secondary_contact_phone,
                extension: secondary_contact_extension,
                email: secondary_contact_email,
                is_primary: false
            });
        }

        // Migrate SMS message history to Note documents in the main Lead's activity feed and save to smsHistory
        if (eaLead.smsHistory && eaLead.smsHistory.length > 0) {
            const notesToCreate = eaLead.smsHistory.map(msg => {
                const directionText = msg.direction === 'inbound' ? 'RECEIVED from' : 'SENT to';
                return {
                    lead_id: mainLead._id,
                    type: 'sms',
                    content: `SMS ${directionText} ${eaLead.phone}:\n${msg.message}`,
                    createdAt: msg.timestamp || new Date(),
                    updatedAt: msg.timestamp || new Date()
                };
            });
            await Note.insertMany(notesToCreate);

            mainLead.smsHistory = eaLead.smsHistory;
            await mainLead.save();
        }

        // Delete the original EA Lead
        await EALead.findByIdAndDelete(eaLead._id);

        console.log(`EA Lead "${eaLead.name}" successfully converted to main Lead "${mainLead.name}".`);

        return res.status(200).json({
            success: true,
            message: 'EA Lead successfully converted to main CRM Lead.',
            leadId: mainLead._id
        });
    } catch (error) {
        console.error('Error converting EA Lead:', error);
        return res.status(500).json({ error: 'Failed to convert EA Lead to main Lead.' });
    }
};

/**
 * Update the AI lead score manually from the UI
 * Sets aiScoreOverride: true to lock the score against AI automatic recalculations.
 * PUT /api/ea-leads/:id/score
 */
export const updateEALeadScore = async (req, res) => {
    try {
        const { id } = req.params;
        const { score, reason } = req.body;

        if (!score || !['Hot', 'Warm', 'Cold'].includes(score)) {
            return res.status(400).json({ error: 'Valid score (Hot, Warm, or Cold) is required.' });
        }

        const eaLead = await EALead.findById(id);
        if (!eaLead) {
            return res.status(404).json({ error: 'EA Lead not found.' });
        }

        eaLead.aiScore = score;
        eaLead.aiScoreReason = reason || 'Manually updated by Team Member';
        eaLead.aiScoreOverride = true;
        eaLead.aiScoreUpdatedAt = new Date();
        await eaLead.save();

        const io = req.app.get('io');
        if (io) {
            io.emit('ea_lead:score_updated', {
                leadId: eaLead._id,
                aiScore: eaLead.aiScore,
                aiScoreReason: eaLead.aiScoreReason,
                aiScoreOverride: eaLead.aiScoreOverride,
                aiScoreUpdatedAt: eaLead.aiScoreUpdatedAt
            });
        }

        return res.status(200).json({
            success: true,
            lead: {
                _id: eaLead._id,
                aiScore: eaLead.aiScore,
                aiScoreReason: eaLead.aiScoreReason,
                aiScoreOverride: eaLead.aiScoreOverride,
                aiScoreUpdatedAt: eaLead.aiScoreUpdatedAt
            }
        });
    } catch (error) {
        console.error('Error updating EA Lead score:', error);
        return res.status(500).json({ error: 'Failed to update EA Lead score.' });
    }
};

