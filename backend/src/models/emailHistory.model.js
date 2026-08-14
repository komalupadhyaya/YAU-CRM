import mongoose from 'mongoose';

const EmailHistorySchema = new mongoose.Schema({
    leadId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    leadModel: { type: String, enum: ['Lead', 'EALead', 'ManualContact', 'Contact'], default: 'Lead' },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailCampaign', default: null, index: true },
    campaignTitle: { type: String, default: '' },
    type: { type: String, enum: ['direct', 'bulk'], required: true, index: true },
    direction: { type: String, enum: ['outbound', 'inbound'], default: 'outbound' },
    recipientName: { type: String, default: '' },
    to: { type: String, required: true, index: true },
    cc: { type: String, default: '' },
    subject: { type: String, required: true },
    body: { type: String, default: '' },
    status: { 
        type: String, 
        enum: ['pending', 'sent', 'delivered', 'open', 'click', 'unsubscribe', 'bounce', 'failed'], 
        default: 'sent',
        index: true 
    },
    error: { type: String, default: null },
    messageId: { type: String, default: null, index: true },
    sentAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

export const EmailHistory = mongoose.model('EmailHistory', EmailHistorySchema, 'email_histories');
export default EmailHistory;
