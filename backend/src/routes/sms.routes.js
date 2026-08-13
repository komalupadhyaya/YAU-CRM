import express from 'express';
import * as smsController from '../controllers/sms.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();

const allowedRoles = ['admin', 'manager', 'sales_rep'];

router.post('/send-sms', auth, requireRole(...allowedRoles), smsController.sendSms);
router.get('/conversations', auth, requireRole(...allowedRoles), smsController.getConversations);
router.get('/available-leads', auth, requireRole('admin', 'manager'), smsController.getAvailableLeads);
router.get('/consented-leads', auth, requireRole('admin', 'manager'), smsController.getConsentedLeads);
router.post('/bulk-sms', auth, requireRole('admin', 'manager'), smsController.sendBulkSMS);
router.post('/consent/:leadId', auth, requireRole('admin', 'manager'), smsController.updateConsent);
router.get('/unread-count', auth, smsController.getUnreadCount);
router.post('/mark-read/:leadId', auth, smsController.markAsRead);
router.post('/send-chat-sms', auth, requireRole(...allowedRoles), smsController.sendChatSms);
router.post('/ai-generate-sms', auth, requireRole(...allowedRoles), smsController.generateSmsMessage);

export default router;

