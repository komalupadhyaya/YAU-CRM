import express from 'express';
import * as justcallController from '../controllers/justcall.controller.js';

const router = express.Router();

router.post('/log-call', justcallController.logCallOutcome);
router.post('/send-sms', justcallController.sendSms);
router.get('/fetch-recording/:noteId', justcallController.fetchAndAttachRecording);


export default router;
