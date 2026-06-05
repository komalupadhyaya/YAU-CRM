import express from 'express';
import { getContactsByLead, createContact, updateContact, deleteContact } from '../controllers/contact.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();

const allRoles = ['admin', 'manager', 'sales_rep', 'view_only'];
const canWrite = ['admin', 'manager', 'sales_rep'];

router.get('/lead/:leadId', auth, requireRole(...allRoles), getContactsByLead);
router.post('/', auth, requireRole(...canWrite), createContact);
router.put('/:id', auth, requireRole(...canWrite), updateContact);
router.delete('/:id', auth, requireRole('admin', 'manager'), deleteContact);

export default router;
