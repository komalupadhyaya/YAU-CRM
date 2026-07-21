import express from 'express';
import * as teamController from '../controllers/team.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();

// GET all team members — admin, manager, and view_only can view the list
router.get('/', auth, requireRole('admin', 'manager', 'view_only'), teamController.getUsers);

// All write operations — admin only
router.post('/', auth, requireRole('admin'), teamController.createUser);
router.put('/:id', auth, requireRole('admin'), teamController.updateUser);
router.patch('/:id/toggle', auth, requireRole('admin'), teamController.toggleActive);
router.post('/:id/zoom-invite', auth, requireRole('admin'), teamController.inviteToZoom);
router.delete('/:id', auth, requireRole('admin'), teamController.deleteUser);

export default router;
