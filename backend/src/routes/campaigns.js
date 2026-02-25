import express from 'express';
import { Campaign } from '../db.js';

const router = express.Router();

// GET /api/campaigns
router.get('/', async (req, res) => {
    try {
        const campaigns = await Campaign.find().sort({ createdAt: -1 });
        res.json(campaigns);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/campaigns
router.post('/', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Campaign name is required' });
        const campaign = await Campaign.create({ name });
        res.json(campaign);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
