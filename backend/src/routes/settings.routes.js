import express from 'express';
import * as settingsController from '../controllers/settings.controller.js';
import auth from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/', auth, settingsController.getSettings);
router.post('/', auth, settingsController.updateSettings);

export default router;
