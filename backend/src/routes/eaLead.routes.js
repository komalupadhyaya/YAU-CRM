import express from 'express';
import * as eaLeadController from '../controllers/eaLead.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();

const allRoles = ['admin', 'manager', 'sales_rep', 'view_only'];
const canWrite = ['admin', 'manager', 'sales_rep'];
const canDelete = ['admin', 'manager'];

// Public form submission webhook
router.post('/submit', eaLeadController.submitEALead);

// Protected dashboard actions
router.get('/', auth, requireRole(...allRoles), eaLeadController.getEALeads);
router.get('/:id', auth, requireRole(...allRoles), eaLeadController.getEALeadById);
router.put('/:id', auth, requireRole(...canWrite), eaLeadController.updateEALead);
router.delete('/:id', auth, requireRole(...canDelete), eaLeadController.deleteEALead);

export default router;
