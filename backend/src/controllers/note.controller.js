import Note from '../models/note.model.js';
import Lead from '../models/lead.model.js';

export const getNotesByLead = async (req, res, next) => {
    try {
        const lead = await Lead.findById(req.params.schoolId).select('assigned_to');
        if (!lead) {
            res.status(404);
            throw new Error('Lead not found');
        }
        if (req.currentUserRole === 'sales_rep' && (!lead.assigned_to || lead.assigned_to.toString() !== req.user.id)) {
            res.status(403);
            throw new Error('Access denied. This lead is not assigned to you.');
        }

        const notes = await Note.find({ lead_id: req.params.schoolId }).sort({ createdAt: -1 });
        res.json(notes);
    } catch (err) {
        next(err);
    }
};

export const createNote = async (req, res, next) => {
    try {
        const { content, type, metadata } = req.body;
        if (!content || !content.trim()) {
            res.status(400);
            throw new Error('Note content is required');
        }

        const lead = await Lead.findById(req.params.schoolId);
        if (!lead) {
            res.status(404);
            throw new Error('Lead not found');
        }
        if (req.currentUserRole === 'sales_rep' && (!lead.assigned_to || lead.assigned_to.toString() !== req.user.id)) {
            res.status(403);
            throw new Error('Access denied. You can only add notes to leads assigned to you.');
        }

        const note = await Note.create({
            lead_id: req.params.schoolId,
            content: content.trim(),
            type: type || 'note',
            metadata: metadata || {}
        });

        // Auto update last_contacted
        lead.last_contacted = new Date();
        await lead.save();

        res.json(note);
    } catch (err) {
        next(err);
    }
};

export const deleteNote = async (req, res, next) => {
    try {
        const note = await Note.findById(req.params.id);
        if (!note) {
            res.status(404);
            throw new Error('Note not found');
        }

        const lead = await Lead.findById(note.lead_id).select('assigned_to');
        if (req.currentUserRole === 'sales_rep') {
            if (!lead || !lead.assigned_to || lead.assigned_to.toString() !== req.user.id) {
                res.status(403);
                throw new Error('Access denied. You can only delete notes for leads assigned to you.');
            }
        }

        await Note.findByIdAndDelete(req.params.id);
        res.json({ message: 'Note deleted' });
    } catch (err) {
        next(err);
    }
};

export const deleteAllNotes = async (req, res, next) => {
    try {
        if (!['admin', 'manager'].includes(req.currentUserRole)) {
            res.status(403);
            throw new Error('Access denied. Only Admins and Managers can delete all notes.');
        }
        await Note.deleteMany({ lead_id: req.params.schoolId });
        res.json({ message: 'All notes deleted' });
    } catch (err) {
        next(err);
    }
};
