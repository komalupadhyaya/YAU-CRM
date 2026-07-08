import express from 'express';
import * as smsController from '../controllers/sms.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();

const allowedRoles = ['admin', 'manager', 'sales_rep'];

router.post('/send-sms', auth, requireRole(...allowedRoles), smsController.sendSms);

export default router;
