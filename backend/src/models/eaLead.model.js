import mongoose from 'mongoose';

const EALeadSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, index: true },
    phone: { type: String, required: true, index: true },
    source: { type: String, default: 'YAU Website' },
    dateSubmitted: { type: Date, default: Date.now },
    submissionCount: { type: Number, default: 1 },
    isConsent: { type: Boolean, default: true },
    unreadCount: { type: Number, default: 0 },
    smsHistory: [
        {
            direction: { type: String, enum: ['inbound', 'outbound'] },
            message: String,
            timestamp: { type: Date, default: Date.now },
            isBulk: { type: Boolean, default: false },
            status: { type: String, enum: ['pending', 'sent', 'failed', 'received'], default: 'pending' },
            twilioSid: { type: String, default: null },
            isRead: { type: Boolean, default: false }
        }
    ]
}, { timestamps: true });


export const EALead = mongoose.model('EALead', EALeadSchema);
export default EALead;
