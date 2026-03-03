import mongoose from 'mongoose';

const SchoolSchema = new mongoose.Schema({
    campaign_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    name: { type: String, required: true },
    type: String,
    grades: String,
    principal_name: String,
    principal_email: String,
    telephone: String,
    start_time: String,
    end_time: String,
    address: String,
    city: String,
    state: String,
    zip: String,
    website: String,
    status: {
        type: String,
        default: "Not Contacted"
    },
    last_contacted: {
        type: Date,
        default: null
    }
}, { timestamps: true });

export const School = mongoose.model('School', SchoolSchema);
export default School;
