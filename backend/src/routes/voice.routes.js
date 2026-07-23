import express from 'express';
import multer from 'multer';
import * as voiceController from '../controllers/voice.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// --- Browser Phone (Softphone) Endpoints ---
router.get('/token', auth, voiceController.getVoiceToken);
router.post('/log-call', auth, voiceController.logCallOutcome);

// --- Twilio Webhook Endpoints (Public) ---
router.post('/outbound', voiceController.handleOutboundCall);
router.post('/inbound', voiceController.handleInboundCall);
router.post('/handle-extension', voiceController.handleExtension);
router.post('/handle-dial-action', voiceController.handleDialAction);
router.post('/handle-voicemail-choice', voiceController.handleVoicemailChoice);
router.post('/voicemail-recording', voiceController.handleVoicemailRecording);
router.post('/call-status', voiceController.handleCallStatus);
router.post('/hold-music', voiceController.handleHoldMusic);
router.post('/agent-join-queue', voiceController.handleAgentJoinQueue);
router.post('/agent-screen-confirm', voiceController.handleAgentScreenConfirm);
router.post('/agent-call-status', voiceController.handleAgentCallStatus);

// --- PBX Admin Config Endpoints (Admin Only) ---
router.get('/config', auth, requireRole('admin'), voiceController.getConfig);
router.put('/config', auth, requireRole('admin'), voiceController.updateConfig);
router.post('/upload-audio', auth, requireRole('admin'), upload.single('file'), voiceController.uploadAudio);

// --- Call History (Admin & Manager) ---
router.get('/history', auth, requireRole('admin'), voiceController.getCallHistory);
router.delete('/history', auth, requireRole('admin'), voiceController.deleteAllCallRecords);
router.delete('/history/:id', auth, requireRole('admin'), voiceController.deleteCallRecord);

// --- Voicemail Inbox (Admin Only) ---
router.get('/voicemails', auth, requireRole('admin'), voiceController.getVoicemails);
router.patch('/voicemails/:id/listened', auth, requireRole('admin'), voiceController.markVoicemailListened);
router.delete('/voicemails', auth, requireRole('admin'), voiceController.deleteAllVoicemails);
router.delete('/voicemails/:id', auth, requireRole('admin'), voiceController.deleteVoicemail);

export default router;
