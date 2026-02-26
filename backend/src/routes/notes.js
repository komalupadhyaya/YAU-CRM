import express from 'express';
import { Note, School } from '../db.js';

const router = express.Router();

// GET /api/notes/:schoolId - list notes for a school
router.get('/:schoolId', async (req, res) => {
    try {
        const notes = await Note.find({ school_id: req.params.schoolId }).sort({ createdAt: -1 });
        res.json(notes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/notes/:schoolId - add a note (append-only)
router.post('/:schoolId', async (req, res) => {
    try {
        const { content } = req.body;
        if (!content || !content.trim()) return res.status(400).json({ error: 'Note content is required' });

        const note = await Note.create({
            school_id: req.params.schoolId,
            content: content.trim()
        });

        // Auto update last_contacted
        await School.findByIdAndUpdate(
            req.params.schoolId,
            { last_contacted: new Date() }
        );

        res.json(note);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
