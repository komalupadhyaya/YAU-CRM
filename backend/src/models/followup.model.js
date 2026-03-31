import mongoose from 'mongoose';

const FollowupSchema = new mongoose.Schema({
    lead_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    follow_up_date: { type: String, required: true }, // YYYY-MM-DD
    reason: String,
    status: { type: String, default: 'pending' },
    completed_at: Date
}, { timestamps: true });

export const Followup = mongoose.model('Followup', FollowupSchema);
export default Followup;
