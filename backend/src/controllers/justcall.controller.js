import Note from '../models/note.model.js';
import Contact from '../models/contact.model.js';
import Lead from '../models/lead.model.js';
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
        
        // 1. Find the ABSOLUTE most recent call for this contact number
        const mostRecentCall = calls.find(c => {
            const cPhone = c.contact_number?.toString().replace(/\D/g, '').slice(-10);
            return cPhone === cleanPhone;
        });

        if (!mostRecentCall) {
            console.log('No recent calls found for phone:', cleanPhone);
            return null;
        }

        // 2. Check if this call is too old (e.g., more than 10 minutes ago)
        const callDateStr = mostRecentCall.datetime || `${mostRecentCall.call_date} ${mostRecentCall.call_time}`;
        const callTime = new Date(callDateStr + " UTC").getTime();
        const now = Date.now();
        const diffMinutes = (now - callTime) / (1000 * 60);

        if (diffMinutes > 10) {
            console.log(`Most recent call for ${cleanPhone} is too old (${Math.round(diffMinutes)} mins ago). Ignoring.`);
            return null;
        }

        // 3. Only return if it actually has a recording
        const recordingUrl = mostRecentCall.call_info?.recording || mostRecentCall.recording_url;
        if (recordingUrl) {
            return {
                url: recordingUrl,
                duration: mostRecentCall.call_duration?.total_duration || mostRecentCall.duration || 0
            };
        }

        console.log('Most recent call found but has no recording (declined/missed/short).');
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

        // Sales Rep lead assignment check
        const lead = await Lead.findById(lead_id).select('assigned_to');
        if (!lead) {
            res.status(404);
            throw new Error('Lead not found');
        }
        if (req.currentUserRole === 'sales_rep' && (!lead.assigned_to || lead.assigned_to.toString() !== req.user.id)) {
            res.status(403);
            throw new Error('Access denied. This lead is not assigned to you.');
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
                recording_duration: actualDuration,
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

        // Sales Rep lead assignment check
        const lead = await Lead.findById(note.lead_id).select('assigned_to');
        if (req.currentUserRole === 'sales_rep' && (!lead || !lead.assigned_to || lead.assigned_to.toString() !== req.user.id)) {
            return res.status(403).json({ success: false, error: 'Access denied. This lead is not assigned to you.' });
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

        // Sales Rep lead assignment check
        const lead = await Lead.findById(lead_id).select('assigned_to');
        if (!lead) {
            res.status(404);
            throw new Error('Lead not found');
        }
        if (req.currentUserRole === 'sales_rep' && (!lead.assigned_to || lead.assigned_to.toString() !== req.user.id)) {
            res.status(403);
            throw new Error('Access denied. This lead is not assigned to you.');
        }

        if (!process.env.JUSTCALL_API_KEY || !process.env.JUSTCALL_API_SECRET || !process.env.JUSTCALL_PHONE_NUMBER) {
            res.status(500);
            throw new Error('JustCall credentials are not configured.');
        }

        const justCallApiUrl = 'https://api.justcall.io/v2.1/texts/new';
        const authHeader = `${process.env.JUSTCALL_API_KEY}:${process.env.JUSTCALL_API_SECRET}`;

        const formatPhone = (num) => {
            if (!num) return null;
            const clean = num.toString().replace(/\D/g, '');
            if (num.toString().startsWith('+')) return `+${clean}`;
            if (clean.length === 10) {
                if (/^[6789]/.test(clean)) {
                    return `+91${clean}`;
                }
                return `+1${clean}`;
            }
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
        console.error("JustCall API Error Response:", err.response?.data);
        const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message;
        
        res.status(err.response?.status || 500).json({
            success: false,
            message: errorMessage,
            details: err.response?.data || null
        });
    }
};
