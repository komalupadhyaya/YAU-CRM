import mongoose from 'mongoose';

const EmailQueueSchema = new mongoose.Schema({
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailCampaign', required: true, index: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, default: null },
    leadModel: { type: String, enum: ['Lead', 'EALead', 'ManualContact'], default: 'Lead' },
    recipientName: { type: String, default: '' },
    email: { type: String, required: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    status: { type: String, enum: ['pending', 'processing', 'sent', 'failed'], default: 'pending', index: true },
    error: { type: String, default: null },
    attempts: { type: Number, default: 0 },
    lastAttempt: { type: Date, default: null }
}, { timestamps: true });

export const EmailQueue = mongoose.model('EmailQueue', EmailQueueSchema, 'email_queues');
export default EmailQueue;
