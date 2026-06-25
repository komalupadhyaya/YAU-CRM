import mongoose from 'mongoose';

const EALeadSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, index: true },
    phone: { type: String, required: true, index: true },
    source: { type: String, default: 'YAU Website' },
    dateSubmitted: { type: Date, default: Date.now },
    submissionCount: { type: Number, default: 1 },
    isConsent: { type: Boolean, default: true }
}, { timestamps: true });


export const EALead = mongoose.model('EALead', EALeadSchema);
export default EALead;
