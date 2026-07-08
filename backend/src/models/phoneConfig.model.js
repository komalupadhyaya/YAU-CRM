import mongoose from 'mongoose';

const PhoneConfigSchema = new mongoose.Schema({
    greeting: {
        type: { type: String, enum: ['text-to-speech', 'audio-file'], default: 'text-to-speech' },
        message: { type: String, default: 'Thank you for calling Youth Athlete University. Please listen carefully to the following options.' },
        audioFileUrl: { type: String }
    },
    holdMusic: {
        audioFileUrl: { type: String }
    },
    extensions: [{
        digit: { type: Number, required: true, min: 1, max: 9 },
        label: { type: String, required: true },
        forwardTo: { type: String, required: true } // Phone number or user email identity
    }],
    // When true, the IVR system reads each extension label aloud after the greeting
    // (e.g. "Press 1 for Priyanshu, Press 2 for Chirag").
    // When false (default), only the Greeting Message is heard.
    announceExtensions: { type: Boolean, default: false },
    voicemail: {
        enabled: { type: Boolean, default: true },
        useAudioFile: { type: Boolean, default: false }, // Toggle for MP3 vs TTS
        ttsMessage: { type: String, default: 'The department is busy. If you would like to leave a voicemail, please press 1.' }, // Custom TTS message
        audioFileUrl: { type: String }, // Custom voicemail greeting
        emailNotification: { type: String } // Email to send voicemail recordings to
    },
    callRouting: {
        defaultForwardTo: { type: String } // Fallback number if no extension pressed
    }
}, { timestamps: true });

export const PhoneConfig = mongoose.model('PhoneConfig', PhoneConfigSchema);
export default PhoneConfig;
