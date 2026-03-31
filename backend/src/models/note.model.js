import mongoose from 'mongoose';

const NoteSchema = new mongoose.Schema({
    lead_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    content: { type: String, required: true }
}, { timestamps: true });

export const Note = mongoose.model('Note', NoteSchema);
export default Note;
