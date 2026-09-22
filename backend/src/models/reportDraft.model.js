import mongoose from 'mongoose';

const ReportDraftSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    reportType: {
        type: String,
        enum: ['daily', 'weekly'],
        required: true,
        index: true
    },
    content: {
        type: String,
        default: ''
    }
}, { timestamps: true });

// Ensure unique draft per user + reportType
ReportDraftSchema.index({ userId: 1, reportType: 1 }, { unique: true });

const ReportDraft = mongoose.model('ReportDraft', ReportDraftSchema);
export default ReportDraft;
