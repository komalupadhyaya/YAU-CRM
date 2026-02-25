import express from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import { Campaign, School } from '../db.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function getVal(row, keys) {
    for (const key of keys) {
        for (const col of Object.keys(row)) {
            if (col.trim().toLowerCase() === key.toLowerCase()) {
                const v = row[col];
                return v !== undefined && v !== null ? String(v).trim() : '';
            }
        }
    }
    return '';
}

router.post('/', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        if (!req.file.originalname.toLowerCase().endsWith('.xlsx')) {
            return res.status(400).json({ error: 'Only .xlsx files are accepted' });
        }

        const { campaign_id } = req.body;
        if (!campaign_id) return res.status(400).json({ error: 'campaign_id is required' });

        const campaign = await Campaign.findById(campaign_id);
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

        let added = 0;
        let updated = 0;
        const errors = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2;

            const name = getVal(row, ['school name']);
            if (!name) {
                errors.push({ row: rowNum, reason: 'Missing School Name' });
                continue;
            }

            const schoolData = {
                type: getVal(row, ['school type']),
                grades: getVal(row, ['grades']),
                principal_name: getVal(row, ['principal name', 'principal title', 'poc name']),
                principal_email: getVal(row, ['principal email']),
                telephone: getVal(row, ['telephone']),
                start_time: getVal(row, ['school start time', 'start time']),
                end_time: getVal(row, ['school end time', 'end time']),
                address: getVal(row, ['address']),
                city: getVal(row, ['city']),
                state: getVal(row, ['state']),
                zip: getVal(row, ['zip code', 'zip']),
                website: getVal(row, ['website']),
                campaign_id: campaign_id
            };

            let existing = null;
            if (schoolData.telephone) {
                existing = await School.findOne({
                    campaign_id: campaign_id,
                    name: { $regex: new RegExp('^' + name + '$', 'i') },
                    telephone: schoolData.telephone
                });
            } else if (schoolData.address) {
                existing = await School.findOne({
                    campaign_id: campaign_id,
                    name: { $regex: new RegExp('^' + name + '$', 'i') },
                    address: { $regex: new RegExp('^' + schoolData.address + '$', 'i') }
                });
            }

            if (existing) {
                await School.findByIdAndUpdate(existing._id, schoolData);
                updated++;
            } else {
                await School.create({ ...schoolData, name });
                added++;
            }
        }

        res.json({ added, updated, skipped: errors.length, errors });
    } catch (err) {
        console.error('IMPORT ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;