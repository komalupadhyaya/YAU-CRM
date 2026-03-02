import mongoose from 'mongoose';

const NoteSchema = new mongoose.Schema({
    school_id: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    content: { type: String, required: true }
}, { timestamps: true });

export const Note = mongoose.model('Note', NoteSchema);
export default Note;
