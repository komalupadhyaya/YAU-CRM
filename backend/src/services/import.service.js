import XLSX from 'xlsx';
import Campaign from '../models/campaign.model.js';
import School from '../models/school.model.js';
import { getVal } from '../utils/import.utils.js';

export const processImport = async (fileBuffer, campaignId) => {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
        throw new Error('Campaign not found');
    }

    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
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
            campaign_id: campaignId
        };

        let existing = null;
        if (schoolData.telephone) {
            existing = await School.findOne({
                campaign_id: campaignId,
                name: { $regex: new RegExp('^' + name + '$', 'i') },
                telephone: schoolData.telephone
            });
        } else if (schoolData.address) {
            existing = await School.findOne({
                campaign_id: campaignId,
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

    return { added, updated, skipped: errors.length, errors };
};
