import express from 'express';
import * as settingsController from '../controllers/settings.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();

const allRoles = ['admin', 'manager', 'sales_rep', 'view_only'];

// GET settings: allowed for all roles (needed for statusLabels / pipeline workflow config)
router.get('/', auth, requireRole(...allRoles), settingsController.getSettings);

// POST settings: write operations are admin only
router.post('/', auth, requireRole('admin'), settingsController.updateSettings);

export default router;
