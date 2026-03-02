import express from 'express';
import * as noteController from '../controllers/note.controller.js';

const router = express.Router();

router.get('/:schoolId', noteController.getNotesBySchool);
router.post('/:schoolId', noteController.createNote);

export default router;
