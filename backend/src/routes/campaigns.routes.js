import express from 'express';
import { 
  sendEmail, 
  verifyEmailDomain, 
  generateEmailMessage,
  getCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  sendCampaign,
  rerunCampaign,
  unsubscribeLead,
  getEmailConversations,
  getEmailHistory
} from '../controllers/campaigns.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();

const allowedRoles = ['admin', 'manager', 'sales_rep'];

// --- Transactional / Individual Gmail routing ---
router.post('/send', auth, requireRole(...allowedRoles), sendEmail);
router.post('/ai-generate-email', auth, requireRole(...allowedRoles), generateEmailMessage);
router.get('/verify-domain', auth, requireRole('admin', 'manager'), verifyEmailDomain);

// --- Public Unsubscribe (no auth) ---
router.get('/unsubscribe/:leadId', unsubscribeLead);

// --- Campaigns CRUD ---
router.get('/campaigns', auth, requireRole(...allowedRoles), getCampaigns);
router.get('/campaigns/:id', auth, requireRole(...allowedRoles), getCampaign);
router.post('/campaigns', auth, requireRole(...allowedRoles), createCampaign);
router.put('/campaigns/:id', auth, requireRole(...allowedRoles), updateCampaign);
router.post('/campaigns/:id/send', auth, requireRole(...allowedRoles), sendCampaign);
router.post('/campaigns/:id/rerun', auth, requireRole(...allowedRoles), rerunCampaign);

// --- 1-to-1 Conversations ---
router.get('/conversations', auth, requireRole(...allowedRoles), getEmailConversations);
router.get('/conversations/:leadId', auth, requireRole(...allowedRoles), getEmailHistory);

export default router;
