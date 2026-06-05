import Contact from '../models/contact.model.js';
import Lead from '../models/lead.model.js';

// Get all contacts for a specific lead
export const getContactsByLead = async (req, res, next) => {
    try {
        const lead = await Lead.findById(req.params.leadId).select('assigned_to');
        if (!lead) {
            res.status(404);
            throw new Error('Lead not found');
        }
        if (req.currentUserRole === 'sales_rep' && (!lead.assigned_to || lead.assigned_to.toString() !== req.user.id)) {
            res.status(403);
            throw new Error('Access denied. This lead is not assigned to you.');
        }

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

        const lead = await Lead.findById(lead_id).select('assigned_to');
        if (!lead) {
            res.status(404);
            throw new Error('Lead not found');
        }
        if (req.currentUserRole === 'sales_rep' && (!lead.assigned_to || lead.assigned_to.toString() !== req.user.id)) {
            res.status(403);
            throw new Error('Access denied. This lead is not assigned to you.');
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
        const contact = await Contact.findById(req.params.id);
        if (!contact) {
            res.status(404);
            throw new Error('Contact not found');
        }

        const lead = await Lead.findById(contact.lead_id).select('assigned_to');
        if (req.currentUserRole === 'sales_rep' && (!lead || !lead.assigned_to || lead.assigned_to.toString() !== req.user.id)) {
            res.status(403);
            throw new Error('Access denied. This contact is associated with a lead not assigned to you.');
        }

        const updatedContact = await Contact.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updatedContact);
    } catch (err) {
        next(err);
    }
};

// Delete a contact
export const deleteContact = async (req, res, next) => {
    try {
        if (!['admin', 'manager'].includes(req.currentUserRole)) {
            res.status(403);
            throw new Error('Access denied. Only Admins and Managers can remove contacts.');
        }

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
