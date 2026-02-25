import express from 'express';
import { School } from '../db.js';

const router = express.Router();

// GET /api/schools - all schools (optional search)
router.get('/', async (req, res) => {
    try {
        let query = {};
        if (req.query.q) {
            query.name = { $regex: req.query.q, $options: 'i' };
        }
        const schools = await School.find(query).sort({ name: 1 });
        res.json(schools);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/schools/campaign/:campaignId - schools in a campaign
router.get('/campaign/:campaignId', async (req, res) => {
    try {
        const schools = await School.find({ campaign_id: req.params.campaignId }).sort({ name: 1 });
        res.json(schools);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/schools/:id - single school detail
router.get('/:id', async (req, res) => {
    try {
        const school = await School.findById(req.params.id);
        if (!school) return res.status(404).json({ error: 'School not found' });
        res.json(school);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/schools - create school manually
router.post('/', async (req, res) => {
    try {
        const { campaign_id, name, type, grades, principal_name, principal_email, telephone, start_time, end_time, address, city, state, zip, website } = req.body;
        if (!name || !campaign_id) return res.status(400).json({ error: 'name and campaign_id are required' });

        const school = await School.create({
            campaign_id, name, type, grades, principal_name, principal_email, telephone,
            start_time, end_time, address, city, state, zip, website
        });
        res.json(school);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/schools/:id - update school
router.put('/:id', async (req, res) => {
    try {
        const { name, type, grades, principal_name, principal_email, telephone, start_time, end_time, address, city, state, zip, website } = req.body;
        const school = await School.findByIdAndUpdate(req.params.id, {
            name, type, grades, principal_name, principal_email, telephone,
            start_time, end_time, address, city, state, zip, website
        }, { new: true });

        if (!school) return res.status(404).json({ error: 'School not found' });
        res.json(school);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
