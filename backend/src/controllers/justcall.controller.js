import Note from '../models/note.model.js';
import Contact from '../models/contact.model.js';
import axios from 'axios';

// Helper: fetch most recent call from JustCall API by contact phone
const fetchRecordingFromJustCall = async (contactPhone) => {
    try {
        if (!process.env.JUSTCALL_API_KEY || !process.env.JUSTCALL_API_SECRET) return null;

        const authHeader = `${process.env.JUSTCALL_API_KEY}:${process.env.JUSTCALL_API_SECRET}`;
        const cleanPhone = contactPhone?.toString().replace(/\D/g, '').slice(-10);
        if (!cleanPhone || cleanPhone.length < 7) return null;

        const response = await axios.get('https://api.justcall.io/v2.1/calls', {
            headers: {
                'Authorization': authHeader,
                'Accept': 'application/json'
            },
            params: { per_page: 10, order: 'DESC' }
        });

        const calls = response.data?.data?.data || response.data?.data || [];
        const match = calls.find(c => {
            const cPhone = c.contact_number?.toString().replace(/\D/g, '').slice(-10);
            return cPhone === cleanPhone && c.call_info?.recording;
        });

        if (match) {
            return {
                url: match.call_info.recording,
                duration: match.call_duration?.total_duration || 0 // Correct path based on API example
            };
        }
        return null;
    } catch (err) {
        console.log('JustCall API fetch failed (non-fatal):', err.message);
        return null;
    }
};

// 1. Log Call Outcome — also attempts to attach recording immediately
export const logCallOutcome = async (req, res, next) => {
    try {
        const { lead_id, outcome, notes, duration, contact_name, recording_url } = req.body;

        if (!lead_id || !outcome) {
            res.status(400);
            throw new Error('lead_id and outcome are required');
        }

        const content = `CALL LOG: ${outcome}\nContact: ${contact_name || 'Unknown'}\nNotes: ${notes || 'None'}`;

        // Look up the contact's phone number to fetch recording from JustCall API
        let fetchedRecordingUrl = recording_url || null;
        let actualDuration = null;

        if (!fetchedRecordingUrl) {
            try {
                const contact = await Contact.findOne({ lead_id, is_primary: true }).lean();
                const phone = contact?.direct_phone;
                if (phone) {
                    const callData = await fetchRecordingFromJustCall(phone);
                    if (callData) {
                        fetchedRecordingUrl = callData.url;
                        actualDuration = callData.duration;
                        console.log(`✅ Recording URL fetched from JustCall API: ${fetchedRecordingUrl} (Duration: ${actualDuration}s)`);
                    }
                }
            } catch (e) {
                console.log('Could not auto-fetch recording:', e.message);
            }
        }

        const note = await Note.create({
            lead_id,
            content,
            type: 'call',
            metadata: { 
                outcome, 
                recording_duration: actualDuration, // Actual from JustCall
                contact_name, 
                recording_url: fetchedRecordingUrl 
            }
        });

        res.json({ success: true, followup_needed: outcome.includes('Follow-Up Needed'), note_id: note._id });
    } catch (err) {
        next(err);
    }
};

// 1b. Fetch & attach recording for an existing call note (called by frontend after delay)
export const fetchAndAttachRecording = async (req, res, next) => {
    try {
        const note = await Note.findById(req.params.noteId);
        if (!note || note.type !== 'call') {
            return res.status(404).json({ success: false, message: 'Call note not found' });
        }

        if (note.metadata?.recording_url) {
            return res.json({ success: true, recording_url: note.metadata.recording_url, already_attached: true });
        }

        // Find the contact phone for this lead
        const contact = await Contact.findOne({ lead_id: note.lead_id, is_primary: true }).lean();
        const phone = contact?.direct_phone;
        if (!phone) return res.json({ success: false, message: 'No contact phone found' });

        const callData = await fetchRecordingFromJustCall(phone);
        if (callData) {
            note.metadata = { 
                ...note.metadata, 
                recording_url: callData.url,
                recording_duration: callData.duration 
            };
            note.markModified('metadata');
            await note.save();
            return res.json({ success: true, recording_url: callData.url });
        }

        return res.json({ success: false, message: 'Recording not ready yet' });
    } catch (err) {
        next(err);
    }
};



// 2. Send SMS
export const sendSms = async (req, res, next) => {
    try {
        const { lead_id, to, message } = req.body;

        if (!lead_id || !to || !message) {
            res.status(400);
            throw new Error('lead_id, to, and message are required');
        }

        if (!process.env.JUSTCALL_API_KEY || !process.env.JUSTCALL_API_SECRET || !process.env.JUSTCALL_PHONE_NUMBER) {
            res.status(500);
            throw new Error('JustCall credentials are not configured.');
        }

        const justCallApiUrl = 'https://api.justcall.io/v2.1/texts/new';
        
        // JustCall v2.1 uses a non-standard Authorization header format: API_KEY:API_SECRET
        const authHeader = `${process.env.JUSTCALL_API_KEY}:${process.env.JUSTCALL_API_SECRET}`;

        // Ensure numbers are in E.164 format (+ prefix)
        const formatPhone = (num) => {
            if (!num) return null;
            const clean = num.toString().replace(/\D/g, '');
            
            // If it starts with + return as is (but clean it up)
            if (num.toString().startsWith('+')) return `+${clean}`;

            // If it's exactly 10 digits:
            if (clean.length === 10) {
                // If it starts with 6,7,8,9, it's likely India (+91)
                if (/^[6789]/.test(clean)) {
                    return `+91${clean}`;
                }
                // Default to USA (+1)
                return `+1${clean}`;
            }
            
            // If it's already got a country code (like 1... or 91...) but no +, prepend +
            if (clean.length > 10) {
                return `+${clean}`;
            }

            return clean.length >= 7 ? `+${clean}` : null;
        };

        const fromNumber = formatPhone(process.env.JUSTCALL_PHONE_NUMBER);
        const toNumber = formatPhone(to);

        console.log(`Attempting SMS: From ${fromNumber} To ${toNumber}`);

        if (!toNumber) {
            return res.status(400).json({ 
                success: false, 
                message: "This number is invalid. Please ensure it includes the country code (e.g., +91 for India)." 
            });
        }

        const response = await axios.post(justCallApiUrl, {
            justcall_number: fromNumber,
            contact_number: toNumber,
            body: message
        }, {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        // Log SMS in activity feed
        await Note.create({
            lead_id,
            content: `SMS SENT to ${toNumber}:\n${message}`,
            type: 'sms',
            metadata: { to: toNumber, message, justcall_response: response.data }
        });

        res.json({ success: true, data: response.data });

    } catch (err) {
        // Detailed logging for debugging
        console.error("JustCall API Error Response:", err.response?.data);
        
        // Extract the most helpful message
        const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message;
        
        res.status(err.response?.status || 500).json({
            success: false,
            message: errorMessage,
            details: err.response?.data || null
        });
    }
};
