import express from 'express';
import * as stalledLeadsController from '../controllers/stalledLeads.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();
const canInteract = ['admin', 'manager', 'sales_rep'];

router.get('/', auth, requireRole(...canInteract), stalledLeadsController.getStalledLeads);
router.post('/scan', auth, requireRole(...canInteract), stalledLeadsController.triggerScan);
router.post('/:id/re-engage', auth, requireRole(...canInteract), stalledLeadsController.reengageLead);
router.post('/:id/dismiss', auth, requireRole(...canInteract), stalledLeadsController.dismissStalledLead);

export default router;
