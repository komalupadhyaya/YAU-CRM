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

// GET /api/schools/campaign-summaries - bulk stats for all campaigns
router.get('/campaign-summaries', async (req, res) => {
    try {
        const summaries = await School.aggregate([
            {
                $group: {
                    _id: "$campaign_id",
                    totalSchools: { $sum: 1 },
                    meetingsScheduled: {
                        $sum: { $cond: [{ $eq: ["$status", "Meeting Scheduled"] }, 1, 0] }
                    }
                }
            }
        ]);
        res.json(summaries || []);
    } catch (err) {
        console.error("Campaign summaries aggregation error:", err);
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
        // Safety: check if id is a valid ObjectId string
        if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ error: 'Invalid ID format' });
        }
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

// PATCH /api/schools/:id - update school status
router.patch('/:id', async (req, res) => {
    try {
        const { status } = req.body;
        if (!status) return res.status(400).json({ error: 'status is required' });

        const school = await School.findByIdAndUpdate(req.params.id, {
            status
        }, { new: true });

        if (!school) return res.status(404).json({ error: 'School not found' });
        res.json(school);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/schools/campaign/:campaignId/school-counts - dashboard stats
router.get('/campaign/:campaignId/school-counts', async (req, res) => {
    try {
        const campaign_id = req.params.campaignId;
        const totalSchools = await School.countDocuments({ campaign_id });
        const contactedSchools = await School.countDocuments({
            campaign_id,
            status: { $ne: 'Not Contacted' }
        });

        res.json({ totalSchools, contactedSchools });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
