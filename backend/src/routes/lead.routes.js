import express from 'express';
import * as leadController from '../controllers/lead.controller.js';
import * as dashboardController from '../controllers/dashboard.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();

const allRoles = ['admin', 'manager', 'sales_rep', 'view_only'];
const canWrite = ['admin', 'manager', 'sales_rep'];

// Specific paths MUST come before parameterized paths
router.get('/campaign-summaries', auth, requireRole(...allRoles), dashboardController.getCampaignSummaries);
router.get('/campaign/:campaignId/lead-counts', auth, requireRole(...allRoles), dashboardController.getCampaignCounts);
router.get('/campaign/:campaignId', auth, requireRole(...allRoles), leadController.getLeadsByCampaign);
router.get('/campaign/:campaignId/export', auth, requireRole('admin', 'manager'), leadController.exportLeadsToExcel);
router.get('/assignment-history', auth, requireRole('admin', 'manager'), leadController.getAssignmentHistory);

router.get('/:id', auth, requireRole(...allRoles), leadController.getLeadById);
router.get('/', auth, requireRole(...allRoles), leadController.getLeads);

// Write operations — view_only is blocked; sales_rep ownership enforced in controller
router.post('/', auth, requireRole(...canWrite), leadController.createLead);
router.patch('/assign-bulk', auth, requireRole('admin', 'manager'), leadController.assignLeadsBulk);
router.put('/:id', auth, requireRole(...canWrite), leadController.updateLead);
router.patch('/:id', auth, requireRole(...canWrite), leadController.updateLeadStatus);
router.patch('/:id/assign', auth, requireRole('admin', 'manager'), leadController.assignLead);

export default router;
