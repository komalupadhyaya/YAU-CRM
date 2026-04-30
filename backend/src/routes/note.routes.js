import express from 'express';
import * as noteController from '../controllers/note.controller.js';

const router = express.Router();

router.get('/:schoolId', noteController.getNotesByLead);
router.post('/:schoolId', noteController.createNote);
router.delete('/:id', noteController.deleteNote);
router.delete('/lead/:schoolId', noteController.deleteAllNotes);

export default router;
