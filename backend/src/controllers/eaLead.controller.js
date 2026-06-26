import axios from 'axios';
import twilio from 'twilio';
import EALead from '../models/eaLead.model.js';
import { getCCAccessToken } from '../utils/constantContact.js';
import { sendEAWelcomeEmail } from '../services/mailer.js';

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
 * Sends the auto welcome text via Twilio
 */
async function sendWelcomeSMS(name, fullPhone) {
    try {
        await twilioClient.messages.create({
            body: `Hey ${name}! 👋 Thanks for your interest in Youth Athlete University! We're excited to connect with you. Learn more about our programs here: https://youthathleteuniversity.org/love/ — Reply STOP to unsubscribe.`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: fullPhone
        });
        console.log(`✅ Welcome SMS sent to ${fullPhone}`);
    } catch (err) {
        console.error('❌ Twilio SMS failed:', err.message);
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

        let duplicateLead = await EALead.findOne({
            $or: [
                { email: cleanEmail },
                { phone: formattedPhone },
                ...(last10Phone.length >= 7 ? [{ phone: { $regex: last10Phone + '$' } }] : [])
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
            sendWelcomeSMS(lead.name, formattedPhone);
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
        const lead = await EALead.findById(req.params.id);
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }
        return res.status(200).json(lead);
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
                continue;
            }

            const fullPhone = formatPhoneForTwilio(lead.phone);
            
            // Support {{name}} personalization
            const personalizedMessage = message.replace(/\{\{name\}\}/gi, lead.name);

            try {
                await twilioClient.messages.create({
                    body: personalizedMessage,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: fullPhone
                });

                // Save to history
                lead.smsHistory.push({
                    direction: 'outbound',
                    message: personalizedMessage,
                    timestamp: new Date()
                });
                await lead.save();

                successCount++;
            } catch (err) {
                console.error(`Failed to send bulk SMS to ${lead.phone}:`, err.message);
                failCount++;
            }
        }

        return res.status(200).json({
            success: true,
            message: `Bulk SMS processing completed. Sent successfully to ${successCount} leads, failed for ${failCount} leads.`
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

        if (!lead.phone) {
            return res.status(400).json({ error: 'Lead does not have a valid phone number.' });
        }

        const fullPhone = formatPhoneForTwilio(lead.phone);

        try {
            await twilioClient.messages.create({
                body: message,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: fullPhone
            });

            // Save to history
            lead.smsHistory.push({
                direction: 'outbound',
                message: message,
                timestamp: new Date()
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

        let duplicateLead = await EALead.findOne({
            $or: [
                { email: cleanEmail },
                { phone: cleanPhone },
                ...(last10Phone.length >= 7 ? [{ phone: { $regex: last10Phone + '$' } }] : [])
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
            sendWelcomeSMS(lead.name, fullPhone);
        }

        sendEAWelcomeEmail({ name: lead.name, email: lead.email });

        return res.status(201).json(lead);

    } catch (error) {
        console.error('EA Lead Manual Creation Error:', error);
        return res.status(500).json({ error: 'Failed to create lead details' });
    }
};

