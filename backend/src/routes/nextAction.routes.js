import express from 'express';
import * as nextActionController from '../controllers/nextAction.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();
const canInteract = ['admin', 'manager', 'sales_rep'];

router.post('/:id/dismiss', auth, requireRole(...canInteract), nextActionController.dismissNextAction);
router.post('/:id/accept', auth, requireRole(...canInteract), nextActionController.acceptNextAction);
router.post('/:id/edit', auth, requireRole(...canInteract), nextActionController.editNextAction);
router.post('/:id/convert-followup', auth, requireRole(...canInteract), nextActionController.convertToFollowup);
router.post('/:id/generate', auth, requireRole(...canInteract), nextActionController.generateNextActionOnDemand);

export default router;
