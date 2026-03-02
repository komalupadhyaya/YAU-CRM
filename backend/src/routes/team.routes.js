import express from 'express';
import * as teamController from '../controllers/team.controller.js';
import auth from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/', auth, teamController.getUsers);

export default router;
