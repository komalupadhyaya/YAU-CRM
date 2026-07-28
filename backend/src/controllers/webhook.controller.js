import { Lead } from '../models/lead.model.js';
import { Contact } from '../models/contact.model.js';
import { Campaign } from '../models/campaign.model.js';
import { Followup } from '../models/followup.model.js';
import { Note } from '../models/note.model.js';
import { User } from '../models/user.model.js';
import EALead from '../models/eaLead.model.js';

/**
 * Handle JotForm Webhook submissions
 * URL: POST /api/webhooks/jotform
 */
export const handleJotForm = async (req, res) => {
    try {
        console.log('--- JOTFORM WEBHOOK RECEIVED ---');
        // JotForm can send data in different formats depending on how it's set up
        // (JSON vs Multipart). Express.json() handles JSON. 
        // We'll extract common JotForm fields.
        const data = req.body;

        // 1. Find or create the "Website Inbound" Campaign
        let campaign = await Campaign.findOne({ name: 'Website Inbound' });
        if (!campaign) {
            campaign = await Campaign.create({ name: 'Website Inbound' });
        }

        // 2. Extract Data (Mapping)
        // JotForm field names vary, but we'll try to find common ones
        // Often they look like "q3_fullName" or just "name"
        const rawFields = typeof data.rawRequest === 'string' ? JSON.parse(data.rawRequest) : (data.rawRequest || data);
        
        // Helper to find a field by a partial key
        const findField = (partialKey) => {
            const keys = Object.keys(rawFields);
            const key = keys.find(k => k.toLowerCase().includes(partialKey.toLowerCase()));
            return key ? rawFields[key] : null;
        };

        const nameValue = findField('name') || findField('full');
        let firstName = '';
        let lastName = '';
        
        if (typeof nameValue === 'object') {
            firstName = nameValue.first || '';
            lastName = nameValue.last || '';
        } else if (typeof nameValue === 'string') {
            [firstName, ...lastName] = nameValue.split(' ');
            lastName = lastName.join(' ');
        }

        const email = findField('email');
        const phoneValue = findField('phone');
        const phone = typeof phoneValue === 'object' ? `${phoneValue.area}${phoneValue.phone}` : phoneValue;
        const organization = findField('school') || findField('organization') || findField('company') || `${firstName} ${lastName}'s Lead`;
        const category = findField('grade') || findField('category');
        const type = findField('type');
        const sport = findField('sport');

        // 3. Create Lead
        const newLead = await Lead.create({
            campaign_id: campaign._id,
            name: organization,
            type: type || 'Inbound',
            category_group: category || '',
            telephone: phone || '',
            status: 'Not Contacted'
        });

        // 4. Create Contact
        await Contact.create({
            lead_id: newLead._id,
            name: `${firstName} ${lastName}`.trim(),
            email: email || '',
            direct_phone: phone || '',
            is_primary: true,
            title: 'Website Lead',
            department: sport || ''
        });

        // 5. Create Activity Feed Log (Note)
        await Note.create({
            lead_id: newLead._id,
            content: `NEW WEBHOOK SUBMISSION: JotForm inbound lead received.\n\nOrganization: ${organization}\nContact: ${firstName} ${lastName}\nEmail: ${email}\nSport/Dept: ${sport || 'N/A'}\nGrade: ${category || 'N/A'}`,
            type: 'note'
        });

        // 6. Create Follow-up Task
        const tomorrow = new Date();
        tomorrow.setHours(tomorrow.getHours() + 24);

        const adminUser = await User.findOne({ role: 'admin' });

        await Followup.create({
            lead_id: newLead._id,
            date_time: tomorrow,
            type: 'Call',
            priority: 'High',
            notes: 'New lead from website — follow up within 24 hours',
            status: 'pending',
            assigned_user: adminUser ? adminUser._id : null
        });

        console.log(`Lead created successfully: ${newLead.name}`);

        return res.status(200).json({
            success: true,
            message: 'Lead captured successfully',
            lead_id: newLead._id
        });

    } catch (error) {
        console.error('JotForm Webhook Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error processing webhook',
            error: error.message
        });
    }
};

/**
 * Handle JustCall Webhook submissions (Call Completed)
 * URL: POST /api/webhooks/justcall/call-completed
 */
export const handleJustCallWebhook = async (req, res) => {
    console.log('⚠️ Legacy JustCall Webhook attempted (Deprecated, shifted to Twilio)');
    return res.status(410).json({ 
        success: false, 
        message: 'This endpoint is deprecated. YAU-CRM has fully shifted from JustCall to Twilio.' 
    });
};

/**
 * Handle Twilio Inbound Webhook (Receiving Replies)
 * POST /api/webhooks/twilio-reply
 */
export const handleTwilioReply = async (req, res) => {
    try {
        console.log('--- TWILIO WEBHOOK RECEIVED ---', req.body);
        const { From, Body } = req.body;

        if (!From || !Body) {
            console.warn('[Twilio Webhook] Missing From or Body parameter.');
            return res.status(200).send('Missing payload');
        }

        // Normalize phone number (match last 10 digits)
        const cleanFrom = From.replace(/\D/g, '');
        const last10From = cleanFrom.slice(-10);

        if (last10From.length < 7) {
            console.warn('[Twilio Webhook] Sender phone number is too short.');
            return res.status(200).send('Invalid sender phone');
        }

        // Build a flexible regex pattern from last10From to match numbers with formatting
        // (allowing optional non-digit characters like spaces, hyphens, parentheses between digits)
        const digits = last10From.split('');
        const regexPattern = digits.map(d => `${d}\\D*`).join('') + '$';

        // Search for EA Lead matching sender phone
        const lead = await EALead.findOne({
            $or: [
                { phone: From },
                { phone: { $regex: regexPattern } }
            ]
        });

        if (!lead) {
            console.log(`[Twilio Webhook] No matching EA Lead found for phone: ${From}`);
            return res.status(200).send('Lead not found');
        }

        // Add inbound message to history
        lead.smsHistory.push({
            direction: 'inbound',
            message: Body.trim(),
            timestamp: new Date()
        });

        await lead.save();
        console.log(`[Twilio Webhook] Saved inbound SMS reply from "${lead.name}" (${lead.phone})`);

        return res.status(200).send('<Response></Response>'); // Twilio expects TwiML XML
    } catch (error) {
        console.error('Twilio Webhook Error:', error);
        return res.status(200).send('Error processing reply');
    }
};

/**
 * Handle Twilio SMS Delivery Status Callback
 * POST /api/webhooks/twilio-sms-status
 * 
 * Twilio calls this endpoint when a message status changes:
 * queued → sending → sent → delivered (success)
 *                        ↘ failed / undelivered (failure)
 */
export const handleTwilioSmsStatus = async (req, res) => {
    try {
        const { MessageSid, MessageStatus } = req.body;
        console.log(`[Twilio Status Callback] SID: ${MessageSid}, Status: ${MessageStatus}`);

        if (!MessageSid || !MessageStatus) {
            return res.status(200).send('Missing payload');
        }

        // Only update on terminal statuses — ignore intermediate ones (queued, sending, sent)
        const terminalStatuses = ['delivered', 'failed', 'undelivered'];
        if (!terminalStatuses.includes(MessageStatus)) {
            return res.status(200).send('Intermediate status — no update needed');
        }

        // Find the lead that has this message SID in its history
        const lead = await EALead.findOne({ 'smsHistory.twilioSid': MessageSid });
        if (!lead) {
            console.warn(`[Twilio Status Callback] No EA Lead found for SID: ${MessageSid}`);
            return res.status(200).send('Lead not found');
        }

        // Find the specific history entry and update its status
        const historyEntry = lead.smsHistory.find(m => m.twilioSid === MessageSid);
        if (historyEntry) {
            if (MessageStatus === 'delivered') {
                historyEntry.status = 'sent'; // Show as blue (delivered = truly sent)
            } else {
                historyEntry.status = 'failed'; // Show as red (failed/undelivered)
            }
            await lead.save();
            console.log(`[Twilio Status Callback] Updated SID ${MessageSid} → status: ${historyEntry.status} (lead: ${lead.name})`);
        }

        return res.status(200).send('OK');
    } catch (error) {
        console.error('[Twilio Status Callback] Error:', error);
        return res.status(200).send('Error');
    }
};
