import express from 'express';
import * as followupController from '../controllers/followup.controller.js';
import * as dashboardController from '../controllers/dashboard.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();

const allRoles = ['admin', 'manager', 'sales_rep', 'view_only'];
const canWrite = ['admin', 'manager', 'sales_rep'];

// Literal routes first
router.get('/dashboard', auth, requireRole(...allRoles), dashboardController.getDashboardStats);
router.get('/grouped', auth, requireRole(...allRoles), followupController.getGroupedFollowups);

// Get follow-ups for a lead — all roles can view
router.get('/lead/:schoolId', auth, requireRole(...allRoles), followupController.getFollowupsBySchool);

// Create follow-up — view_only cannot create
router.post('/:schoolId', auth, requireRole(...canWrite), followupController.createFollowup);

// Complete follow-up — view_only cannot complete
router.put('/:id/complete', auth, requireRole(...canWrite), followupController.completeFollowup);

// Update follow-up — view_only cannot update
router.put('/:id', auth, requireRole(...canWrite), followupController.updateFollowup);

// Delete follow-up — only admins and managers can delete
router.delete('/:id', auth, requireRole('admin', 'manager'), followupController.deleteFollowup);

export default router;
