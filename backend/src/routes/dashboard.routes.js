import express from 'express';
import { getConsolidatedDashboard } from '../controllers/dashboard.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();

const allRoles = ['admin', 'manager', 'sales_rep', 'view_only'];

// GET /api/dashboard  –  CRM control center snapshot
router.get('/', auth, requireRole(...allRoles), getConsolidatedDashboard);

export default router;
