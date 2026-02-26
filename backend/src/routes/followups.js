import express from 'express';
import { Followup, School } from '../db.js';

const router = express.Router();

// POST /api/followups/:schoolId - create a follow-up
router.post('/:schoolId', async (req, res) => {
    try {
        const { follow_up_date, reason } = req.body;
        if (!follow_up_date) return res.status(400).json({ error: 'follow_up_date is required' });

        const fu = await Followup.create({
            school_id: req.params.schoolId,
            follow_up_date,
            reason: reason || ''
        });
        res.json(fu);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/followups/:id/complete - mark as done
router.put('/:id/complete', async (req, res) => {
    try {
        const fu = await Followup.findByIdAndUpdate(req.params.id, {
            status: 'done',
            completed_at: new Date()
        }, { new: true });

        if (!fu) return res.status(404).json({ error: 'Follow-up not found' });

        // Auto update last_contacted
        await School.findByIdAndUpdate(
            fu.school_id,
            { last_contacted: new Date() }
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/followups/school/:schoolId - followups for a school
router.get('/school/:schoolId', async (req, res) => {
    try {
        const followups = await Followup.find({ school_id: req.params.schoolId })
            .populate({
                path: 'school_id',
                select: 'name telephone campaign_id',
                populate: { path: 'campaign_id', select: 'name' }
            })
            .sort({ follow_up_date: 1 });

        const flatFollowups = followups.map(f => {
            const data = f.toJSON();
            return {
                ...data,
                school_name: data.school_id?.name,
                telephone: data.school_id?.telephone,
                campaign_name: data.school_id?.campaign_id?.name
            };
        });

        res.json(flatFollowups);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/followups/dashboard - grouped follow-ups for dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

        const all = await Followup.find({ status: 'pending' })
            .populate({
                path: 'school_id',
                select: 'name telephone campaign_id',
                populate: { path: 'campaign_id', select: 'name' }
            })
            .sort({ follow_up_date: 1 });

        const flatAll = all.map(f => {
            const data = f.toJSON();
            return {
                ...data,
                school_name: data.school_id?.name,
                school_id_val: data.school_id?._id,
                telephone: data.school_id?.telephone,
                campaign_name: data.school_id?.campaign_id?.name,
                campaign_id_val: data.school_id?.campaign_id?._id
            };
        });

        const overdue = flatAll.filter(f => f.follow_up_date < today);
        const due = flatAll.filter(f => f.follow_up_date === today);
        const upcoming = flatAll.filter(f => f.follow_up_date > today);

        res.json({ overdue, due, upcoming, all: flatAll });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
