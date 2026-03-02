import Settings from '../models/settings.model.js';

/**
 * GET /api/settings
 * Returns the singleton system configuration object.
 * Creates a default document if none exists.
 */
export const getSettings = async (req, res, next) => {
    try {
        let settings = await Settings.findOne();

        if (!settings) {
            settings = await Settings.create({});
        }

        res.json(settings);
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/settings
 * Updates allowed system configuration fields.
 */
export const updateSettings = async (req, res, next) => {
    try {
        const { crmPreferences, statusLabels } = req.body;

        const updateData = {};
        if (crmPreferences) updateData.crmPreferences = crmPreferences;
        if (statusLabels) updateData.statusLabels = statusLabels;

        const settings = await Settings.findOneAndUpdate(
            {},
            updateData,
            { new: true, upsert: true }
        );

        res.json(settings);
    } catch (err) {
        next(err);
    }
};
