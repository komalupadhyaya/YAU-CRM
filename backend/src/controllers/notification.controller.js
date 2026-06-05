import Notification from '../models/notification.model.js';

/**
 * GET /api/notifications
 * Returns latest 20 notifications for the logged-in user.
 * Supports ?unread=true to return only unread count.
 */
export const getNotifications = async (req, res, next) => {
    try {
        const notifications = await Notification.find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();

        const unreadCount = await Notification.countDocuments({
            userId: req.user.id,
            isRead: false
        });

        res.json({ notifications, unreadCount });
    } catch (err) {
        next(err);
    }
};

/**
 * PUT /api/notifications/:id/read
 * Marks a single notification as read.
 */
export const markOneRead = async (req, res, next) => {
    try {
        await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            { isRead: true }
        );
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

/**
 * PUT /api/notifications/read-all
 * Marks all notifications for the logged-in user as read.
 */
export const markAllRead = async (req, res, next) => {
    try {
        await Notification.updateMany(
            { userId: req.user.id, isRead: false },
            { isRead: true }
        );
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

/**
 * DELETE /api/notifications/:id
 * Deletes a single notification.
 */
export const deleteOne = async (req, res, next) => {
    try {
        await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

/**
 * DELETE /api/notifications/delete-all
 * Deletes all notifications for the logged-in user.
 */
export const deleteAll = async (req, res, next) => {
    try {
        await Notification.deleteMany({ userId: req.user.id });
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

