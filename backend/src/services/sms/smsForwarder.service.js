import twilio from 'twilio';

class SMSForwarderService {
    formatPhone(num) {
        if (!num) return null;
        const rawStr = num.toString().trim();
        const clean = rawStr.replace(/\D/g, '');
        if (rawStr.startsWith('+')) return `+${clean}`;
        if (clean.length === 10) {
            // Check for Indian mobile numbers (starts with 6, 7, 8, 9)
            if (/^[6789]/.test(clean)) {
                return `+91${clean}`;
            }
            return `+1${clean}`;
        }
        if (clean.length > 10) {
            return `+${clean}`;
        }
        return clean.length >= 7 ? `+${clean}` : null;
    }

    /**
     * Forward an inbound lead SMS reply to the assigned sales rep's cell phone
     * @param {Object} params
     * @param {Object} params.rep - Assigned user record { _id, name, phone }
     * @param {Object} params.lead - Lead record { _id, name, leadType, phone }
     * @param {string} params.replyMessage - Inbound SMS text from the lead
     */
    async forwardReplyToRep({ rep, lead, replyMessage }) {
        try {
            if (!rep || !rep.phone) {
                console.log(`[SMS Forwarder] Skipping forward: No phone configured for assigned rep (${rep?.name || 'Unassigned'}).`);
                return { success: false, reason: 'no_rep_phone' };
            }

            const repPhone = this.formatPhone(rep.phone);
            if (!repPhone) {
                console.warn(`[SMS Forwarder] Rep phone "${rep.phone}" could not be formatted to E.164.`);
                return { success: false, reason: 'invalid_rep_phone' };
            }

            const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, FRONTEND_URL } = process.env;

            if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
                console.warn('[SMS Forwarder] Twilio credentials not configured. Skipping SMS forward.');
                return { success: false, reason: 'missing_twilio_config' };
            }

            const fromNumber = this.formatPhone(TWILIO_PHONE_NUMBER);
            const leadName = lead.name || lead.phone || 'A lead';
            const cleanReply = (replyMessage || '').trim();
            const snippet = cleanReply.length > 120 ? `${cleanReply.substring(0, 120)}…` : cleanReply;
            const baseUrl = FRONTEND_URL || 'https://crm.yauapp.com';
            const crmLink = `${baseUrl}/sms?leadId=${lead._id}`;

            const forwardBody = `💬 New CRM reply from ${leadName}:\n"${snippet}"\n\n👉 Reply in CRM:\n${crmLink}`;

            console.log(`[SMS Forwarder] 📲 Forwarding lead reply to rep ${rep.name || ''} (${repPhone})...`);

            const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
            const messageRes = await client.messages.create({
                body: forwardBody,
                from: fromNumber,
                to: repPhone,
            });

            console.log(`[SMS Forwarder] ✅ Forwarded to rep ${repPhone} successfully! Twilio SID: ${messageRes.sid}`);
            return { success: true, sid: messageRes.sid };
        } catch (error) {
            console.error('[SMS Forwarder] ❌ Error forwarding SMS to rep:', error.message);
            return { success: false, error: error.message };
        }
    }
}

export const smsForwarderService = new SMSForwarderService();
export default smsForwarderService;
