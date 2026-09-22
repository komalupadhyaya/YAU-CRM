import express from 'express';
import * as activityReportController from '../controllers/activityReport.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();

const allRoles = ['admin', 'manager', 'sales_rep', 'view_only'];
const submitRoles = ['admin', 'manager', 'sales_rep'];

// Submit a report — all active team members
router.post('/', auth, requireRole(...submitRoles), activityReportController.submitReport);

// Get reports feed (privacy filtered by controller based on role)
router.get('/', auth, requireRole(...allRoles), activityReportController.getReports);

// Draft management routes (Must be defined before /:id)
router.get('/draft', auth, requireRole(...submitRoles), activityReportController.getDraft);
router.post('/draft', auth, requireRole(...submitRoles), activityReportController.saveDraft);
router.delete('/draft', auth, requireRole(...submitRoles), activityReportController.deleteDraft);

// Get single report detail
router.get('/:id', auth, requireRole(...allRoles), activityReportController.getReportById);

export default router;
