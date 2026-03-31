import XLSX from 'xlsx';
import Campaign from '../models/campaign.model.js';
import Lead from '../models/lead.model.js';
import { getVal } from '../utils/import.utils.js';

/**
 * Parse a file buffer into an array of row objects.
 */
function parseBuffer(buffer, originalname) {
    const ext = originalname.split('.').pop().toLowerCase();
    const type = ext === 'csv' ? 'string' : 'buffer';
    const input = ext === 'csv' ? buffer.toString('utf8') : buffer;
    const workbook = XLSX.read(input, { type });
    const sheetName = workbook.SheetNames[0];
    return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
}

/**
 * Normalise a name for duplicate comparison.
 */
function normaliseName(name) {
    return String(name).trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Parse an Excel/CSV buffer and bulk-insert leads under a campaign.
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
        const rowNum = i + 2;

        try {
            const rawName = getVal(row, ['name', 'organization', 'lead', 'lead name', 'school name', 'school']);
            if (!rawName) {
                errors.push({ row: rowNum, reason: 'Missing Name / Organization' });
                continue;
            }
            const normName = normaliseName(rawName);

            const nameRegex = new RegExp(`^${normName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
            const duplicate = await Lead.findOne({
                campaign_id: campaignId,
                name: nameRegex
            });

            if (duplicate) {
                duplicates++;
                continue;
            }

            const leadData = {
                name: rawName.trim(),
                campaign_id: campaignId,
                type: getVal(row, ['type', 'lead type', 'lead type']),
                category_group: getVal(row, ['category/group', 'category', 'group', 'grades']),
                main_contact_name: getVal(row, ['main contact name', 'contact name', 'principal name', 'principal title', 'poc name']),
                main_contact_email: getVal(row, ['main contact email', 'contact email', 'principal email', 'email']),
                telephone: getVal(row, ['telephone', 'phone', 'phone number']),
                start_time: getVal(row, ['start time', 'lead start time']),
                end_time: getVal(row, ['end time', 'lead end time']),
                address_number: getVal(row, ['number', 'address number']),
                address: getVal(row, ['address', 'street']),
                city: getVal(row, ['city']),
                state: getVal(row, ['state']),
                zip: getVal(row, ['zip code', 'zip']),
                website: getVal(row, ['website']),
                status: getVal(row, ['contacted status', 'status']) || "Not Contacted"
            };

            const createdLead = await Lead.create(leadData);
            imported++;

            const rawNotes = getVal(row, ['notes', 'notes by dates']);
            if (rawNotes) {
                const Note = (await import('../models/note.model.js')).default;
                await Note.create({
                    lead_id: createdLead._id,
                    content: rawNotes
                });
            }
        } catch (rowErr) {
            errors.push({ row: rowNum, reason: rowErr.message || 'Unknown error' });
        }
    }

    const skipped = errors.length;
    return { totalRows, imported, skipped, duplicates, errors };
};
