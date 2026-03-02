import * as importService from '../services/import.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/import  –  LEGACY endpoint (untouched, still fully functional)
// campaign_id comes from req.body; accepts .xlsx only
// ─────────────────────────────────────────────────────────────────────────────
export const importSchools = async (req, res, next) => {
    try {
        if (!req.file) {
            res.status(400);
            throw new Error('No file uploaded');
        }
        if (!req.file.originalname.toLowerCase().endsWith('.xlsx')) {
            res.status(400);
            throw new Error('Only .xlsx files are accepted');
        }

        const { campaign_id } = req.body;
        if (!campaign_id) {
            res.status(400);
            throw new Error('campaign_id is required');
        }

        const result = await importService.processImport(
            req.file.buffer,
            campaign_id,
            req.file.originalname
        );
        res.json(result);
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/campaigns/:id/import  –  Campaign-scoped upload
// campaign_id comes from URL param; accepts .xlsx and .csv
// ─────────────────────────────────────────────────────────────────────────────
export const importSchoolsForCampaign = async (req, res, next) => {
    try {
        if (!req.file) {
            res.status(400);
            throw new Error('No file uploaded');
        }

        const ext = req.file.originalname.split('.').pop().toLowerCase();
        if (!['xlsx', 'csv'].includes(ext)) {
            res.status(400);
            throw new Error('Only .xlsx and .csv files are accepted');
        }

        const campaignId = req.params.id;
        if (!campaignId || !campaignId.match(/^[0-9a-fA-F]{24}$/)) {
            res.status(400);
            throw new Error('Invalid or missing campaign ID');
        }

        const result = await importService.processImport(
            req.file.buffer,
            campaignId,
            req.file.originalname
        );
        res.json(result);
    } catch (err) {
        next(err);
    }
};
