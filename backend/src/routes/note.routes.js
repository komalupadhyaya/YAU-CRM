import express from 'express';
import * as noteController from '../controllers/note.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();

const allRoles = ['admin', 'manager', 'sales_rep', 'view_only'];
const canWrite = ['admin', 'manager', 'sales_rep'];

router.get('/:schoolId', auth, requireRole(...allRoles), noteController.getNotesByLead);
router.post('/:schoolId', auth, requireRole(...canWrite), noteController.createNote);
router.delete('/:id', auth, requireRole('admin', 'manager'), noteController.deleteNote);
router.delete('/lead/:schoolId', auth, requireRole('admin', 'manager'), noteController.deleteAllNotes);

export default router;