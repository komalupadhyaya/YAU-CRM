import twilio from 'twilio';
import Lead from '../models/lead.model.js';
import Note from '../models/note.model.js';

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

        const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;

        if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
            res.status(500);
            throw new Error('Twilio credentials are not fully configured on the server.');
        }

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

        const fromNumber = formatPhone(TWILIO_PHONE_NUMBER);
        const toNumber = formatPhone(to);

        console.log(`Attempting Twilio SMS: From ${fromNumber} To ${toNumber}`);

        if (!toNumber) {
            return res.status(400).json({ 
                success: false, 
                message: "This number is invalid. Please ensure it includes the country code (e.g., +91 for India)." 
            });
        }

        // Initialize Twilio client
        const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

        const twilioRes = await client.messages.create({
            body: message,
            from: fromNumber,
            to: toNumber
        });

        // Log SMS in activity feed
        await Note.create({
            lead_id,
            content: `SMS SENT to ${toNumber}:\n${message}`,
            type: 'sms',
            metadata: { 
                to: toNumber, 
                message, 
                twilio_response: {
                    sid: twilioRes.sid,
                    status: twilioRes.status,
                    errorCode: twilioRes.errorCode,
                    errorMessage: twilioRes.errorMessage,
                    dateCreated: twilioRes.dateCreated
                }
            }
        });

        res.json({ success: true, data: twilioRes });

    } catch (err) {
        console.error("Twilio SMS API Error Response:", err);
        res.status(500).json({
            success: false,
            message: err.message || "Failed to send SMS via Twilio."
        });
    }
};
