import mongoose from 'mongoose';

const VoicemailSchema = new mongoose.Schema({
    fromNumber:   { type: String, default: 'Unknown Caller' },
    recordingUrl: { type: String, required: true },
    duration:     { type: Number, default: 0 }, // seconds
    callSid:      { type: String, index: true },
    listenedAt:   { type: Date, default: null }, // null = unread
}, { timestamps: true });

export const Voicemail = mongoose.model('Voicemail', VoicemailSchema);
export default Voicemail;
