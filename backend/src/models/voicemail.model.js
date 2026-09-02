import mongoose from 'mongoose';

const VoicemailSchema = new mongoose.Schema({
    fromNumber:       { type: String, default: 'Unknown Caller' },
    callerName:       { type: String, default: null },
    recordingUrl:     { type: String, default: '' },
    duration:         { type: Number, default: 0 }, // seconds
    callSid:          { type: String, index: true },
    retellCallId:     { type: String, index: true },
    source:           { type: String, enum: ['retell', 'twilio'], default: 'twilio' },
    targetDepartment: { type: String, default: null },
    targetNumber:     { type: String, default: null },
    transcript:       { type: String, default: null },
    aiSummary:        { type: String, default: null },
    callerSentiment:  { type: String, default: null },
    smsAlertSent:     { type: Boolean, default: false },
    lead_id:          { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null },
    ea_lead_id:       { type: mongoose.Schema.Types.ObjectId, ref: 'EALead', default: null },
    listenedAt:       { type: Date, default: null }, // null = unread
}, { timestamps: true });

export const Voicemail = mongoose.model('Voicemail', VoicemailSchema);
export default Voicemail;
