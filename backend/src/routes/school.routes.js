import express from 'express';
import * as schoolController from '../controllers/school.controller.js';

const router = express.Router();

router.get('/', schoolController.getSchools);
router.get('/campaign/:campaignId', schoolController.getSchoolsByCampaign);
router.get('/:id', schoolController.getSchoolById);
router.post('/', schoolController.createSchool);
router.put('/:id', schoolController.updateSchool);
router.patch('/:id', schoolController.updateSchoolStatus);

export default router;
