import express from 'express';
import { getConsolidatedDashboard } from '../controllers/dashboard.controller.js';

const router = express.Router();

// GET /api/dashboard  –  CRM control center snapshot
router.get('/', getConsolidatedDashboard);

export default router;
