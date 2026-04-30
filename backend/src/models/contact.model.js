import mongoose from 'mongoose';

const ContactSchema = new mongoose.Schema({
    lead_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    name: { type: String, required: true },
    title: { type: String },
    department: { type: String },
    direct_phone: { type: String },
    extension: { type: String },
    email: { type: String },
    best_time: { type: String },
    preferred_method: { type: String }, // e.g. Call, Email, Text
    is_primary: { type: Boolean, default: false }
}, { timestamps: true });

export const Contact = mongoose.model('Contact', ContactSchema);
export default Contact;
