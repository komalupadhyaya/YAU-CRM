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
    }
}, { timestamps: true });

export const Settings = mongoose.model('Settings', SettingsSchema);
export default Settings;
