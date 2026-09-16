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
    entryPoint: {
        type: String,
        enum: ['school', 'location', 'free_app'],
        required: true,
        index: true
    },
    schoolName: {
        type: String,
        trim: true,
        default: ''
    },
    schoolId: {
        type: String,
        trim: true,
        index: true,
        default: ''
    },
    locationName: {
        type: String,
        trim: true,
        default: ''
    },
    locationId: {
        type: String,
        trim: true,
        index: true,
        default: ''
    },
    source: {
        type: String,
        default: 'App Registration',
        trim: true
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

// Compound index on email and entryPoint for fast queries
EmailMarketingContactSchema.index({ email: 1, entryPoint: 1 });

// Registered as EmailMarketingContact targeting 'email_marketing_contacts' collection
export const EmailMarketingContact = mongoose.models.EmailMarketingContact || 
    mongoose.model('EmailMarketingContact', EmailMarketingContactSchema, 'email_marketing_contacts');

// Backward compatibility exports
export const MarketingContactSchema = EmailMarketingContactSchema;
export const MarketingContact = EmailMarketingContact;
export default EmailMarketingContact;
