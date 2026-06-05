import express from 'express';
import { sendEmail, verifyEmailDomain } from '../controllers/email.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();

router.post('/send', auth, requireRole('admin', 'manager', 'sales_rep'), sendEmail);
router.get('/verify-domain', auth, requireRole('admin', 'manager'), verifyEmailDomain);

export default router;
