import mongoose from 'mongoose';

const EmailSegmentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    type: { type: String, enum: ['dynamic', 'static', 'campaign', 'csv', 'marketing'], required: true },
    category: {
        type: String,
        enum: ['school', 'location', 'app_members', 'ea_leads', 'csv', 'custom', 'campaign', 'marketing'],
        default: 'custom'
    },
    externalId: { type: String, index: true },
    isSystemList: { type: Boolean, default: false },
    filters: {
        source: { type: String },
        sport: { type: String },
        location: { type: String },
        status: { type: String },
        campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' }
    },
    contacts: [{
        name: { type: String },
        email: { type: String, required: true },
        phone: { type: String },
        school: { type: String },
        location: { type: String },
        source: { type: String },
        registrationCount: { type: Number, default: 1 },
        lastRegisteredAt: { type: Date, default: Date.now },
        status: { type: String, enum: ['active', 'opted_out', 'bounced', 'failed'], default: 'active' }
    }]
}, { timestamps: true });

export default mongoose.model('EmailSegment', EmailSegmentSchema, 'segments');
