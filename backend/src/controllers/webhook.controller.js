import { Lead } from '../models/lead.model.js';
import { Contact } from '../models/contact.model.js';
import { Campaign } from '../models/campaign.model.js';
import { Followup } from '../models/followup.model.js';
import { Note } from '../models/note.model.js';
import { User } from '../models/user.model.js';

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
    try {
        console.log('--- JUSTCALL WEBHOOK RECEIVED ---');
        console.log('Headers:', req.headers['content-type']);
        console.log('Body:', JSON.stringify(req.body, null, 2));
        console.log('Query:', JSON.stringify(req.query, null, 2));

        const payload = (req.body && Object.keys(req.body).length > 0) ? req.body : req.query;
        const data = payload.data || payload; 

        // Extracting with fallbacks for different JustCall webhook versions
        let leadId = data.ticket_id || data.custom_fields?.ticket_id || payload.ticket_id;
        
        // Recording URL can be in recording_url OR call_info.recording
        const recordingUrl = data.recording_url || payload.recording_url || 
                           data.call_info?.recording || payload.call_info?.recording ||
                           data.recording || payload.recording;
                           
        // Duration can be a number OR an object with total_duration
        let durationValue = data.duration || payload.duration || data.call_duration || payload.call_duration;
        if (typeof durationValue === 'object' && durationValue !== null) {
            durationValue = durationValue.total_duration || durationValue.conversation_time || 0;
        }
        const duration = durationValue;

        const fromNumber = data.from || payload.from || data.justcall_number || payload.justcall_number;
        const toNumber = data.to || payload.to || data.contact_number || payload.contact_number;

        if (!leadId) {
            console.log('No ticket_id found, searching by phone number...');
            // Try to find lead by phone number (clean up numbers to match)
            const cleanFrom = fromNumber?.replace(/\D/g, '').slice(-10) || "";
            const cleanTo = toNumber?.replace(/\D/g, '').slice(-10) || "";
            
            console.log(`Searching for leads with phone ending in: "${cleanFrom}" or "${cleanTo}"`);

            if (cleanFrom || cleanTo) {
                // Search in Lead telephone
                let lead = await Lead.findOne({ 
                    $or: [
                        { telephone: { $regex: cleanFrom } },
                        { telephone: { $regex: cleanTo } }
                    ].filter(q => Object.values(q)[0].$regex !== "")
                });

                if (!lead) {
                    console.log('Lead not found by telephone, searching Contacts...');
                    // Search in Contact direct_phone
                    const contact = await Contact.findOne({
                        $or: [
                            { direct_phone: { $regex: cleanFrom } },
                            { direct_phone: { $regex: cleanTo } }
                        ].filter(q => Object.values(q)[0].$regex !== "")
                    });
                    if (contact) {
                        console.log(`Found matching contact for lead ${contact.lead_id}`);
                        leadId = contact.lead_id;
                    }
                } else {
                    console.log(`Found matching lead ${lead._id}`);
                    leadId = lead._id;
                }
            }
        }

        if (!leadId) {
            console.log('No lead mapping found for this call. Skipping.');
            return res.status(200).json({ success: true, message: 'Skipped - no lead mapping' });
        }

        // We check if a note for this call was already created by the frontend (logCallOutcome)
        // Usually, the frontend logs the outcome immediately, and the webhook fires shortly after
        // We can just append a new note with the recording, or try to update the last call note.
        // For simplicity and safety, we'll create a new Note with the recording.
        
        await Note.create({
            lead_id: leadId,
            content: `CALL RECORDING RECEIVED\nDuration: ${duration ? duration + ' seconds' : 'N/A'}\nFrom: ${fromNumber || 'Unknown'}`,
            type: 'call',
            metadata: { duration, recording_url: recordingUrl, justcall_data: data }
        });

        console.log(`Call recording attached to lead ${leadId}`);

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('JustCall Webhook Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};
