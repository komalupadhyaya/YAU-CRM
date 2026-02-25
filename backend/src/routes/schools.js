import express from 'express';
import db from '../db.js';

const router = express.Router();

// GET /api/schools - all schools (optional search)
router.get('/', (req, res) => {
    const q = req.query.q ? `%${req.query.q}%` : '%';
    const schools = db.prepare('SELECT * FROM schools WHERE name LIKE ? ORDER BY name').all(q);
    res.json(schools);
});

// GET /api/schools/campaign/:campaignId - schools in a campaign
router.get('/campaign/:campaignId', (req, res) => {
    const schools = db.prepare('SELECT * FROM schools WHERE campaign_id = ? ORDER BY name').all(req.params.campaignId);
    res.json(schools);
});

// GET /api/schools/:id - single school detail
router.get('/:id', (req, res) => {
    const school = db.prepare('SELECT * FROM schools WHERE id = ?').get(req.params.id);
    if (!school) return res.status(404).json({ error: 'School not found' });
    res.json(school);
});

// POST /api/schools - create school manually
router.post('/', (req, res) => {
    const { campaign_id, name, type, grades, principal_name, principal_email, telephone, start_time, end_time, address, city, state, zip, website } = req.body;
    if (!name || !campaign_id) return res.status(400).json({ error: 'name and campaign_id are required' });
    const result = db.prepare(`
        INSERT INTO schools (campaign_id, name, type, grades, principal_name, principal_email, telephone, start_time, end_time, address, city, state, zip, website)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(campaign_id, name, type, grades, principal_name, principal_email, telephone, start_time, end_time, address, city, state, zip, website);
    const s = db.prepare('SELECT * FROM schools WHERE id = ?').get(result.lastInsertRowid);
    res.json(s);
});

// PUT /api/schools/:id - update school (never touches notes/followups)
router.put('/:id', (req, res) => {
    const { name, type, grades, principal_name, principal_email, telephone, start_time, end_time, address, city, state, zip, website } = req.body;
    db.prepare(`
        UPDATE schools SET name=?, type=?, grades=?, principal_name=?, principal_email=?, telephone=?,
            start_time=?, end_time=?, address=?, city=?, state=?, zip=?, website=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
    `).run(name, type, grades, principal_name, principal_email, telephone, start_time, end_time, address, city, state, zip, website, req.params.id);
    const s = db.prepare('SELECT * FROM schools WHERE id = ?').get(req.params.id);
    res.json(s);
});

export default router;
