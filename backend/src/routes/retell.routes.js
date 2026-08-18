import express from 'express';
import * as retellController from '../controllers/retell.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();

/**
 * Capture raw request body specifically for HMAC signature checks on the webhook.
 * This reads the body buffer first, stores it in req.rawBody, then parses JSON.
 */
const rawBodyParser = (req, res, next) => {
    let data = [];
    req.on('data', chunk => {
        data.push(chunk);
    });
    req.on('end', () => {
        const buffer = Buffer.concat(data);
        req.rawBody = buffer;
        if (buffer.length > 0) {
            try {
                req.body = JSON.parse(buffer.toString('utf8'));
            } catch (err) {
                console.error('⚠️ Failed to parse raw request body as JSON:', err.message);
                req.body = {};
            }
        } else {
            req.body = {};
        }
        next();
    });
};

// --- Webhooks (Public) ---
router.post('/webhook', rawBodyParser, retellController.handleWebhook);
router.post('/collect-info', express.json(), retellController.collectLeadInfoTool);

// --- PBX Config & Monitoring (Admin/Authenticated) ---
router.get('/config', auth, requireRole('admin'), retellController.getConfig);
router.put('/config', auth, requireRole('admin'), retellController.updateConfig);
router.get('/calls', auth, requireRole('admin'), retellController.getRetellCalls);

export default router;
