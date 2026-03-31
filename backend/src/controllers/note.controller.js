import Note from '../models/note.model.js';
import Lead from '../models/lead.model.js';

export const getNotesByLead = async (req, res, next) => {
    try {
        const notes = await Note.find({ lead_id: req.params.schoolId }).sort({ createdAt: -1 });
        res.json(notes);
    } catch (err) {
        next(err);
    }
};

export const createNote = async (req, res, next) => {
    try {
        const { content } = req.body;
        if (!content || !content.trim()) {
            res.status(400);
            throw new Error('Note content is required');
        }

        const note = await Note.create({
            lead_id: req.params.schoolId,
            content: content.trim()
        });

        // Auto update last_contacted
        await Lead.findByIdAndUpdate(
            req.params.schoolId,
            { last_contacted: new Date() }
        );

        res.json(note);
    } catch (err) {
        next(err);
    }
};
