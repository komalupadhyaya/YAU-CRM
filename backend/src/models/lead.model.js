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
    unreadCount: { type: Number, default: 0 },
    isConsent: { type: Boolean, default: true },
    isEmailConsent: { type: Boolean, default: true },
    smsHistory: [{
        direction: { type: String, enum: ['inbound', 'outbound'] },
        message: String,
        timestamp: { type: Date, default: Date.now },
        isBulk: { type: Boolean, default: false },
        status: { type: String, enum: ['pending', 'sent', 'failed', 'received'], default: 'pending' },
        twilioSid: { type: String, default: null },
        isRead: { type: Boolean, default: false }
    }],
    calls: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Call', index: true }],
    callHistory: [{
        callSid: { type: String, required: true },
        parentCallSid: { type: String },
        direction: { type: String, enum: ['inbound', 'outbound'], required: true },
        duration: { type: Number },
        recordingUrl: { type: String },
        status: { type: String },
        timestamp: { type: Date, default: Date.now },
        source: { type: String, enum: ['twilio', 'retell'], default: 'twilio' },
        retellCallId: { type: String, default: null },
        aiSummary: { type: String, default: null },
        callerSentiment: { type: String, default: null },
        transcript: { type: String, default: null }
    }],
    aiScore: {
        type: String,
        enum: ['Hot', 'Warm', 'Cold'],
        default: 'Cold',
        index: true
    },
    aiScoreReason: {
        type: String,
        default: 'New lead — uncontacted'
    },
    aiScoreOverride: {
        type: Boolean,
        default: false
    },
    aiScoreUpdatedAt: {
        type: Date,
        default: null
    },
    aiNextAction: {
        action: { type: String, default: null },
        reason: { type: String, default: null },
        priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
        recommendedDueDate: { type: Date, default: null },
        status: { type: String, enum: ['active', 'accepted', 'dismissed', 'edited', 'converted_to_followup'], default: null },
        suggestedAt: { type: Date, default: null },
        dismissedAt: { type: Date, default: null },
        taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
        followupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Followup', default: null },
        activityTrigger: {
            activityType: { type: String, enum: ['call', 'note', 'meeting', 'status_change', 'manual_generate'], default: null },
            activityId: { type: mongoose.Schema.Types.ObjectId, default: null },
            summary: { type: String, default: null }
        }
    },
    // ── Stalled Lead Detection (Section 2) ───────────────────────────
    isStalled: { type: Boolean, default: false, index: true },
    stalledAt: { type: Date, default: null },
    daysInactive: { type: Number, default: 0 },
    lastActivityAt: { type: Date, default: Date.now },
    stalledReason: { type: String, default: null },
    stalledEmailSentAt: { type: Date, default: null },
    stalledReengagementDraft: {
        text: { type: String, default: null },
        suggestedAt: { type: Date, default: null }
    }
}, { timestamps: true });

export const Lead = mongoose.model('Lead', LeadSchema);
export default Lead;
