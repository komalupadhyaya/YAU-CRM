import express from 'express';
import * as webhookController from '../controllers/webhook.controller.js';
import { submitEALead } from '../controllers/eaLead.controller.js';
import { handleMarketingRegistration, getMarketingWebhookHealth } from '../controllers/marketingWebhook.controller.js';

const router = express.Router();

// Public endpoint for JotForm Webhook
router.post('/jotform', webhookController.handleJotForm);

// Public endpoint for JustCall Webhook (Deprecated, shifted to Twilio)
// router.post('/justcall/call-completed', webhookController.handleJustCallWebhook);

// Public endpoint for EA Leads Webhook
router.post('/ea-leads', submitEALead);

// Public endpoint for Twilio Inbound Webhook (SMS replies)
router.post('/twilio-reply', webhookController.handleTwilioReply);

// Public endpoint for Twilio SMS Delivery Status Callback
router.post('/twilio-sms-status', webhookController.handleTwilioSmsStatus);

// Public endpoint for SendGrid Event Webhook
router.post('/sendgrid', webhookController.handleSendGridWebhook);

// Public endpoint for Single Unified Marketing Registration Webhook (All 4 Entry Points & Admin List Sync)
router.post('/marketing-registration', handleMarketingRegistration);
router.get('/marketing-registration/health', getMarketingWebhookHealth);

export default router;

