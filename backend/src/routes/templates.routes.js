import express from 'express';
import {
    getTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    generateAiTemplate
} from '../controllers/templates.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();
const allowedRoles = ['admin', 'manager', 'sales_rep'];

router.get('/templates', auth, requireRole(...allowedRoles), getTemplates);
router.post('/templates', auth, requireRole(...allowedRoles), createTemplate);
router.put('/templates/:id', auth, requireRole(...allowedRoles), updateTemplate);
router.delete('/templates/:id', auth, requireRole(...allowedRoles), deleteTemplate);
router.post('/templates/ai-generate', auth, requireRole(...allowedRoles), generateAiTemplate);

export default router;
