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

        // ── CORRECT field paths from real JustCall payload ────────────────────
        // Recording: data.call_info.recording
        const recordingUrl = data.call_info?.recording || payload.call_info?.recording || null;

        // Duration: data.call_duration.conversation_time (seconds of actual talk time)
        const callDurationObj = data.call_duration || {};
        const duration = callDurationObj.conversation_time
            || callDurationObj.total_duration
            || callDurationObj.friendly_duration
            || null;

        // Phone number to match lead: data.contact_number
        const contactPhone = data.contact_number || payload.contact_number || null;
        // JustCall's own number (our CRM number)
        const justcallNumber = data.justcall_number || payload.justcall_number || null;

        // Notes field: data.call_info.notes
        const callNotes = data.call_info?.notes || "";

        // Lead ID may be passed as a custom field from the dialer URL
        let leadId = data.ticket_id || data.custom_fields?.ticket_id || payload.ticket_id;

        console.log(`Recording URL extracted: ${recordingUrl || 'MISSING'}`);
        console.log(`Contact phone: ${contactPhone}, Duration: ${duration}s`);

        // Fallback: Extract from call notes if CRM Lead ID was embedded
        if (!leadId) {
            const notes = callNotes;
            const match = notes.match(/CRM Lead ID: ([a-f0-9]{24})/i);
            if (match) {
                console.log(`Extracted Lead ID from notes: ${match[1]}`);
                leadId = match[1];
            }
        }

        if (!leadId) {
            console.log('No ticket_id found, searching by contact phone number...');
            // JustCall sends the caller's number in data.contact_number
            const cleanPhone = contactPhone?.toString().replace(/\D/g, '').slice(-10) || "";

            console.log(`Searching for lead/contact with phone ending in: "${cleanPhone}"`);

            if (cleanPhone.length >= 7) {
                // 1. Search Lead.telephone
                let lead = await Lead.findOne({ telephone: { $regex: cleanPhone } });

                if (!lead) {
                    // 2. Search Contact.direct_phone
                    console.log('Lead not found by telephone, searching Contacts...');
                    const contact = await Contact.findOne({ direct_phone: { $regex: cleanPhone } });
                    if (contact) {
                        console.log(`Found matching contact, lead_id: ${contact.lead_id}`);
                        leadId = contact.lead_id;
                    }
                } else {
                    console.log(`Found matching lead: ${lead._id}`);
                    leadId = lead._id;
                }
            }
        }


        if (!leadId) {
            console.log('No lead mapping found for this call. Skipping.');
            return res.status(200).json({ success: true, message: 'Skipped - no lead mapping' });
        }

        // IMPROVED: Find the most recent manual call log for this lead
        // to attach this recording to.
        const existingNote = await Note.findOne({
            lead_id: leadId,
            type: 'call'
        }).sort({ createdAt: -1 });

        if (existingNote) {
            console.log(`Found recent call log for lead ${leadId}. Updating with recording...`);

            existingNote.metadata = {
                ...existingNote.metadata,
                recording_url: recordingUrl,
                duration: duration || existingNote.metadata?.duration,
                justcall_data: data
            };
            existingNote.markModified('metadata');
            await existingNote.save();

        } else {
            console.log(`No recent call log found for lead ${leadId}. Creating new recording note.`);
            await Note.create({
                lead_id: leadId,
                content: `CALL RECORDING RECEIVED\nDuration: ${duration ? duration + ' seconds' : 'N/A'}\nFrom: ${fromNumber || 'Unknown'}`,
                type: 'call',
                metadata: { duration, recording_url: recordingUrl, justcall_data: data }
            });
        }

        console.log(`Call recording processed for lead ${leadId}`);

        // DEBUG: Create a hidden-ish debug note with the raw data to see what JustCall is sending
        await Note.create({
            lead_id: leadId,
            content: `DEBUG: JustCall Webhook Received.\nRecording URL: ${recordingUrl || 'MISSING'}\nPayload Keys: ${Object.keys(payload).join(', ')}`,
            type: 'note',
            metadata: { raw_payload: payload }
        });


        return res.status(200).json({ success: true });



    } catch (error) {
        console.error('JustCall Webhook Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};
