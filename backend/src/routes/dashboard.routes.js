import express from 'express';
import { getConsolidatedDashboard, getCommandCenterDashboard } from '../controllers/dashboard.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();

const allRoles = ['admin', 'manager', 'sales_rep', 'view_only'];

// GET /api/dashboard  –  CRM control center snapshot
router.get('/', auth, requireRole(...allRoles), getConsolidatedDashboard);

// GET /api/dashboard/command-center  –  Section 4 AI Dashboard Command Center
router.get('/command-center', auth, requireRole(...allRoles), getCommandCenterDashboard);

export default router;
