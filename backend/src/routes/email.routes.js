import express from 'express';
import { sendEmail, verifyEmailDomain } from '../controllers/email.controller.js';

const router = express.Router();

router.post('/send', sendEmail);
router.get('/verify-domain', verifyEmailDomain);

export default router;
