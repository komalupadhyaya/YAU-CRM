import express from 'express';
import * as eaLeadController from '../controllers/eaLead.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();

const allRoles = ['admin', 'manager'];
const canWrite = ['admin', 'manager'];
const canDelete = ['admin', 'manager'];

// Public form submission webhook
router.post('/submit', eaLeadController.submitEALead);

// Protected dashboard actions
router.get('/', auth, requireRole(...allRoles), eaLeadController.getEALeads);
router.post('/', auth, requireRole(...canWrite), eaLeadController.submitEALead);
router.post('/bulk-sms', auth, requireRole(...canWrite), eaLeadController.sendBulkSMS);
router.get('/:id', auth, requireRole(...allRoles), eaLeadController.getEALeadById);
router.put('/:id', auth, requireRole(...canWrite), eaLeadController.updateEALead);
router.delete('/:id', auth, requireRole(...canDelete), eaLeadController.deleteEALead);
router.post('/:id/send-sms', auth, requireRole(...canWrite), eaLeadController.sendSingleSMS);

export default router;
