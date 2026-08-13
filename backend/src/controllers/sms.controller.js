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
        if (lead.isConsent === false) {
            res.status(400);
            throw new Error('This recipient has opted out of SMS communication (sent STOP).');
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
 * Fetch all SMS conversations from both EA Leads and Main CRM Leads.
 * - admin / manager  → all conversations (EA Leads + all CRM Leads)
 * - sales_rep        → only CRM Leads assigned to them (no EA Leads)
 * GET /api/sms/conversations
 */
export const getConversations = async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.currentUserRole; // 'admin' | 'manager' | 'sales_rep'
        const isPrivileged = userRole === 'admin' || userRole === 'manager';

        // Find SMS Notes to identify main leads that have SMS activity feed logs
        const smsNotes = await Note.find({ type: 'sms' });
        const leadIdsWithNotes = [...new Set(smsNotes.map(n => n.lead_id.toString()))];

        // Build queries based on role:
        // - sales_rep: no EA Leads, only assigned CRM Leads
        // - admin/manager: all EA Leads and all CRM Leads
        const eaLeadsPromise = isPrivileged
            ? EALead.find({ 'smsHistory.0': { $exists: true } })
            : Promise.resolve([]);

        const mainLeadsQuery = isPrivileged
            ? {
                $or: [
                    { 'smsHistory.0': { $exists: true } },
                    { _id: { $in: leadIdsWithNotes } }
                ]
              }
            : {
                assigned_to: userId,
                $or: [
                    { 'smsHistory.0': { $exists: true } },
                    { _id: { $in: leadIdsWithNotes } }
                ]
              };

        const [eaLeads, mainLeads] = await Promise.all([
            eaLeadsPromise,
            Lead.find(mainLeadsQuery)
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
                isConsent: lead.isConsent ?? true,
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
 * Fetch all EA Leads and Main CRM Leads that currently do NOT have any SMS message history.
 * Restricted to admin and manager roles.
 * GET /api/sms/available-leads
 */
export const getAvailableLeads = async (req, res) => {
    try {
        // Find main lead IDs that have SMS activity in Note collection
        const smsNotes = await Note.find({ type: 'sms' }).select('lead_id');
        const leadIdsWithNotes = [...new Set(smsNotes.map(n => n.lead_id?.toString()).filter(Boolean))];

        // 1. EA Leads without smsHistory (or empty smsHistory)
        const eaLeads = await EALead.find({
            $or: [
                { smsHistory: { $exists: false } },
                { smsHistory: { $size: 0 } }
            ]
        }).select('name email phone isConsent createdAt');

        // 2. Main CRM Leads without smsHistory and not in leadIdsWithNotes
        const mainLeads = await Lead.find({
            _id: { $nin: leadIdsWithNotes },
            $or: [
                { smsHistory: { $exists: false } },
                { smsHistory: { $size: 0 } }
            ]
        }).select('name telephone type category_group department createdAt');

        const leadIds = mainLeads.map(l => l._id);
        const contacts = await Contact.find({ lead_id: { $in: leadIds } });

        // Map contacts by lead_id
        const contactsByLead = {};
        contacts.forEach(c => {
            const lid = c.lead_id.toString();
            if (!contactsByLead[lid]) contactsByLead[lid] = [];
            contactsByLead[lid].push(c);
        });

        const available = [];

        // Format EA Leads
        eaLeads.forEach(lead => {
            available.push({
                _id: lead._id,
                leadType: 'ea_lead',
                name: lead.name,
                contactName: lead.name,
                email: lead.email || '',
                phone: lead.phone || '',
                categoryTag: 'EA Lead',
                isConsent: lead.isConsent ?? true,
                createdAt: lead.createdAt
            });
        });

        // Format Main Leads
        mainLeads.forEach(lead => {
            const leadContacts = contactsByLead[lead._id.toString()] || [];
            const primaryContact = leadContacts.find(c => c.is_primary) || leadContacts[0];
            const leadPhone = primaryContact?.direct_phone || lead.telephone || '';
            const contactName = primaryContact?.name || '';
            const displayName = contactName ? `${lead.name} (${contactName})` : lead.name;

            available.push({
                _id: lead._id,
                leadType: 'main_lead',
                name: displayName,
                rawName: lead.name,
                contactName: contactName,
                email: primaryContact?.email || '',
                phone: leadPhone,
                categoryTag: lead.type || 'CRM Lead',
                isConsent: true,
                createdAt: lead.createdAt
            });
        });

        // Sort alphabetically by name
        available.sort((a, b) => a.name.localeCompare(b.name));

        return res.status(200).json(available);
    } catch (error) {
        console.error('Error fetching available leads for SMS:', error);
        return res.status(500).json({ error: 'Failed to fetch available leads' });
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

        if (lead.isConsent === false) {
            return res.status(400).json({ error: 'This recipient has opted out of SMS communication (sent STOP).' });
        }

        let phoneToUse = lead.phone || lead.telephone;
        if (!phoneToUse && (leadType === 'main_lead' || !lead.phone)) {
            const primaryContact = await Contact.findOne({ lead_id: lead._id, is_primary: true }) ||
                                   await Contact.findOne({ lead_id: lead._id });
            phoneToUse = primaryContact?.direct_phone;
        }
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
        const { leadId, leadType, contactName, userPrompt } = req.body;

        if (!leadId) {
            return res.status(400).json({ error: 'leadId is required' });
        }

        // Fetch the lead — supports main leads and EA leads
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

        const contactPersonName = contactName || lead.contacts?.[0]?.name || lead.main_contact_name || '';

        // Call AI service
        const draft = await aiService.generateSmsMessage({
            leadName:       lead.name,
            contactName:    contactPersonName,
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

/**
 * Fetch all consented leads (EA Leads and CRM Leads) with valid phone numbers.
 * GET /api/sms/consented-leads
 */
export const getConsentedLeads = async (req, res) => {
    try {
        // 1. EA Leads where isConsent !== false and phone exists
        const eaLeads = await EALead.find({
            isConsent: { $ne: false },
            phone: { $exists: true, $ne: '' }
        }).select('name email phone isConsent createdAt');

        // 2. Main CRM Leads where isConsent !== false
        const mainLeads = await Lead.find({
            isConsent: { $ne: false }
        }).select('name telephone type category_group department createdAt isConsent');

        const leadIds = mainLeads.map(l => l._id);
        const contacts = await Contact.find({ lead_id: { $in: leadIds } });

        const contactsByLead = {};
        contacts.forEach(c => {
            const lid = c.lead_id.toString();
            if (!contactsByLead[lid]) contactsByLead[lid] = [];
            contactsByLead[lid].push(c);
        });

        const available = [];

        // Format EA Leads
        eaLeads.forEach(lead => {
            available.push({
                _id: lead._id,
                leadType: 'ea_lead',
                name: lead.name,
                contactName: lead.name,
                email: lead.email || '',
                phone: lead.phone || '',
                categoryTag: 'EA Lead',
                isConsent: true,
                createdAt: lead.createdAt
            });
        });

        // Format Main Leads
        mainLeads.forEach(lead => {
            const leadContacts = contactsByLead[lead._id.toString()] || [];
            const primaryContact = leadContacts.find(c => c.is_primary) || leadContacts[0];
            const leadPhone = primaryContact?.direct_phone || lead.telephone || '';
            
            if (leadPhone) {
                const contactName = primaryContact?.name || '';
                const displayName = contactName ? `${lead.name} (${contactName})` : lead.name;

                available.push({
                    _id: lead._id,
                    leadType: 'main_lead',
                    name: displayName,
                    rawName: lead.name,
                    contactName: contactName,
                    email: primaryContact?.email || '',
                    phone: leadPhone,
                    categoryTag: lead.type || 'CRM Lead',
                    isConsent: lead.isConsent ?? true,
                    createdAt: lead.createdAt
                });
            }
        });

        available.sort((a, b) => a.name.localeCompare(b.name));
        return res.status(200).json(available);
    } catch (error) {
        console.error('Error fetching consented leads for Bulk SMS:', error);
        return res.status(500).json({ error: 'Failed to fetch consented leads' });
    }
};

/**
 * Send bulk SMS to selected EA leads and CRM leads
 * POST /api/sms/bulk-sms
 */
export const sendBulkSMS = async (req, res) => {
    try {
        const { message, targets } = req.body; // targets: [{ id: "...", type: "ea_lead" | "main_lead" }]
        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message content is required.' });
        }
        if (!targets || !Array.isArray(targets) || targets.length === 0) {
            return res.status(400).json({ error: 'No targets specified for bulk SMS.' });
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

        const fromNumber = formatPhone(TWILIO_PHONE_NUMBER);
        const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        const statusCallbackUrl = `${process.env.BACKEND_URL}/api/webhooks/twilio-sms-status`;

        let successCount = 0;
        let failCount = 0;

        for (const target of targets) {
            const { id, type } = target;
            let lead = null;
            let phoneToUse = '';
            let nameToUse = '';

            if (type === 'ea_lead') {
                lead = await EALead.findById(id);
                if (lead && lead.isConsent !== false) {
                    phoneToUse = lead.phone;
                    nameToUse = lead.name;
                }
            } else {
                lead = await Lead.findById(id);
                if (lead && lead.isConsent !== false) {
                    const primaryContact = await Contact.findOne({ lead_id: lead._id, is_primary: true }) ||
                                           await Contact.findOne({ lead_id: lead._id });
                    phoneToUse = primaryContact?.direct_phone || lead.telephone;
                    nameToUse = primaryContact?.name || lead.name;
                }
            }

            if (!lead || !phoneToUse) {
                failCount++;
                console.warn(`[Bulk SMS Central] Skipping lead ${id} (type: ${type}) — no phone or lead not found/consented.`);
                continue;
            }

            const fullPhone = formatPhone(phoneToUse);
            if (!fullPhone) {
                failCount++;
                continue;
            }

            // Support {{name}} personalization
            const personalizedMessage = message.replace(/\{\{name\}\}/gi, nameToUse);

            try {
                const twilioMsg = await client.messages.create({
                    body: personalizedMessage,
                    from: fromNumber,
                    to: fullPhone,
                    statusCallback: statusCallbackUrl
                });

                const newMsgEntry = {
                    direction: 'outbound',
                    message: personalizedMessage,
                    timestamp: new Date(),
                    isBulk: true,
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
                        leadType: type,
                        message: newMsgEntry
                    });
                }

                successCount++;
            } catch (err) {
                console.error(`[Bulk SMS Central] ❌ Twilio API rejected send to ${fullPhone}:`, err.message);

                const failedEntry = {
                    direction: 'outbound',
                    message: personalizedMessage,
                    timestamp: new Date(),
                    isBulk: true,
                    status: 'failed',
                    twilioSid: null,
                    isRead: true
                };

                if (!lead.smsHistory) lead.smsHistory = [];
                lead.smsHistory.push(failedEntry);
                await lead.save();

                failCount++;
            }
        }

        return res.status(200).json({
            success: successCount > 0,
            successCount,
            failCount,
            message: failCount === 0
                ? `Bulk SMS sent successfully to ${successCount} contact${successCount !== 1 ? 's' : ''}.`
                : successCount === 0
                    ? `Bulk SMS failed for all ${failCount} contact${failCount !== 1 ? 's' : ''}.`
                    : `Bulk SMS sent to ${successCount} contact${successCount !== 1 ? 's' : ''}, but failed for ${failCount}.`
        });
    } catch (error) {
        console.error('Bulk SMS General Error:', error);
        return res.status(500).json({ error: error.message || 'Failed to send bulk SMS' });
    }
};

/**
 * Update SMS consent status for a lead
 * POST /api/sms/consent/:leadId
 */
export const updateConsent = async (req, res) => {
    try {
        const { leadId } = req.params;
        const { leadType, consent } = req.body; // consent: true | false

        if (consent === undefined) {
            return res.status(400).json({ error: 'Consent value is required' });
        }

        let lead = null;
        if (leadType === 'ea_lead') {
            lead = await EALead.findById(leadId);
        } else {
            lead = await Lead.findById(leadId);
        }

        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        lead.isConsent = !!consent;
        await lead.save();

        return res.status(200).json({
            success: true,
            isConsent: lead.isConsent,
            message: `SMS consent successfully ${lead.isConsent ? 're-enabled' : 'revoked'} for ${lead.name}.`
        });
    } catch (error) {
        console.error('Error updating SMS consent:', error);
        return res.status(500).json({ error: error.message || 'Failed to update SMS consent' });
    }
};
