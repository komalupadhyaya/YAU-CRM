import Note from '../models/note.model.js';
import axios from 'axios';

// 1. Log Call Outcome
export const logCallOutcome = async (req, res, next) => {
    try {
        const { lead_id, outcome, notes, duration, contact_name, recording_url } = req.body;

        if (!lead_id || !outcome) {
            res.status(400);
            throw new Error('lead_id and outcome are required');
        }

        const content = `CALL LOG: ${outcome}\nContact: ${contact_name || 'Unknown'}\nDuration: ${duration || 'N/A'}\nNotes: ${notes || 'None'}`;

        await Note.create({
            lead_id,
            content,
            type: 'call',
            metadata: { outcome, duration, contact_name, recording_url }
        });

        res.json({ success: true, followup_needed: outcome.includes('Follow-Up Needed') });
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
