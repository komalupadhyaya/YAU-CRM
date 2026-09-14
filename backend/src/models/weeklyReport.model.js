import mongoose from 'mongoose';

const WeeklyReportSchema = new mongoose.Schema({
    weekStartDate: {
        type: Date,
        required: true,
        index: true
    },
    weekEndDate: {
        type: Date,
        required: true,
        index: true
    },
    generatedAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    rawStats: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    executiveSummary: {
        type: String,
        required: true
    },
    emailHtml: {
        type: String,
        default: ''
    },
    recipient: {
        type: String,
        default: 'play@yausports.com'
    },
    status: {
        type: String,
        enum: ['generated', 'sent', 'failed'],
        default: 'generated',
        index: true
    },
    error: {
        type: String,
        default: null
    }
}, { timestamps: true });

export const WeeklyReport = mongoose.model('WeeklyReport', WeeklyReportSchema);
export default WeeklyReport;
