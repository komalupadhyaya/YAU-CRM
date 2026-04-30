import mongoose from 'mongoose';

const NoteSchema = new mongoose.Schema({
    lead_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    content: { type: String, required: true },
    type: { 
        type: String, 
        enum: ['note', 'status_change', 'email', 'meeting', 'call', 'sms'],
        default: 'note'
    },
    metadata: { type: Object } // To store things like subject for emails or meeting details
}, { timestamps: true });

export const Note = mongoose.model('Note', NoteSchema);
export default Note;
