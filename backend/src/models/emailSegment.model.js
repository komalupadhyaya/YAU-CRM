import mongoose from 'mongoose';

const EmailSegmentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    type: { type: String, enum: ['dynamic', 'static', 'campaign', 'csv'], required: true },
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
        status: { type: String, enum: ['active', 'opted_out', 'bounced', 'failed'], default: 'active' }
    }]
}, { timestamps: true });

export default mongoose.model('EmailSegment', EmailSegmentSchema, 'segments');
