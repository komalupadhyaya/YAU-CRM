import mongoose from 'mongoose';

const FollowupSchema = new mongoose.Schema({
    lead_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    date_time: { type: Date, required: true },
    type: { 
        type: String, 
        enum: ['Call', 'Email', 'Meeting', 'Task'],
        required: true,
        default: 'Task'
    },
    notes: { type: String },
    assigned_user: { type: String },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High'],
        default: 'Medium'
    },
    status: { type: String, default: 'pending' },
    google_event_id: { type: String },
    cc_emails: [{ type: String }],
    completed_at: Date
}, { timestamps: true });

export const Followup = mongoose.model('Followup', FollowupSchema);
export default Followup;
