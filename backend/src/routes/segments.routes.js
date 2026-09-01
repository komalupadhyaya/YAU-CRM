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
  previewCampaignRecipients,
  getAvailableContacts
} from '../controllers/segments.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();
const upload = multer(); // Keep in memory, do not write to disk

const allRoles = ['admin', 'manager', 'sales_rep', 'view_only'];
const allowedRoles = ['admin', 'manager', 'sales_rep'];

router.get('/segments/available-contacts', auth, requireRole(...allRoles), getAvailableContacts);
router.get('/segments', auth, requireRole(...allRoles), getSegments);
router.get('/segments/preview-campaign/:campaignId', auth, requireRole(...allRoles), previewCampaignRecipients);
router.post('/segments', auth, requireRole(...allowedRoles), createSegment);
router.put('/segments/:id', auth, requireRole(...allowedRoles), updateSegment);
router.delete('/segments/:id', auth, requireRole('admin', 'manager'), deleteSegment);
router.post('/segments/import', auth, requireRole(...allowedRoles), upload.single('file'), importSegmentCsv);
router.post('/segments/:id/append-csv', auth, requireRole(...allowedRoles), upload.single('file'), appendSegmentCsv);
router.delete('/segments/:id/contacts/:contactEmail', auth, requireRole(...allowedRoles), removeSegmentContact);

export default router;

