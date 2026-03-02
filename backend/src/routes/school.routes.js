import express from 'express';
import * as schoolController from '../controllers/school.controller.js';
import * as dashboardController from '../controllers/dashboard.controller.js';

const router = express.Router();

// Specific paths MUST come before parameterized paths
router.get('/campaign-summaries', dashboardController.getCampaignSummaries);

router.get('/campaign/:campaignId/school-counts', dashboardController.getCampaignCounts);

router.get('/campaign/:campaignId', schoolController.getSchoolsByCampaign);

router.get('/:id', schoolController.getSchoolById);

router.get('/', schoolController.getSchools);

router.post('/', schoolController.createSchool);

router.put('/:id', schoolController.updateSchool);

router.patch('/:id', schoolController.updateSchoolStatus);

export default router;
