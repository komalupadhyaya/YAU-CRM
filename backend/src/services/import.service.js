import XLSX from 'xlsx';
import Campaign from '../models/campaign.model.js';
import Lead from '../models/lead.model.js';
import Contact from '../models/contact.model.js';
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
            const rawName = getVal(row, ['name/organization', 'name', 'organization', 'lead', 'lead name', 'school name', 'school']);
            if (!rawName) {
                errors.push({ row: rowNum, reason: 'Missing Name / Organization' });
                continue;
            }
            const normName = normaliseName(rawName);

            const leadData = {
                name: rawName.trim(),
                campaign_id: campaignId,
                type: getVal(row, ['lead type', 'type']),
                category_group: getVal(row, ['category/group', 'category', 'group', 'grades']),
                telephone: getVal(row, ['telephone', 'phone', 'phone number']),
                department: getVal(row, ['lead department', 'department']),
                start_time: getVal(row, ['start time', 'school start time', 'lead start time']),
                end_time: getVal(row, ['end time', 'school end time', 'lead end time']),
                address_number: getVal(row, ['address number', 'number', 'address_number']),
                address: getVal(row, ['address', 'street', 'street name']),
                city: getVal(row, ['city']),
                state: getVal(row, ['state']),
                zip: getVal(row, ['zip code', 'zip']),
                website: getVal(row, ['website']),
                status: getVal(row, ['contacted status', 'status']) || "Not Contacted"
            };

            let lead;
            const nameRegex = new RegExp(`^${normName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
            const existingLead = await Lead.findOne({ campaign_id: campaignId, name: nameRegex });

            if (existingLead) {
                // Update existing lead
                lead = await Lead.findByIdAndUpdate(existingLead._id, leadData, { new: true });
                imported++; // Count as imported since we updated it
            } else {
                // Create new lead
                lead = await Lead.create(leadData);
                imported++;
            }

            // ── Handle Primary Contact ──────────────────────────────────────────
            const primaryName = getVal(row, ['primary contact name', 'principal name', 'poc name', 'main contact name', 'contact name']);
            if (primaryName) {
                const primaryData = {
                    name: primaryName,
                    title: getVal(row, ['primary contact title', 'principal title', 'title']),
                    department: getVal(row, ['primary contact department', 'contact department', 'primary department']),
                    email: getVal(row, ['primary contact email', 'principal email', 'email', 'main contact email']),
                    direct_phone: getVal(row, ['primary contact phone', 'principal phone', 'direct phone', 'phone']),
                    best_time: getVal(row, ['primary best time', 'best time', 'best time to call']),
                    preferred_method: getVal(row, ['primary preferred method', 'preferred method', 'contact method']),
                    is_primary: true
                };
                await Contact.findOneAndUpdate(
                    { lead_id: lead._id, is_primary: true },
                    primaryData,
                    { upsert: true }
                );
            }

            // ── Handle Secondary Contact ────────────────────────────────────────
            const secondaryName = getVal(row, ['secondary contact name', 'secondary name']);
            if (secondaryName) {
                const secondaryData = {
                    name: secondaryName,
                    title: getVal(row, ['secondary contact title', 'secondary title']),
                    department: getVal(row, ['secondary contact department', 'secondary department']),
                    email: getVal(row, ['secondary contact email', 'secondary email']),
                    direct_phone: getVal(row, ['secondary contact phone', 'secondary phone']),
                    best_time: getVal(row, ['secondary best time', 'best time', 'best time to call']),
                    preferred_method: getVal(row, ['secondary preferred method', 'preferred method', 'contact method']),
                    is_primary: false
                };
                await Contact.findOneAndUpdate(
                    { lead_id: lead._id, is_primary: false },
                    secondaryData,
                    { upsert: true }
                );
            }

            const rawNotes = getVal(row, ['notes', 'notes by dates']);
            if (rawNotes) {
                const Note = (await import('../models/note.model.js')).default;
                await Note.create({
                    lead_id: lead._id,
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
