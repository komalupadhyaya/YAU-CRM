import express from 'express';
import * as reportsController from '../controllers/reports.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();

// Reports — all authenticated roles can view
const allRoles = ['admin', 'manager', 'sales_rep', 'view_only'];

router.get('/overview', auth, requireRole(...allRoles), reportsController.getReportsOverview);
router.get('/campaign-performance', auth, requireRole(...allRoles), reportsController.getCampaignPerformance);
router.get('/followup-activity', auth, requireRole(...allRoles), reportsController.getFollowupActivity);

// Export — admin and manager only
router.get('/export', auth, requireRole('admin', 'manager'), reportsController.exportData);

export default router;
