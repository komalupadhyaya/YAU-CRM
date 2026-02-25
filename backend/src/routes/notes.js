import express from 'express';
import db from '../db.js';

const router = express.Router();

// GET /api/notes/:schoolId - list notes for a school
router.get('/:schoolId', (req, res) => {
    const notes = db.prepare('SELECT * FROM notes WHERE school_id = ? ORDER BY created_at DESC').all(req.params.schoolId);
    res.json(notes);
});

// POST /api/notes/:schoolId - add a note (append-only)
router.post('/:schoolId', (req, res) => {
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Note content is required' });
    const result = db.prepare('INSERT INTO notes (school_id, content) VALUES (?, ?)').run(req.params.schoolId, content.trim());
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid);
    res.json(note);
});

export default router;
