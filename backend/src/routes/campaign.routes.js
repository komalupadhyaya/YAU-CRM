import express from 'express';
import * as campaignController from '../controllers/campaign.controller.js';

const router = express.Router();

router.get('/', campaignController.getCampaigns);
router.post('/', campaignController.createCampaign);

export default router;
