import * as importService from '../services/import.service.js';

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

        const result = await importService.processImport(req.file.buffer, campaign_id);
        res.json(result);
    } catch (err) {
        next(err);
    }
};
