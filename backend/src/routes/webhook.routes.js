import express from 'express';
import * as webhookController from '../controllers/webhook.controller.js';

const router = express.Router();

// Public endpoint for JotForm Webhook
router.post('/jotform', webhookController.handleJotForm);

// Public endpoint for JustCall Webhook
router.post('/justcall/call-completed', webhookController.handleJustCallWebhook);

export default router;
