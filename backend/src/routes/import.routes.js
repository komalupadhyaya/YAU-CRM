import express from 'express';
import multer from 'multer';
import * as importController from '../controllers/import.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', auth, requireRole('admin', 'manager'), upload.single('file'), importController.importLeads);

export default router;
