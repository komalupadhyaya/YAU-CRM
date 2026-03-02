import express from 'express';
import multer from 'multer';
import * as importController from '../controllers/import.controller.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('file'), importController.importSchools);

export default router;
