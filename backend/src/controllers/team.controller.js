import User from '../models/user.model.js';

/**
 * GET /api/team
 * Returns a list of users with limited safe fields.
 */
export const getUsers = async (req, res, next) => {
    try {
        // Exclude passwords and sensitive auth fields
        const users = await User.find({}, 'username name email role createdAt')
            .sort({ createdAt: -1 });

        // Ensure role defaults to 'user' for older records in response
        const safeUsers = users.map(u => {
            const userObj = u.toObject();
            if (!userObj.role) userObj.role = 'user';
            return userObj;   
        });

        res.json(safeUsers);
    } catch (err) {
        next(err);
    }
};
