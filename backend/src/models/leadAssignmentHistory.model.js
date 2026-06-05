import mongoose from 'mongoose';

const LeadAssignmentHistorySchema = new mongoose.Schema({
    lead_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    assigned_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assigned_from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assigned_to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

export const LeadAssignmentHistory = mongoose.model('LeadAssignmentHistory', LeadAssignmentHistorySchema);
export default LeadAssignmentHistory;
