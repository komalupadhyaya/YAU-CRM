import express from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import db from '../db.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Normalize Excel column names and safely return values
 */
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

/**
 * POST /api/import
 * Upload Excel and import schools into a campaign
 */
router.post('/', upload.single('file'), (req, res) => {
    try {
        // 1. Basic validation
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        if (!req.file.originalname.toLowerCase().endsWith('.xlsx')) {
            return res.status(400).json({ error: 'Only .xlsx files are accepted' });
        }

        const { campaignId } = req.body;
        if (!campaignId) {
            return res.status(400).json({ error: 'campaignId is required' });
        }

        const campaign = db
            .prepare('SELECT id FROM campaigns WHERE id = ?')
            .get(campaignId);

        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        // 2. Read Excel
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(
            workbook.Sheets[sheetName],
            { defval: '' }
        );

        let added = 0;
        let updated = 0;
        const errors = [];

        // 3. Transaction for safety
        const tx = db.transaction(() => {
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const rowNum = i + 2; // header + 1

                const name = getVal(row, ['school name']);
                if (!name) {
                    errors.push({ row: rowNum, reason: 'Missing School Name' });
                    continue;
                }

                const type = getVal(row, ['school type']);
                const grades = getVal(row, ['grades']);
                const principalName = getVal(row, ['principal name', 'principal title', 'poc name']);
                const principalEmail = getVal(row, ['principal email']);
                const telephone = getVal(row, ['telephone']);
                const startTime = getVal(row, ['school start time', 'start time']);
                const endTime = getVal(row, ['school end time', 'end time']);
                const address = getVal(row, ['address']);
                const city = getVal(row, ['city']);
                const state = getVal(row, ['state']);
                const zip = getVal(row, ['zip code', 'zip']);
                const website = getVal(row, ['website']);

                // 4. Matching rules
                let existing = null;

                if (telephone) {
                    existing = db.prepare(`
            SELECT * FROM schools
            WHERE campaign_id = ?
              AND LOWER(name) = LOWER(?)
              AND telephone = ?
          `).get(campaignId, name, telephone);
                } else if (address) {
                    existing = db.prepare(`
            SELECT * FROM schools
            WHERE campaign_id = ?
              AND LOWER(name) = LOWER(?)
              AND LOWER(address) = LOWER(?)
          `).get(campaignId, name, address);
                }

                // 5. Update or Insert
                if (existing) {
                    db.prepare(`
            UPDATE schools SET
              type = ?,
              grades = ?,
              principal_name = ?,
              principal_email = ?,
              telephone = ?,
              start_time = ?,
              end_time = ?,
              address = ?,
              city = ?,
              state = ?,
              zip = ?,
              website = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(
                        type,
                        grades,
                        principalName,
                        principalEmail,
                        telephone,
                        startTime,
                        endTime,
                        address,
                        city,
                        state,
                        zip,
                        website,
                        existing.id
                    );
                    updated++;
                } else {
                    db.prepare(`
            INSERT INTO schools (
              campaign_id,
              name,
              type,
              grades,
              principal_name,
              principal_email,
              telephone,
              start_time,
              end_time,
              address,
              city,
              state,
              zip,
              website
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
                        campaignId,
                        name,
                        type,
                        grades,
                        principalName,
                        principalEmail,
                        telephone,
                        startTime,
                        endTime,
                        address,
                        city,
                        state,
                        zip,
                        website
                    );
                    added++;
                }
            }
        });

        tx();

        // 6. Final response (frontend expects this)
        res.json({
            added,
            updated,
            skipped: errors.length,
            errors
        });

    } catch (err) {
        console.error('IMPORT ERROR:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;