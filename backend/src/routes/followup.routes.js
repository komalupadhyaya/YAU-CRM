import express from 'express';
import * as followupController from '../controllers/followup.controller.js';

const router = express.Router();

router.post('/:schoolId', followupController.createFollowup);
router.put('/:id/complete', followupController.completeFollowup);
router.get('/school/:schoolId', followupController.getFollowupsBySchool);

export default router;
