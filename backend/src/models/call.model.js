import mongoose from 'mongoose';

const CallSchema = new mongoose.Schema({
    callSid: { type: String, required: true, index: true },
    inboundCallSid: { type: String, index: true },
    parentCallSid: { type: String, index: true },
    direction: { type: String, enum: ['inbound', 'outbound'], required: true },
    fromNumber: { type: String },
    toNumber: { type: String },
    duration: { type: Number, default: 0 }, // In seconds
    recordingUrl: { type: String },
    status: { type: String },
    timestamp: { type: Date, default: Date.now },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
    forwardedToUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
    lead_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', index: true, default: null }
}, { timestamps: true });

export const Call = mongoose.model('Call', CallSchema);
export default Call;
