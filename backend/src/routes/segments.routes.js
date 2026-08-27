import express from 'express';
import multer from 'multer';
import { 
  getSegments,
  createSegment,
  updateSegment,
  deleteSegment,
  importSegmentCsv,
  appendSegmentCsv,
  removeSegmentContact,
  previewCampaignRecipients
} from '../controllers/segments.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();
const upload = multer(); // Keep in memory, do not write to disk

const allowedRoles = ['admin'];

router.get('/segments', auth, requireRole(...allowedRoles), getSegments);
router.get('/segments/preview-campaign/:campaignId', auth, requireRole(...allowedRoles), previewCampaignRecipients);
router.post('/segments', auth, requireRole(...allowedRoles), createSegment);
router.put('/segments/:id', auth, requireRole(...allowedRoles), updateSegment);
router.delete('/segments/:id', auth, requireRole(...allowedRoles), deleteSegment);
router.post('/segments/import', auth, requireRole(...allowedRoles), upload.single('file'), importSegmentCsv);
router.post('/segments/:id/append-csv', auth, requireRole(...allowedRoles), upload.single('file'), appendSegmentCsv);
router.delete('/segments/:id/contacts/:contactEmail', auth, requireRole(...allowedRoles), removeSegmentContact);

export default router;

