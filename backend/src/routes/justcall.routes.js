import express from 'express';
import * as justcallController from '../controllers/justcall.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();

const allowedRoles = ['admin', 'manager', 'sales_rep'];

router.post('/log-call', auth, requireRole(...allowedRoles), justcallController.logCallOutcome);
router.post('/send-sms', auth, requireRole(...allowedRoles), justcallController.sendSms);
router.get('/fetch-recording/:noteId', auth, requireRole(...allowedRoles), justcallController.fetchAndAttachRecording);

export default router;
