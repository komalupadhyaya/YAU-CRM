import twilio from 'twilio';
import Lead from '../models/lead.model.js';
import EALead from '../models/eaLead.model.js';
import Note from '../models/note.model.js';
import Contact from '../models/contact.model.js';
import aiService from '../services/ai.service.js';

export const sendSms = async (req, res, next) => {
    try {
        const { lead_id, to, message } = req.body;

        if (!lead_id || !to || !message) {
            res.status(400);
            throw new Error('lead_id, to, and message are required');
        }

        // Sales Rep lead assignment check
        const lead = await Lead.findById(lead_id);
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

        // Save to Lead.smsHistory as well
        const newMsgEntry = {
            direction: 'outbound',
            message: message.trim(),
            timestamp: new Date(),
            isBulk: false,
            status: 'pending',
            twilioSid: twilioRes.sid,
            isRead: true
        };

        if (!lead.smsHistory) lead.smsHistory = [];
        lead.smsHistory.push(newMsgEntry);
        await lead.save();

        // Emit Socket.IO event
        const io = req.app.get('io');
        if (io) {
            io.emit('sms:sent', {
                leadId: lead._id,
                leadType: 'main_lead',
                message: newMsgEntry
            });
        }

        res.json({ success: true, data: twilioRes });

    } catch (err) {
        console.error("Twilio SMS API Error Response:", err);
        res.status(500).json({
            success: false,
            message: err.message || "Failed to send SMS via Twilio."
        });
    }
};

/**
 * Fetch all SMS conversations from both EA Leads and Main CRM Leads
 * GET /api/sms/conversations
 */
export const getConversations = async (req, res) => {
    try {
        // Find SMS Notes to identify main leads that have SMS activity feed logs
        const smsNotes = await Note.find({ type: 'sms' });
        const leadIdsWithNotes = [...new Set(smsNotes.map(n => n.lead_id.toString()))];

        const [eaLeads, mainLeads] = await Promise.all([
            EALead.find({ 'smsHistory.0': { $exists: true } }),
            Lead.find({
                $or: [
                    { 'smsHistory.0': { $exists: true } },
                    { _id: { $in: leadIdsWithNotes } }
                ]
            })
        ]);

        const conversations = [];

        eaLeads.forEach(lead => {
            const history = lead.smsHistory || [];
            const lastMsg = history[history.length - 1];
            conversations.push({
                _id: lead._id,
                leadType: 'ea_lead',
                name: lead.name,
                email: lead.email,
                phone: lead.phone,
                categoryTag: 'EA Lead',
                isConsent: lead.isConsent,
                unreadCount: lead.unreadCount || 0,
                lastMessage: lastMsg ? lastMsg.message : '',
                lastMessageTimestamp: lastMsg ? lastMsg.timestamp : lead.updatedAt,
                smsHistory: history
            });
        });

        // Process main CRM leads and sync any missing SMS notes into mainLead.smsHistory
        for (const lead of mainLeads) {
            const primaryContact = await Contact.findOne({ lead_id: lead._id, is_primary: true }) ||
                                   await Contact.findOne({ lead_id: lead._id });

            let history = lead.smsHistory || [];

            // Find SMS notes for this lead
            const leadNotes = smsNotes.filter(n => n.lead_id.toString() === lead._id.toString());
            let updatedLead = false;

            if (leadNotes.length > 0) {
                leadNotes.forEach(note => {
                    // Extract message text from note content
                    let msgText = note.content;
                    let direction = 'outbound';
                    if (msgText.includes(':\n')) {
                        const parts = msgText.split(':\n');
                        msgText = parts.slice(1).join(':\n').trim();
                    }
                    if (note.content.toLowerCase().includes('received from') || note.content.toLowerCase().includes('inbound')) {
                        direction = 'inbound';
                    }

                    // Check if message is already in history by SID or content+timestamp
                    const noteSid = note.metadata?.twilio_response?.sid;
                    const exists = history.some(h => (noteSid && h.twilioSid === noteSid) || h.message === msgText);

                    if (!exists) {
                        history.push({
                            direction,
                            message: msgText,
                            timestamp: note.createdAt || note.updatedAt || new Date(),
                            status: 'sent',
                            twilioSid: noteSid || null,
                            isRead: true
                        });
                        updatedLead = true;
                    }
                });
            }

            if (updatedLead) {
                history.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                lead.smsHistory = history;
                await lead.save();
            }

            const lastMsg = history[history.length - 1];
            const leadPhone = primaryContact?.direct_phone || lead.telephone || '';
            const displayName = primaryContact?.name ? `${lead.name} (${primaryContact.name})` : lead.name;

            conversations.push({
                _id: lead._id,
                leadType: 'main_lead',
                name: displayName,
                email: primaryContact?.email || '',
                phone: leadPhone,
                categoryTag: lead.type || 'CRM Lead',
                isConsent: true,
                unreadCount: lead.unreadCount || 0,
                lastMessage: lastMsg ? lastMsg.message : '',
                lastMessageTimestamp: lastMsg ? lastMsg.timestamp : lead.updatedAt,
                smsHistory: history
            });
        }

        conversations.sort((a, b) => new Date(b.lastMessageTimestamp).getTime() - new Date(a.lastMessageTimestamp).getTime());

        return res.status(200).json(conversations);
    } catch (error) {
        console.error('Error fetching SMS conversations:', error);
        return res.status(500).json({ error: 'Failed to fetch conversations' });
    }
};

/**
 * Get total unread SMS count and recent unread messages across all leads
 * GET /api/sms/unread-count
 */
export const getUnreadCount = async (req, res) => {
    try {
        const [eaUnread, mainUnread] = await Promise.all([
            EALead.aggregate([{ $group: { _id: null, total: { $sum: '$unreadCount' } } }]),
            Lead.aggregate([{ $group: { _id: null, total: { $sum: '$unreadCount' } } }])
        ]);

        const totalUnreadCount = (eaUnread[0]?.total || 0) + (mainUnread[0]?.total || 0);

        const [eaLeads, mainLeads] = await Promise.all([
            EALead.find({ unreadCount: { $gt: 0 } }).select('name phone smsHistory unreadCount updatedAt'),
            Lead.find({ unreadCount: { $gt: 0 } }).select('name telephone smsHistory unreadCount updatedAt')
        ]);

        const recentMessages = [];

        eaLeads.forEach(l => {
            const unreadItems = (l.smsHistory || []).filter(m => m.direction === 'inbound' && !m.isRead);
            unreadItems.forEach(m => {
                recentMessages.push({
                    leadId: l._id,
                    leadType: 'ea_lead',
                    senderName: l.name,
                    phone: l.phone,
                    categoryTag: 'EA Lead',
                    message: m.message,
                    timestamp: m.timestamp
                });
            });
        });

        mainLeads.forEach(l => {
            const unreadItems = (l.smsHistory || []).filter(m => m.direction === 'inbound' && !m.isRead);
            unreadItems.forEach(m => {
                recentMessages.push({
                    leadId: l._id,
                    leadType: 'main_lead',
                    senderName: l.name,
                    phone: l.telephone,
                    categoryTag: 'CRM Lead',
                    message: m.message,
                    timestamp: m.timestamp
                });
            });
        });

        recentMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return res.status(200).json({
            totalUnreadCount,
            recentMessages: recentMessages.slice(0, 10)
        });
    } catch (error) {
        console.error('Error fetching SMS unread count:', error);
        return res.status(500).json({ error: 'Failed to fetch unread count' });
    }
};

/**
 * Mark all inbound messages for a given lead as read
 * POST /api/sms/mark-read/:leadId
 */
export const markAsRead = async (req, res) => {
    try {
        const { leadId } = req.params;
        const { leadType } = req.body;

        let targetLead = null;

        if (leadType === 'ea_lead') {
            targetLead = await EALead.findById(leadId);
        } else if (leadType === 'main_lead') {
            targetLead = await Lead.findById(leadId);
        } else {
            targetLead = await EALead.findById(leadId) || await Lead.findById(leadId);
        }

        if (!targetLead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        if (targetLead.smsHistory && targetLead.smsHistory.length > 0) {
            targetLead.smsHistory.forEach(msg => {
                if (msg.direction === 'inbound') {
                    msg.isRead = true;
                }
            });
        }

        targetLead.unreadCount = 0;
        await targetLead.save();

        const [eaUnread, mainUnread] = await Promise.all([
            EALead.aggregate([{ $group: { _id: null, total: { $sum: '$unreadCount' } } }]),
            Lead.aggregate([{ $group: { _id: null, total: { $sum: '$unreadCount' } } }])
        ]);

        const totalUnreadCount = (eaUnread[0]?.total || 0) + (mainUnread[0]?.total || 0);

        const io = req.app.get('io');
        if (io) {
            io.emit('sms:read', {
                leadId: targetLead._id,
                totalUnreadCount
            });
        }

        return res.status(200).json({
            success: true,
            unreadCount: 0,
            totalUnreadCount
        });
    } catch (error) {
        console.error('Error marking SMS as read:', error);
        return res.status(500).json({ error: 'Failed to mark messages as read' });
    }
};

/**
 * Send 1-on-1 SMS in Inbox chat view
 * POST /api/sms/send-chat-sms
 */
export const sendChatSms = async (req, res) => {
    try {
        const { leadId, leadType, message } = req.body;

        if (!leadId || !message || !message.trim()) {
            return res.status(400).json({ error: 'leadId and message are required' });
        }

        let lead = null;
        if (leadType === 'ea_lead') {
            lead = await EALead.findById(leadId);
        } else if (leadType === 'main_lead') {
            lead = await Lead.findById(leadId);
        } else {
            lead = await EALead.findById(leadId) || await Lead.findById(leadId);
        }

        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        const phoneToUse = lead.phone || lead.telephone;
        if (!phoneToUse) {
            return res.status(400).json({ error: 'Lead does not have a phone number.' });
        }

        const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;
        if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
            return res.status(500).json({ error: 'Twilio credentials not configured' });
        }

        const formatPhone = (num) => {
            if (!num) return null;
            const clean = num.toString().replace(/\D/g, '');
            if (num.toString().startsWith('+')) return `+${clean}`;
            if (clean.length === 10) return `+1${clean}`;
            if (clean.length === 11 && clean.startsWith('1')) return `+${clean}`;
            return `+${clean}`;
        };

        const fullPhone = formatPhone(phoneToUse);
        const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        const statusCallbackUrl = `${process.env.BACKEND_URL}/api/webhooks/twilio-sms-status`;

        const twilioMsg = await client.messages.create({
            body: message.trim(),
            from: formatPhone(TWILIO_PHONE_NUMBER),
            to: fullPhone,
            statusCallback: statusCallbackUrl
        });

        const newMsgEntry = {
            direction: 'outbound',
            message: message.trim(),
            timestamp: new Date(),
            isBulk: false,
            status: 'pending',
            twilioSid: twilioMsg.sid,
            isRead: true
        };

        if (!lead.smsHistory) lead.smsHistory = [];
        lead.smsHistory.push(newMsgEntry);
        await lead.save();

        const io = req.app.get('io');
        if (io) {
            io.emit('sms:sent', {
                leadId: lead._id,
                leadType: leadType || (lead.phone ? 'ea_lead' : 'main_lead'),
                message: newMsgEntry
            });
        }

        return res.status(200).json({
            success: true,
            data: newMsgEntry,
            smsHistory: lead.smsHistory
        });

    } catch (error) {
        console.error('Send Chat SMS Error:', error);
        return res.status(500).json({ error: error.message || 'Failed to send SMS message' });
    }
};

/**
 * Generate an AI-suggested SMS draft for a lead
 * POST /api/sms/ai-generate-sms
 *
 * Body: { leadId, leadType, userPrompt? }
 * Returns: { success: true, draft: "..." }
 */
export const generateSmsMessage = async (req, res) => {
    try {
        const { leadId, leadType, userPrompt } = req.body;

        if (!leadId) {
            return res.status(400).json({ error: 'leadId is required' });
        }

        // Fetch the lead — currently supports main leads; EA lead support can be added later
        let lead = null;
        if (leadType === 'ea_lead') {
            lead = await EALead.findById(leadId).lean();
        } else {
            // Default: main lead
            lead = await Lead.findById(leadId).lean();
        }

        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        // Sales rep access check for main leads
        if (leadType !== 'ea_lead' && req.currentUserRole === 'sales_rep') {
            const assignedId = lead.assigned_to ? lead.assigned_to.toString() : null;
            if (assignedId && assignedId !== req.user.id) {
                return res.status(403).json({ error: 'Access denied. This lead is not assigned to you.' });
            }
        }

        // Extract last 10 SMS messages from smsHistory
        const smsHistory = lead.smsHistory || [];
        const recentMessages = smsHistory.slice(-10);

        // Call AI service
        const draft = await aiService.generateSmsMessage({
            leadName:       lead.name,
            leadStatus:     lead.status,
            recentMessages,
            userPrompt:     userPrompt || ''
        });

        if (!draft) {
            return res.status(500).json({ error: 'AI returned an empty response. Please try again.' });
        }

        return res.json({ success: true, draft });

    } catch (error) {
        console.error('AI Generate SMS Error:', error);
        return res.status(500).json({
            error: error.message || 'Failed to generate AI SMS message'
        });
    }
};
