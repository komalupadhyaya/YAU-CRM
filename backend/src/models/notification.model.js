import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['task_reminder', 'followup_reminder'],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    link: {
        type: String,
        default: '/'
    },
    isRead: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// Auto-delete notifications older than 7 days
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

const Notification = mongoose.model('Notification', NotificationSchema);
export default Notification;
