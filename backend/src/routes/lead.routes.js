import express from 'express';
import * as leadController from '../controllers/lead.controller.js';
import * as dashboardController from '../controllers/dashboard.controller.js';

const router = express.Router();

// Specific paths MUST come before parameterized paths
router.get('/campaign-summaries', dashboardController.getCampaignSummaries);

router.get('/campaign/:campaignId/lead-counts', dashboardController.getCampaignCounts);

router.get('/campaign/:campaignId', leadController.getLeadsByCampaign);
router.get('/campaign/:campaignId/export', leadController.exportLeadsToExcel);

router.get('/:id', leadController.getLeadById);

router.get('/', leadController.getLeads);

router.post('/', leadController.createLead);

router.put('/:id', leadController.updateLead);

router.patch('/:id', leadController.updateLeadStatus);

export default router;
