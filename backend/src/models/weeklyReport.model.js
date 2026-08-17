import mongoose from 'mongoose';

const WeeklyReportSchema = new mongoose.Schema({
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    metrics: {
        totalNewLeads: { type: Number, default: 0 },
        leadsBySource: { type: Map, of: Number },
        contactedCount: { type: Number, default: 0 },
        uncontactedCount: { type: Number, default: 0 },
        followupsCompleted: { type: Number, default: 0 },
        followupsOverdue: { type: Number, default: 0 },
        meetingsBooked: { type: Number, default: 0 },
        eaConversions: { type: Number, default: 0 },
        topCounties: [{ county: String, count: Number }]
    },
    repPerformance: [{
        repId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        repName: String,
        callsMade: Number,
        followupsCompleted: Number,
        conversions: Number
    }],
    aiRecommendations: [{ type: String }],
    executiveSummary: { type: String },
    sentToEmail: { type: String, default: 'play@yausports.com' },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

export const WeeklyReport = mongoose.model('WeeklyReport', WeeklyReportSchema);
export default WeeklyReport;
