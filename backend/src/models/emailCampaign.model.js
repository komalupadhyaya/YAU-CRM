import mongoose from 'mongoose';

const EmailCampaignSchema = new mongoose.Schema({
    title: { type: String, required: true },
    subject: { type: String, required: true },
    content: { type: String, required: true }, // HTML rich body content
    segmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailSegment', required: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailTemplate', default: null },
    isAiPersonalized: { type: Boolean, default: false },
    aiGoalPrompt: { type: String, default: '' },
    status: { 
        type: String, 
        enum: ['draft', 'scheduled', 'sending', 'sent', 'failed'], 
        default: 'draft' 
    },
    sendAt: { type: Date, default: null }, // scheduled send timestamp
    sentAt: { type: Date, default: null },
    stats: {
        sent: { type: Number, default: 0 },
        delivered: { type: Number, default: 0 },
        opens: { type: Number, default: 0 },
        clicks: { type: Number, default: 0 },
        unsubscribes: { type: Number, default: 0 },
        bounces: { type: Number, default: 0 }
    },
    recipientLogs: [{
        leadId: { type: mongoose.Schema.Types.ObjectId, default: null },
        leadModel: { type: String, enum: ['Lead', 'EALead', 'ManualContact', 'Contact'], default: 'Lead' },
        name: { type: String, default: '' },
        email: { type: String, required: true },
        personalizedSubject: { type: String, default: '' },
        personalizedContent: { type: String, default: '' },
        contextReasoning: { type: String, default: '' },
        status: { 
            type: String, 
            enum: ['pending', 'processed', 'sent', 'delivered', 'open', 'click', 'unsubscribe', 'bounce', 'failed'], 
            default: 'pending' 
        },
        error: { type: String, default: null },
        messageId: { type: String, default: null }
    }]
}, { timestamps: true });

export default mongoose.model('EmailCampaign', EmailCampaignSchema, 'campaigns');
