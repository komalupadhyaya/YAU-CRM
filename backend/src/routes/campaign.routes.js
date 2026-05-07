import express from 'express';
import multer from 'multer';
import * as campaignController from '../controllers/campaign.controller.js';
import * as importController from '../controllers/import.controller.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// List all campaigns
router.get('/', campaignController.getCampaigns);

// Create a campaign
router.post('/', campaignController.createCampaign);

// Campaign detail + metrics
router.get('/:id', campaignController.getCampaignById);

// Delete a campaign and its leads
router.delete('/:id', campaignController.deleteCampaign);

// Campaign-scoped Excel/CSV import
router.post('/:id/import', upload.single('file'), importController.importLeadsForCampaign);

export default router;
