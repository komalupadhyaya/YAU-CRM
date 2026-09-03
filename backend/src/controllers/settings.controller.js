import Settings from '../models/settings.model.js';
import Lead from '../models/lead.model.js';
import User from '../models/user.model.js';

/**
 * GET /api/settings
 * Returns the singleton system configuration object and all active users for routing.
 * Creates a default document if none exists.
 */
export const getSettings = async (req, res, next) => {
    try {
        let settings = await Settings.findOne().populate('notificationSettings.repSettings.userId', 'name username email role phone isActive');

        if (!settings) {
            settings = await Settings.create({});
        }

        // Also fetch all active users so frontend can initialize routing settings for any user
        const users = await User.find({ isActive: true }).select('name username email role phone isActive').lean();

        res.json({
            ...settings.toObject(),
            allUsers: users
        });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/settings
 * Updates allowed system configuration fields including notification settings.
 */
export const updateSettings = async (req, res, next) => {
    try {
        const { crmPreferences, statusLabels, notificationSettings, aiAutoReply } = req.body;

        const updateData = {};
        if (crmPreferences) updateData.crmPreferences = crmPreferences;
        if (statusLabels) updateData.statusLabels = statusLabels;
        if (notificationSettings) updateData.notificationSettings = notificationSettings;
        if (aiAutoReply !== undefined) updateData.aiAutoReply = aiAutoReply;

        // Sync actual User document phone numbers from repSettings to user profile phone data
        if (notificationSettings && Array.isArray(notificationSettings.repSettings)) {
            for (const rs of notificationSettings.repSettings) {
                const uid = typeof rs.userId === "object" ? rs.userId._id : rs.userId;
                if (uid && rs.phone !== undefined) {
                    await User.findByIdAndUpdate(uid, { phone: rs.phone });
                }
            }
        }

        const settings = await Settings.findOneAndUpdate(
            {},
            updateData,
            { new: true, upsert: true }
        ).populate('notificationSettings.repSettings.userId', 'name username email role phone isActive');

        // CLEANUP: If status labels were updated, reassign leads with orphaned statuses
        if (statusLabels && Array.isArray(statusLabels) && statusLabels.length > 0) {
            const defaultStatus = statusLabels[0]; // e.g. "Not Contacted"
            await Lead.updateMany(
                { status: { $nin: statusLabels } },
                { $set: { status: defaultStatus } }
            );
        }

        const users = await User.find({ isActive: true }).select('name username email role phone isActive').lean();

        res.json({
            ...settings.toObject(),
            allUsers: users
        });
    } catch (err) {
        next(err);
    }
};

