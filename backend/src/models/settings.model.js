import mongoose from 'mongoose';

const SettingsSchema = new mongoose.Schema({
    crmPreferences: {
        defaultFollowupDays: { type: Number, default: 7 }
    },
    statusLabels: {
        type: [String],
        default: [
            "Not Contacted",
            "Attempted Contact",
            "Spoke to Front Office",
            "Spoke to Decision Maker",
            "Waiting on Reply",
            "Follow-Up Needed",
            "Meeting Scheduled",
            "Proposal Sent",
            "Interested",
            "Not Interested",
            "Program Confirmed",
            "On Hold"
        ]
    },
    notificationSettings: {
        global: {
            inAppEnabled: { type: Boolean, default: true },
            emailEnabled: { type: Boolean, default: true },
            smsForwardEnabled: { type: Boolean, default: true },
            fallbackEmails: { type: [String], default: [] },
            fallbackPhone: { type: String, default: "" }
        },
        repSettings: [{
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
            inAppEnabled: { type: Boolean, default: true },
            emailEnabled: { type: Boolean, default: true },
            smsForwardEnabled: { type: Boolean, default: true },
            emails: { type: [String], default: [] },
            phone: { type: String, default: "" }
        }]
    },
    aiAutoReply: {
        enabled: { type: Boolean, default: false },
        eaLeadsOnly: { type: Boolean, default: true }
    }
}, { timestamps: true });

export const Settings = mongoose.model('Settings', SettingsSchema);
export default Settings;
