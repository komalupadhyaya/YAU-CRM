import express from 'express';
import { sendEmail, verifyEmailDomain, generateEmailMessage } from '../controllers/email.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();

const allowedRoles = ['admin', 'manager', 'sales_rep'];

router.post('/send', auth, requireRole(...allowedRoles), sendEmail);
router.post('/ai-generate-email', auth, requireRole(...allowedRoles), generateEmailMessage);
router.get('/verify-domain', auth, requireRole('admin', 'manager'), verifyEmailDomain);

export default router;

