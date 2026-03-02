import mongoose from 'mongoose';

const SettingsSchema = new mongoose.Schema({
    crmPreferences: {
        defaultFollowupDays: { type: Number, default: 7 }
    },
    statusLabels: {
        type: [String],
        default: [
            "Not Contacted",
            "Spoke to Office",
            "Meeting Scheduled",
            "Closed"
        ]
    }
}, { timestamps: true });

export const Settings = mongoose.model('Settings', SettingsSchema);
export default Settings;
