import Contact from '../models/contact.model.js';

// Get all contacts for a specific lead
export const getContactsByLead = async (req, res, next) => {
    try {
        const contacts = await Contact.find({ lead_id: req.params.leadId }).sort({ is_primary: -1, createdAt: 1 });
        res.json(contacts);
    } catch (err) {
        next(err);
    }
};

// Create a new contact
export const createContact = async (req, res, next) => {
    try {
        const { lead_id, name } = req.body;
        if (!lead_id || !name) {
            res.status(400);
            throw new Error('lead_id and name are required');
        }

        const contact = await Contact.create(req.body);
        res.status(201).json(contact);
    } catch (err) {
        next(err);
    }
};

// Update an existing contact
export const updateContact = async (req, res, next) => {
    try {
        const contact = await Contact.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!contact) {
            res.status(404);
            throw new Error('Contact not found');
        }
        res.json(contact);
    } catch (err) {
        next(err);
    }
};

// Delete a contact
export const deleteContact = async (req, res, next) => {
    try {
        const contact = await Contact.findByIdAndDelete(req.params.id);
        if (!contact) {
            res.status(404);
            throw new Error('Contact not found');
        }
        res.json({ message: 'Contact removed' });
    } catch (err) {
        next(err);
    }
};
