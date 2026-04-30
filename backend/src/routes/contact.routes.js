import express from 'express';
import { getContactsByLead, createContact, updateContact, deleteContact } from '../controllers/contact.controller.js';

const router = express.Router();

router.get('/lead/:leadId', getContactsByLead);
router.post('/', createContact);
router.put('/:id', updateContact);
router.delete('/:id', deleteContact);

export default router;
