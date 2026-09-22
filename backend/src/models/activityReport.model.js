import mongoose from 'mongoose';

const ReportActivitySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    userName: {
        type: String,
        required: true,
        trim: true
    },
    userRole: {
        type: String,
        enum: ['admin', 'manager', 'sales_rep', 'view_only'],
        required: true
    },
    managerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        index: true
    },
    reportType: {
        type: String,
        enum: ['daily', 'weekly'],
        required: true,
        index: true
    },
    submissionDate: {
        type: Date,
        default: Date.now,
        immutable: true, // Prevents post-submission tampering
        index: true
    },
    submissionSource: {
        type: String,
        enum: ['web', 'email'],
        default: 'web'
    },
    rawContent: {
        type: String,
        required: [true, 'Report content is required'],
        trim: true
    },
    aiFeedback: {
        goingWell: { type: String, default: '' },
        patternsOrRedFlags: { type: String, default: '' },
        recommendations: [{ type: String }],
        performanceScore: { type: Number, min: 0, max: 10, default: null },
        scoreSummary: { type: String, default: '' },
        rawResponse: { type: String, default: '' }
    },
    aiStatus: {
        type: String,
        enum: ['pending', 'evaluating', 'completed', 'failed'],
        default: 'pending',
        index: true
    },
    aiError: {
        type: String,
        default: null
    }
}, { timestamps: true, collection: 'reportactivities' });

// Compound indexes for rapid feed queries and role-based filtering
ReportActivitySchema.index({ submissionDate: -1, userId: 1 });
ReportActivitySchema.index({ managerId: 1, submissionDate: -1 });
ReportActivitySchema.index({ reportType: 1, submissionDate: -1 });

export const ReportActivity = mongoose.model('ReportActivity', ReportActivitySchema, 'reportactivities');
export const ActivityReport = ReportActivity; // Backward compatibility alias
export default ReportActivity;
