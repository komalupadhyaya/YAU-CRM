import express from 'express';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';
import {
    getMarketingContacts,
    getMarketingContactStats,
    getMarketingContactById,
    deleteMarketingContact,
    updateMarketingContactStatus,
    createMarketingContact,
    updateMarketingContact
} from '../controllers/marketingContacts.controller.js';

const router = express.Router();

const allowedRoles = ['admin'];

// List, creation and stats - Admin Only
router.get('/', auth, requireRole(...allowedRoles), getMarketingContacts);
router.post('/', auth, requireRole(...allowedRoles), createMarketingContact);
router.get('/stats', auth, requireRole(...allowedRoles), getMarketingContactStats);

// Single contact & actions - Admin Only
router.get('/:id', auth, requireRole(...allowedRoles), getMarketingContactById);
router.put('/:id', auth, requireRole(...allowedRoles), updateMarketingContact);
router.patch('/:id/status', auth, requireRole(...allowedRoles), updateMarketingContactStatus);
router.delete('/:id', auth, requireRole(...allowedRoles), deleteMarketingContact);

export default router;
