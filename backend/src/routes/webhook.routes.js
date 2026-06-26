import express from 'express';
import * as webhookController from '../controllers/webhook.controller.js';
import { submitEALead } from '../controllers/eaLead.controller.js';

const router = express.Router();

// Public endpoint for JotForm Webhook
router.post('/jotform', webhookController.handleJotForm);

// Public endpoint for JustCall Webhook
router.post('/justcall/call-completed', webhookController.handleJustCallWebhook);

// Public endpoint for EA Leads Webhook
router.post('/ea-leads', submitEALead);

// Public endpoint for Twilio Inbound Webhook
router.post('/twilio-reply', webhookController.handleTwilioReply);

export default router;

