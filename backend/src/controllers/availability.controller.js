import UserAvailability from '../models/userAvailability.model.js';
import User from '../models/user.model.js';

/**
 * GET /api/availability/:userId
 * Fetch a team member's availability schedule.
 * Any authenticated user can view (needed for conflict checking during meeting creation).
 */
export const getAvailability = async (req, res, next) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId).select('name email');
        if (!user) {
            res.status(404);
            throw new Error('User not found.');
        }

        const availability = await UserAvailability.findOne({ user_id: userId });

        // Return empty availability if not yet set — frontend shows all days as off
        if (!availability) {
            return res.json({
                user_id: userId,
                weekly_schedule: {
                    monday:    { enabled: false, start: null, end: null },
                    tuesday:   { enabled: false, start: null, end: null },
                    wednesday: { enabled: false, start: null, end: null },
                    thursday:  { enabled: false, start: null, end: null },
                    friday:    { enabled: false, start: null, end: null },
                    saturday:  { enabled: false, start: null, end: null },
                    sunday:    { enabled: false, start: null, end: null }
                },
                date_range_start: null,
                date_range_end: null,
                custom_schedule: [],
                blocked_dates: []
            });
        }

        res.json(availability);
    } catch (err) {
        next(err);
    }
};

/**
 * PUT /api/availability/:userId
 * Save or update a team member's availability.
 * Users can only update their own; admins can update anyone.
 */
export const setAvailability = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { weekly_schedule, blocked_dates, date_range_start, date_range_end, custom_schedule } = req.body;

        // Permission check: user can only update their own availability unless admin
        if (req.currentUserRole !== 'admin' && req.user.id !== userId) {
            res.status(403);
            throw new Error('Access denied. You can only update your own availability.');
        }

        const user = await User.findById(userId);
        if (!user) {
            res.status(404);
            throw new Error('User not found.');
        }

        const availability = await UserAvailability.findOneAndUpdate(
            { user_id: userId },
            {
                user_id: userId,
                weekly_schedule: weekly_schedule || {},
                blocked_dates: blocked_dates || [],
                date_range_start: date_range_start || null,
                date_range_end: date_range_end || null,
                custom_schedule: custom_schedule || []
            },
            { upsert: true, new: true, runValidators: true }
        );

        res.json(availability);
    } catch (err) {
        next(err);
    }
};
