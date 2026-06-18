import mongoose from 'mongoose';

const changeLogSchema = new mongoose.Schema({
    action: {
        type: String,
        enum: ['created', 'rescheduled', 'canceled', 'status_changed', 'attendee_changed', 'notes_updated'],
        required: true
    },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
    note: { type: String }
}, { _id: false });

const MeetingSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    category: {
        type: String,
        enum: ['school', 'hr'],
        required: true,
        index: true
    },

    // School meetings link to one or more Leads; HR meetings link to a Candidate
    lead_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null },        // kept for backward compat
    lead_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lead' }],                   // multi-lead support
    candidate_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', default: null }, // kept for backward compat
    candidate_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' }],            // multi-candidate support

    date_time: { type: Date, required: true },
    duration_minutes: { type: Number, default: 30 },

    status: {
        type: String,
        enum: ['scheduled', 'completed', 'rescheduled', 'canceled', 'no_show'],
        default: 'scheduled',
        index: true
    },

    // Internal team members who will attend
    internal_attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Internal team members CC'd on the invite only
    cc_attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // External email addresses (outside the org)
    external_emails: [{ type: String, trim: true }],

    notes: { type: String, default: '' },

    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    google_event_id: { type: String, default: null },

    // Lightweight audit log — only captures key state changes
    change_log: [changeLogSchema]

}, { timestamps: true });

// Index for fast queries by date range + category
MeetingSchema.index({ category: 1, date_time: 1, status: 1 });

const Meeting = mongoose.model('Meeting', MeetingSchema);
export default Meeting;
