import mongoose from 'mongoose';

const LeadSchema = new mongoose.Schema({
    campaign_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    // ── Organization / Lead Details ─────────────────────────────────────────
    name: { type: String, required: true }, // Organization / School Name
    type: String,                    // e.g. Public, Private, Parent
    category_group: String,          // e.g. PK-5, Partner
    department: String,              // Organization department
    telephone: String,               // Main organization phone
    telephone_extension: String,     // Ext.
    website: String,
    start_time: String,
    end_time: String,

    // ── Address Details ─────────────────────────────────────────────────────
    address_number: String,
    address: String,
    city: String,
    state: String,
    zip: String,

    // ── Status & Tracking ───────────────────────────────────────────────────
    status: {
        type: String,
        enum: [
            "Not Contacted",
            "Attempted Contact",
            "Spoke to Front Office",
            "Spoke to Decision Maker",
            "Waiting on Reply",
            "Follow-Up Needed",
            "Meeting Scheduled",
            "Proposal Sent",
            "Interested",
            "Not Interested",
            "Program Confirmed",
            "On Hold"
        ],
        default: "Not Contacted"
    },
    last_contacted: {
        type: Date,
        default: null
    },
    assigned_to: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        index: true
    },
    callHistory: [{
        callSid: { type: String, required: true },
        parentCallSid: { type: String },
        direction: { type: String, enum: ['inbound', 'outbound'], required: true },
        duration: { type: Number },
        recordingUrl: { type: String },
        status: { type: String },
        timestamp: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

export const Lead = mongoose.model('Lead', LeadSchema);
export default Lead;
