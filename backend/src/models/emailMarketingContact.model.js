import mongoose from 'mongoose';

export const EmailMarketingContactSchema = new mongoose.Schema({
    parentName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        index: true
    },
    phone: {
        type: String,
        trim: true,
        default: ''
    },
    source: {
        type: String,
        default: 'App Registration',
        trim: true,
        index: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    submissionCount: {
        type: Number,
        default: 1
    },
    lastRegisteredAt: {
        type: Date,
        default: Date.now
    },
    isEmailConsent: {
        type: Boolean,
        default: true
    },
    status: {
        type: String,
        enum: ['active', 'opted_out', 'bounced'],
        default: 'active',
        index: true
    }
}, { timestamps: true });

// Indexes for fast lookup
EmailMarketingContactSchema.index({ email: 1 });
EmailMarketingContactSchema.index({ source: 1 });

// Registered as EmailMarketingContact targeting 'email_marketing_contacts' collection
export const EmailMarketingContact = mongoose.models.EmailMarketingContact || 
    mongoose.model('EmailMarketingContact', EmailMarketingContactSchema, 'email_marketing_contacts');

// Backward compatibility exports
export const MarketingContactSchema = EmailMarketingContactSchema;
export const MarketingContact = EmailMarketingContact;
export default EmailMarketingContact;
