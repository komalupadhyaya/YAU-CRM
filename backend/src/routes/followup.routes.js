import express from 'express';
import * as followupController from '../controllers/followup.controller.js';
import * as dashboardController from '../controllers/dashboard.controller.js';

const router = express.Router();

// Literal routes first
router.get('/dashboard', dashboardController.getDashboardStats);
router.get('/grouped', followupController.getGroupedFollowups);

router.get('/school/:schoolId', followupController.getFollowupsBySchool);

router.post('/:schoolId', followupController.createFollowup);

router.put('/:id/complete', followupController.completeFollowup);

export default router;
