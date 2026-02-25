import express from 'express';
import db from '../db.js';

const router = express.Router();

// POST /api/followups/:schoolId - create a follow-up
router.post('/:schoolId', (req, res) => {
    const { follow_up_date, reason } = req.body;
    if (!follow_up_date) return res.status(400).json({ error: 'follow_up_date is required' });
    const result = db.prepare('INSERT INTO followups (school_id, follow_up_date, reason) VALUES (?, ?, ?)').run(req.params.schoolId, follow_up_date, reason || '');
    const fu = db.prepare('SELECT * FROM followups WHERE id = ?').get(result.lastInsertRowid);
    res.json(fu);
});

// PUT /api/followups/:id/complete - mark as done
router.put('/:id/complete', (req, res) => {
    db.prepare("UPDATE followups SET status='done', completed_at=CURRENT_TIMESTAMP WHERE id=?").run(req.params.id);
    res.json({ success: true });
});

// GET /api/followups/school/:schoolId - followups for a school
router.get('/school/:schoolId', (req, res) => {
    const followups = db.prepare(`
        SELECT f.*, s.name as school_name, s.telephone, c.name as campaign_name
        FROM followups f
        JOIN schools s ON s.id = f.school_id
        JOIN campaigns c ON c.id = s.campaign_id
        WHERE f.school_id = ?
        ORDER BY f.follow_up_date ASC
    `).all(req.params.schoolId);
    res.json(followups);
});

// GET /api/followups/dashboard - grouped follow-ups for dashboard
router.get('/dashboard', (req, res) => {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const all = db.prepare(`
        SELECT f.*, s.name as school_name, s.id as school_id, s.telephone, c.name as campaign_name, c.id as campaign_id
        FROM followups f
        JOIN schools s ON s.id = f.school_id
        JOIN campaigns c ON c.id = s.campaign_id
        WHERE f.status = 'pending'
        ORDER BY f.follow_up_date ASC
    `).all();

    const overdue = all.filter(f => f.follow_up_date < today);
    const due = all.filter(f => f.follow_up_date === today);
    const upcoming = all.filter(f => f.follow_up_date > today);

    res.json({ overdue, due, upcoming, all });
});

export default router;
