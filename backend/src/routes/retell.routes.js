import express from 'express';
import * as retellController from '../controllers/retell.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();

// --- PUBLIC RETELL WEBHOOK (No Auth Required - Called directly by Retell AI) ---
router.post('/webhook', retellController.handleRetellWebhook);

// --- PROTECTED KNOWLEDGE BASE & VOICE AGENT CONFIG (Admin & Staff) ---
router.get('/knowledge-base', auth, retellController.getKnowledgeBase);
router.put('/knowledge-base', auth, requireRole('admin'), retellController.updateKnowledgeBase);
router.post('/sync', auth, requireRole('admin'), retellController.syncToRetell);
router.get('/agent-status', auth, retellController.getRetellAgentStatus);

export default router;
