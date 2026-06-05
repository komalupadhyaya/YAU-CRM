import express from 'express';
import multer from 'multer';
import * as campaignController from '../controllers/campaign.controller.js';
import * as importController from '../controllers/import.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const allRoles = ['admin', 'manager', 'sales_rep', 'view_only'];

// List and view — all authenticated roles
router.get('/', auth, requireRole(...allRoles), campaignController.getCampaigns);
router.get('/:id', auth, requireRole(...allRoles), campaignController.getCampaignById);

// Create/delete campaigns — admin and manager only
router.post('/', auth, requireRole('admin', 'manager'), campaignController.createCampaign);
router.delete('/:id', auth, requireRole('admin', 'manager'), campaignController.deleteCampaign);

// Import leads into campaign — admin and manager only
router.post('/:id/import', auth, requireRole('admin', 'manager'), upload.single('file'), importController.importLeadsForCampaign);

export default router;
