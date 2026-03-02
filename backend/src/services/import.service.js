import XLSX from 'xlsx';
import Campaign from '../models/campaign.model.js';
import School from '../models/school.model.js';
import { getVal } from '../utils/import.utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a file buffer into an array of row objects.
 * Supports .xlsx and .csv — detected via the `mimetype` or `originalname`.
 */
function parseBuffer(buffer, originalname) {
    const ext = originalname.split('.').pop().toLowerCase();
    const type = ext === 'csv' ? 'string' : 'buffer';
    const input = ext === 'csv' ? buffer.toString('utf8') : buffer;
    const workbook = XLSX.read(input, { type });
    const sheetName = workbook.SheetNames[0];
    // defval: '' ensures missing cells come back as empty string, not undefined
    return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
}

/**
 * Normalise a school name for duplicate comparison:
 * trim whitespace + collapse internal spaces + lowercase.
 */
function normaliseName(name) {
    return String(name).trim().replace(/\s+/g, ' ').toLowerCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// processImport
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse an Excel/CSV buffer and bulk-insert schools under a campaign.
 *
 * Duplicate rule (non-destructive):
 *   A school is a duplicate when normalised(name) + campaign_id already exists.
 *   Duplicates are SKIPPED (not updated) and counted separately.
 *
 * @param {Buffer}  fileBuffer   Raw file buffer
 * @param {string}  campaignId   MongoDB ObjectId string
 * @param {string}  originalname Filename (used to detect .csv vs .xlsx)
 * @returns {{ totalRows, imported, skipped, duplicates, errors }}
 */
export const processImport = async (fileBuffer, campaignId, originalname = 'upload.xlsx') => {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
        throw new Error('Campaign not found');
    }

    const rows = parseBuffer(fileBuffer, originalname);
    const totalRows = rows.length;

    let imported = 0;
    let duplicates = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // 1-indexed + header row

        try {
            // ── Required field: school name ───────────────────────────────────
            const rawName = getVal(row, ['school name', 'name', 'school']);
            if (!rawName) {
                errors.push({ row: rowNum, reason: 'Missing School Name' });
                continue;
            }
            const normName = normaliseName(rawName);

            // ── Duplicate check (case-insensitive + trimmed) ──────────────────
            // Uses a regex anchored to the normalised name so DB collation doesn't matter.
            const nameRegex = new RegExp(`^${normName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
            const duplicate = await School.findOne({
                campaign_id: campaignId,
                name: nameRegex
            });

            if (duplicate) {
                duplicates++;
                continue; // skip — non-destructive
            }

            // ── Build school data object ──────────────────────────────────────
            const schoolData = {
                name: rawName.trim(), // preserve original casing for display
                campaign_id: campaignId,
                type: getVal(row, ['school type', 'type']),
                grades: getVal(row, ['grades']),
                principal_name: getVal(row, ['principal name', 'principal title', 'poc name', 'contact name']),
                principal_email: getVal(row, ['principal email', 'email']),
                telephone: getVal(row, ['telephone', 'phone', 'phone number']),
                start_time: getVal(row, ['school start time', 'start time']),
                end_time: getVal(row, ['school end time', 'end time']),
                address: getVal(row, ['address']),
                city: getVal(row, ['city']),
                state: getVal(row, ['state']),
                zip: getVal(row, ['zip code', 'zip']),
                website: getVal(row, ['website'])
            };

            await School.create(schoolData);
            imported++;
        } catch (rowErr) {
            // One bad row should never abort the whole import
            errors.push({ row: rowNum, reason: rowErr.message || 'Unknown error' });
        }
    }

    const skipped = errors.length; // rows with validation/parse errors
    return { totalRows, imported, skipped, duplicates, errors };
};
