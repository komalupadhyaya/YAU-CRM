import express from 'express';
import db from '../db.js';

const router = express.Router();

// GET /api/campaigns
router.get('/', (req, res) => {
    const campaigns = db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC').all();
    res.json(campaigns);
});

// POST /api/campaigns
router.post('/', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Campaign name is required' });
    const result = db.prepare('INSERT INTO campaigns (name) VALUES (?)').run(name);
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(result.lastInsertRowid);
    res.json(campaign);
});

export default router;
