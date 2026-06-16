import mongoose from 'mongoose';

const FollowupSchema = new mongoose.Schema({
    lead_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    title: { type: String, trim: true },
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
        enum: ['Low', 'Medium', 'High', 'None', '', null],
        default: null
    },
    status: { type: String, default: 'pending' },
    google_event_id: { type: String },
    cc_emails: [{ type: String }],
    completed_at: Date,
    reminderSent: { type: Boolean, default: false },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

export const Followup = mongoose.model('Followup', FollowupSchema);
export default Followup;
