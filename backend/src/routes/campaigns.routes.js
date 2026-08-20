import express from 'express';
import { 
  sendEmail, 
  verifyEmailDomain, 
  generateEmailMessage,
  getCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  sendCampaign,
  rerunCampaign,
  unsubscribeLead,
  getEmailConversations,
  getEmailHistory
} from '../controllers/campaigns.controller.js';
import {
  generateAiCampaignPreview,
  regenerateSingleRecipientDraft,
  dispatchAiPersonalizedCampaign
} from '../controllers/aiCampaign.controller.js';
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
router.post('/unsubscribe/:leadId', unsubscribeLead);

// --- AI Personalized Campaigns ---
router.post('/campaigns/ai-personalized/preview', auth, requireRole(...allowedRoles), generateAiCampaignPreview);
router.post('/campaigns/ai-personalized/regenerate-single', auth, requireRole(...allowedRoles), regenerateSingleRecipientDraft);
router.post('/campaigns/ai-personalized/dispatch', auth, requireRole(...allowedRoles), dispatchAiPersonalizedCampaign);

// --- Campaigns CRUD ---
router.get('/campaigns', auth, requireRole(...allowedRoles), getCampaigns);
router.get('/campaigns/:id', auth, requireRole(...allowedRoles), getCampaign);
router.post('/campaigns', auth, requireRole(...allowedRoles), createCampaign);
router.put('/campaigns/:id', auth, requireRole(...allowedRoles), updateCampaign);
router.delete('/campaigns/:id', auth, requireRole(...allowedRoles), deleteCampaign);
router.post('/campaigns/:id/send', auth, requireRole(...allowedRoles), sendCampaign);
router.post('/campaigns/:id/rerun', auth, requireRole(...allowedRoles), rerunCampaign);

// --- 1-to-1 Conversations ---
router.get('/conversations', auth, requireRole(...allowedRoles), getEmailConversations);
router.get('/conversations/:leadId', auth, requireRole(...allowedRoles), getEmailHistory);

export default router;
