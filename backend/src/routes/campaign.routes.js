import express from 'express';
import multer from 'multer';
import * as campaignController from '../controllers/campaign.controller.js';
import * as importController from '../controllers/import.controller.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// List all campaigns (unchanged)
router.get('/', campaignController.getCampaigns);

// Create a campaign (unchanged)
router.post('/', campaignController.createCampaign);

// Campaign detail + metrics
// IMPORTANT: this must appear BEFORE any routes that might shadow /:id
router.get('/:id', campaignController.getCampaignById);

// Campaign-scoped Excel/CSV import
router.post('/:id/import', upload.single('file'), importController.importSchoolsForCampaign);

export default router;
