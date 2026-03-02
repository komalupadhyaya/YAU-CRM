import express from 'express';
import * as reportsController from '../controllers/reports.controller.js';

const router = express.Router();

router.get('/overview', reportsController.getReportsOverview);
router.get('/campaign-performance', reportsController.getCampaignPerformance);
router.get('/followup-activity', reportsController.getFollowupActivity);
router.get('/export', reportsController.exportData);

export default router;
