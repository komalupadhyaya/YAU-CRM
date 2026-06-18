import express from 'express';
import * as availabilityController from '../controllers/availability.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();

// GET availability for any user — all roles can view (needed for conflict checks)
router.get('/:userId', auth, requireRole('admin', 'manager', 'sales_rep', 'view_only'), availabilityController.getAvailability);

// SET availability — any active user for themselves; admin can update anyone
router.put('/:userId', auth, requireRole('admin', 'manager', 'sales_rep'), availabilityController.setAvailability);

export default router;
