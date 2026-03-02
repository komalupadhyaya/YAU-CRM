import mongoose from 'mongoose';

const FollowupSchema = new mongoose.Schema({
    school_id: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    follow_up_date: { type: String, required: true }, // YYYY-MM-DD
    reason: String,
    status: { type: String, default: 'pending' },
    completed_at: Date
}, { timestamps: true });

export const Followup = mongoose.model('Followup', FollowupSchema);
export default Followup;
