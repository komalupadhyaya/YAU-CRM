import mongoose from 'mongoose';

const EALeadSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, index: true },
    phone: { type: String, required: true, index: true },
    source: { type: String, default: 'YAU Website' },
    dateSubmitted: { type: Date, default: Date.now },
    submissionCount: { type: Number, default: 1 },
    isConsent: { type: Boolean, default: true },
    isEmailConsent: { type: Boolean, default: true },
    assigned_to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    unreadCount: { type: Number, default: 0 },
    smsHistory: [
        {
            direction: { type: String, enum: ['inbound', 'outbound'] },
            message: String,
            timestamp: { type: Date, default: Date.now },
            isBulk: { type: Boolean, default: false },
            status: { type: String, enum: ['pending', 'sent', 'failed', 'received'], default: 'pending' },
            twilioSid: { type: String, default: null },
            isRead: { type: Boolean, default: false },
            isAiReply: { type: Boolean, default: false }
        }
    ],
    calls: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Call', index: true }],
    callHistory: [
        {
            callSid: { type: String, required: true },
            parentCallSid: { type: String },
            direction: { type: String, enum: ['inbound', 'outbound'], required: true },
            duration: { type: Number, default: 0 },
            recordingUrl: { type: String },
            status: { type: String },
            timestamp: { type: Date, default: Date.now },
            source: { type: String, enum: ['twilio', 'retell'], default: 'twilio' },
            retellCallId: { type: String, default: null },
            aiSummary: { type: String, default: null },
            callerSentiment: { type: String, default: null },
            transcript: { type: String, default: null }
        }
    ]
}, { timestamps: true });


export const EALead = mongoose.model('EALead', EALeadSchema);
export default EALead;
