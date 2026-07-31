import mongoose from 'mongoose';
import XLSX from 'xlsx';
import Lead from '../models/lead.model.js';
import Contact from '../models/contact.model.js';
import Note from '../models/note.model.js';
import LeadAssignmentHistory from '../models/leadAssignmentHistory.model.js';
import Call from '../models/call.model.js';
import Followup from '../models/followup.model.js';
import Meeting from '../models/meeting.model.js';
import Task from '../models/tasks.model.js';
import User from '../models/user.model.js';

/**
 * Propagates lead assignment to pending follow-ups, tasks, and scheduled meetings.
 * Does not trigger any calendar invitations or email updates.
 * @param {string} leadId - The ID of the lead being reassigned.
 * @param {string|null} newAssignedTo - The ID of the user the lead is being assigned to.
 * @param {string|null} oldAssignedTo - The ID of the user the lead was previously assigned to.
 */
async function propagateLeadAssignment(leadId, newAssignedTo, oldAssignedTo) {
    try {
        let newUsername = null;
        if (newAssignedTo) {
            const user = await User.findById(newAssignedTo);
            if (user) {
                newUsername = user.username;
            }
        }

        // 1. Update pending follow-ups
        await Followup.updateMany(
            { lead_id: leadId, status: 'pending' },
            { $set: { assigned_user: newUsername } }
        );

        // 2. Update pending tasks
        await Task.updateMany(
            { lead_id: leadId, status: 'pending', isDeleted: { $ne: true } },
            { $set: { assignedTo: newAssignedTo } }
        );

        // 3. Update scheduled meetings
        const meetingQuery = {
            $or: [
                { lead_id: leadId },
                { lead_ids: leadId }
            ],
            status: { $in: ['scheduled', 'rescheduled'] }
        };

        if (oldAssignedTo) {
            await Meeting.updateMany(
                meetingQuery,
                { $pull: { internal_attendees: oldAssignedTo } }
            );
        }

        if (newAssignedTo) {
            await Meeting.updateMany(
                meetingQuery,
                { $addToSet: { internal_attendees: newAssignedTo } }
            );
        }
    } catch (err) {
        console.error('Error propagating lead assignment:', err);
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/leads  –  Paginated master list with search / filter / enrichment
// ─────────────────────────────────────────────────────────────────────────────
export const getLeads = async (req, res, next) => {
    try {
        // ── Query params ──────────────────────────────────────────────────────
        const search = (req.query.search || req.query.q || '').trim(); // ?search= or ?q= (alias)
        const status = (req.query.status || '').trim();
        const campaignId = (req.query.campaignId || '').trim();
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        // ── $match stage ──────────────────────────────────────────────────────
        const matchStage = {};

        // Sales reps only see their own assigned leads
        if (req.currentUserRole === 'sales_rep') {
            matchStage.assigned_to = new mongoose.Types.ObjectId(req.user.id);
        }

        if (status) {
            matchStage.status = status;
        }

        if (campaignId && campaignId.match(/^[0-9a-fA-F]{24}$/)) {
            matchStage.campaign_id = new mongoose.Types.ObjectId(campaignId);
        }

        if (search) {
            const regex = { $regex: search, $options: 'i' };
            matchStage.$or = [
                { name: regex },
                { main_contact_name: regex },
                { main_contact_email: regex },
                { telephone: regex }
            ];
        }

        // ── Aggregation pipeline ──────────────────────────────────────────────
        const pipeline = [
            { $match: matchStage },

            // 1. Enrich with campaign name
            {
                $lookup: {
                    from: 'campaigns',
                    localField: 'campaign_id',
                    foreignField: '_id',
                    as: 'campaign'
                }
            },
            {
                $unwind: {
                    path: '$campaign',
                    preserveNullAndEmptyArrays: true
                }
            },

            // 2. Enrich with latest follow-up date
            {
                $lookup: {
                    from: 'followups',
                    let: { leadId: '$_id' },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$lead_id', '$$leadId'] } } },
                        { $sort: { follow_up_date: -1 } },
                        { $limit: 1 },
                        { $project: { follow_up_date: 1, _id: 0 } }
                    ],
                    as: '_latestFollowup'
                }
            },
            {
                $addFields: {
                    lastContactedDate: {
                        $ifNull: [
                            { $arrayElemAt: ['$_latestFollowup.follow_up_date', 0] },
                            null,
                        ]
                    }
                }
            },

            // 3. Clean up the temp field
            { $project: { _latestFollowup: 0 } },

            // 4. Paginate + count in one round-trip via $facet
            {
                $facet: {
                    data: [
                        { $sort: { createdAt: -1 } },
                        { $skip: skip },
                        { $limit: limit }
                    ],
                    totalCount: [
                        { $count: 'count' }
                    ]
                }
            }
        ];

        const [result] = await Lead.aggregate(pipeline);

        const total = result.totalCount[0]?.count ?? 0;
        const totalPages = Math.ceil(total / limit);

        res.json({
            data: result.data,
            pagination: { total, page, limit, totalPages }
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/leads/campaign/:campaignId  –  All leads for a campaign
// ─────────────────────────────────────────────────────────────────────────────
export const getLeadsByCampaign = async (req, res, next) => {
    try {
        const filter = { campaign_id: req.params.campaignId };
        if (req.currentUserRole === 'sales_rep') {
            filter.assigned_to = req.user.id;
        }
        const leads = await Lead.find(filter).sort({ name: 1 });
        res.json(leads);
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/leads/:id  –  Single lead
// ─────────────────────────────────────────────────────────────────────────────
export const getLeadById = async (req, res, next) => {
    try {
        if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
            res.status(400);
            throw new Error('Invalid ID format');
        }
        const lead = await Lead.findById(req.params.id)
            .populate('campaign_id', 'name')
            .populate('assigned_to', 'name email role')
            .lean();
        if (!lead) {
            res.status(404);
            throw new Error('Lead not found');
        }
        
        // Sales reps can only view their own leads
        const assignedId = lead.assigned_to?._id || lead.assigned_to;
        if (req.currentUserRole === 'sales_rep' && (!assignedId || assignedId.toString() !== req.user.id)) {
            res.status(403);
            throw new Error('Access denied. This lead is not assigned to you.');
        }
        
        // Fetch contacts for this lead
        const contacts = await Contact.find({ lead_id: lead._id }).sort({ is_primary: -1, createdAt: 1 }).lean();
        
        res.json({ ...lead, contacts });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/leads  –  Create lead
// ─────────────────────────────────────────────────────────────────────────────
export const createLead = async (req, res, next) => {
    try {
        const {
            campaign_id, name, type, category_group, department, telephone, telephone_extension, start_time, end_time, address_number, address, city, state, zip, website,
            // Primary Contact Person
            main_contact_name, main_contact_email, contact_title, contact_department, contact_direct_phone, contact_extension,
            contact_email, contact_best_time, contact_preferred_method,
            // Secondary Contact
            secondary_contact_name, secondary_contact_title, secondary_contact_department, secondary_contact_phone, secondary_contact_extension, secondary_contact_email,
            // Assignment (admin/manager can assign to anyone; sales_rep is always auto-assigned to themselves)
            assigned_to
        } = req.body;

        if (!name || !campaign_id || !main_contact_name || !contact_title || !contact_department || !contact_direct_phone || !contact_email || !contact_best_time || !contact_preferred_method) {
            res.status(400);
            throw new Error('All primary contact details, organization name, and campaign are required');
        }

        // Sales Reps are always assigned to their own leads
        const resolvedAssignedTo = req.currentUserRole === 'sales_rep'
            ? req.user.id
            : (assigned_to || null);

        const lead = await Lead.create({
            campaign_id, name, type, category_group, department, telephone, telephone_extension, start_time, end_time, address_number, address, city, state, zip, website,
            assigned_to: resolvedAssignedTo
        });

        if (resolvedAssignedTo) {
            await LeadAssignmentHistory.create({
                lead_id: lead._id,
                assigned_by: req.user.id,
                assigned_from: null,
                assigned_to: resolvedAssignedTo
            });
        }

        // Create primary contact if name is provided
        if (main_contact_name) {
            await Contact.create({
                lead_id: lead._id,
                name: main_contact_name,
                email: contact_email || main_contact_email,
                title: contact_title,
                department: contact_department,
                direct_phone: contact_direct_phone,
                extension: contact_extension,
                best_time: contact_best_time,
                preferred_method: contact_preferred_method,
                is_primary: true
            });
        }

        // Create secondary contact if name is provided
        if (secondary_contact_name) {
            await Contact.create({
                lead_id: lead._id,
                name: secondary_contact_name,
                title: secondary_contact_title,
                department: secondary_contact_department,
                direct_phone: secondary_contact_phone,
                extension: secondary_contact_extension,
                email: secondary_contact_email,
                is_primary: false
            });
        }

        res.status(201).json(lead);
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/leads/:id  –  Full edit of lead details
// ─────────────────────────────────────────────────────────────────────────────
export const updateLead = async (req, res, next) => {
    try {
        const {
            name, type, category_group, department, telephone, telephone_extension, start_time, end_time, address_number, address, city, state, zip, website, campaign_id, status,
            // Primary Contact Person
            main_contact_name, main_contact_email, contact_title, contact_department, contact_direct_phone, contact_extension,
            contact_email, contact_best_time, contact_preferred_method,
            // Secondary Contact
            secondary_contact_name, secondary_contact_title, secondary_contact_department, secondary_contact_phone, secondary_contact_extension, secondary_contact_email,
            // Assignment — only admin/manager can change this
            assigned_to
        } = req.body;

        const existingLead = await Lead.findById(req.params.id).select('assigned_to');
        if (!existingLead) {
            res.status(404);
            throw new Error('Lead not found');
        }

        // Sales Rep ownership check: they can only edit leads assigned to themselves
        if (req.currentUserRole === 'sales_rep') {
            if (!existingLead.assigned_to || existingLead.assigned_to.toString() !== req.user.id) {
                res.status(403);
                throw new Error('You can only edit leads that are assigned to you.');
            }
        }

        const oldAssignedTo = existingLead.assigned_to;

        if (name !== undefined && !name.trim()) {
            res.status(400);
            throw new Error('Lead name cannot be empty');
        }

        const updatePayload = {
            name, type, category_group, department, telephone, telephone_extension, start_time, end_time, address_number, address, city, state, zip, website, campaign_id, status
        };

        // Only admin/manager can reassign a lead
        if (assigned_to !== undefined && req.currentUserRole !== 'sales_rep') {
            updatePayload.assigned_to = assigned_to || null;
        }

        Object.keys(updatePayload).forEach(k => updatePayload[k] === undefined && delete updatePayload[k]);

        const lead = await Lead.findByIdAndUpdate(req.params.id, updatePayload, { new: true }).populate('campaign_id', 'name');

        if (!lead) {
            res.status(404);
            throw new Error('Lead not found');
        }

        // Log history if assignment changed
        if (assigned_to !== undefined && req.currentUserRole !== 'sales_rep') {
            const newAssignedTo = assigned_to || null;
            if (String(oldAssignedTo || '') !== String(newAssignedTo || '')) {
                await LeadAssignmentHistory.create({
                    lead_id: lead._id,
                    assigned_by: req.user.id,
                    assigned_from: oldAssignedTo || null,
                    assigned_to: newAssignedTo || null
                });
                await propagateLeadAssignment(lead._id, newAssignedTo, oldAssignedTo);
            }
        }

        // Handle Primary Contact Update
        if (main_contact_name) {
            await Contact.findOneAndUpdate(
                { lead_id: lead._id, is_primary: true },
                {
                    name: main_contact_name,
                    email: contact_email || main_contact_email,
                    title: contact_title,
                    department: contact_department,
                    direct_phone: contact_direct_phone,
                    extension: contact_extension,
                    best_time: contact_best_time,
                    preferred_method: contact_preferred_method,
                    is_primary: true
                },
                { upsert: true, new: true }
            );
        }

        // Handle Secondary Contact Update
        if (secondary_contact_name) {
            await Contact.findOneAndUpdate(
                { lead_id: lead._id, is_primary: false },
                {
                    name: secondary_contact_name,
                    title: secondary_contact_title,
                    department: secondary_contact_department,
                    direct_phone: secondary_contact_phone,
                    extension: secondary_contact_extension,
                    email: secondary_contact_email,
                    is_primary: false
                },
                { upsert: true, new: true }
            );
        }

        const contacts = await Contact.find({ lead_id: lead._id }).sort({ is_primary: -1, createdAt: 1 }).lean();
        res.json({ ...lead.toObject(), contacts });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/leads/:id  –  Status-only update
// ─────────────────────────────────────────────────────────────────────────────
export const updateLeadStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        if (!status) {
            res.status(400);
            throw new Error('status is required');
        }

        // Sales Rep ownership check for status updates too
        if (req.currentUserRole === 'sales_rep') {
            const existingLead = await Lead.findById(req.params.id).select('assigned_to');
            if (!existingLead) {
                res.status(404);
                throw new Error('Lead not found');
            }
            if (!existingLead.assigned_to || existingLead.assigned_to.toString() !== req.user.id) {
                res.status(403);
                throw new Error('You can only update status of leads that are assigned to you.');
            }
        }

        const lead = await Lead.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );

        if (!lead) {
            res.status(404);
            throw new Error('Lead not found');
        }

        // Log status change
        await Note.create({
            lead_id: req.params.id,
            type: 'status_change',
            content: `Status updated to: ${status}`
        });

        const contacts = await Contact.find({ lead_id: lead._id }).sort({ is_primary: -1, createdAt: 1 }).lean();
        res.json({ ...lead.toObject(), contacts });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/leads/campaign/:campaignId/export  –  Export leads to Excel
// ─────────────────────────────────────────────────────────────────────────────
export const exportLeadsToExcel = async (req, res, next) => {
    try {
        const { campaignId } = req.params;
        if (!campaignId.match(/^[0-9a-fA-F]{24}$/)) {
            res.status(400);
            throw new Error('Invalid campaign ID format');
        }

        const leads = await Lead.find({ campaign_id: campaignId }).sort({ name: 1 }).lean();
        
        // Fetch all contacts for these leads
        const leadIds = leads.map(l => l._id);
        const contacts = await Contact.find({ lead_id: { $in: leadIds } }).sort({ is_primary: -1 }).lean();
        
        // Map contacts to leads (Primary and Secondary)
        const primaryMap = {};
        const secondaryMap = {};
        
        contacts.forEach(c => {
            const lid = c.lead_id.toString();
            if (c.is_primary) {
                if (!primaryMap[lid]) primaryMap[lid] = c;
            } else {
                if (!secondaryMap[lid]) secondaryMap[lid] = c;
            }
        });

        // Prepare data for Excel
        const data = leads.map(l => {
            const primary = primaryMap[l._id.toString()] || {};
            const secondary = secondaryMap[l._id.toString()] || {};
            
            return {
                'Name/Organization': l.name || '',
                'Lead Type': l.type || '',
                'Category/Group': l.category_group || '',
                'Department': l.department || '',
                'Telephone': l.telephone || '',
                'Telephone Ext': l.telephone_extension || '',
                'Website': l.website || '',
                'Start Time': l.start_time || '',
                'End Time': l.end_time || '',
                
                // Primary Contact
                'Primary Contact Name': primary.name || '',
                'Primary Contact Title': primary.title || '',
                'Primary Contact Department': primary.department || '',
                'Primary Contact Email': primary.email || '',
                'Primary Contact Phone': primary.direct_phone || '',
                'Primary Contact Ext': primary.extension || '',
                'Primary Best Time': primary.best_time || '',
                'Primary Preferred Method': primary.preferred_method || '',
                
                // Secondary Contact
                'Secondary Contact Name': secondary.name || '',
                'Secondary Contact Title': secondary.title || '',
                'Secondary Contact Department': secondary.department || '',
                'Secondary Contact Email': secondary.email || '',
                'Secondary Contact Phone': secondary.direct_phone || '',
                'Secondary Contact Ext': secondary.extension || '',
                'Secondary Best Time': secondary.best_time || '',
                'Secondary Preferred Method': secondary.preferred_method || '',
                
                'Address Number': l.address_number || '',
                'Address': l.address || '',
                'City': l.city || '',
                'State': l.state || '',
                'Zip Code': l.zip || ''
            };
        });

        // Create workbook
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Leads');

        // Write to buffer
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="leads_export_${new Date().toISOString().slice(0, 10)}.xlsx"`);
        res.send(buffer);
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/leads/:id/assign  –  Reassign lead to team member
// ─────────────────────────────────────────────────────────────────────────────
export const assignLead = async (req, res, next) => {
    try {
        const { assigned_to } = req.body;

        const existingLead = await Lead.findById(req.params.id).select('assigned_to');
        if (!existingLead) {
            res.status(404);
            throw new Error('Lead not found');
        }

        const oldAssignedTo = existingLead.assigned_to;
        const newAssignedTo = assigned_to || null;

        const lead = await Lead.findByIdAndUpdate(
            req.params.id,
            { assigned_to: newAssignedTo },
            { new: true }
        )
        .populate('campaign_id', 'name')
        .populate('assigned_to', 'name email role');

        if (String(oldAssignedTo || '') !== String(newAssignedTo || '')) {
            await LeadAssignmentHistory.create({
                lead_id: lead._id,
                assigned_by: req.user.id,
                assigned_from: oldAssignedTo || null,
                assigned_to: newAssignedTo || null
            });
            await propagateLeadAssignment(lead._id, newAssignedTo, oldAssignedTo);
        }

        res.json(lead);
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/leads/assign-bulk  –  Bulk reassign leads to team member
// ─────────────────────────────────────────────────────────────────────────────
export const assignLeadsBulk = async (req, res, next) => {
    try {
        const { leadIds, assigned_to } = req.body;

        if (!Array.isArray(leadIds) || leadIds.length === 0) {
            res.status(400);
            throw new Error('leadIds must be a non-empty array');
        }

        const existingLeads = await Lead.find({ _id: { $in: leadIds } }).select('assigned_to');
        const newAssignedTo = assigned_to || null;

        const result = await Lead.updateMany(
            { _id: { $in: leadIds } },
            { $set: { assigned_to: newAssignedTo } }
        );

        const historyDocs = [];
        for (const existingLead of existingLeads) {
            const oldAssignedTo = existingLead.assigned_to;
            if (String(oldAssignedTo || '') !== String(newAssignedTo || '')) {
                historyDocs.push({
                    lead_id: existingLead._id,
                    assigned_by: req.user.id,
                    assigned_from: oldAssignedTo || null,
                    assigned_to: newAssignedTo || null
                });
                await propagateLeadAssignment(existingLead._id, newAssignedTo, oldAssignedTo);
            }
        }
        if (historyDocs.length > 0) {
            await LeadAssignmentHistory.insertMany(historyDocs);
        }

        res.json({
            message: `Successfully reassigned ${result.modifiedCount} leads`,
            modifiedCount: result.modifiedCount
        });
    } catch (err) {
        next(err);
    }
};

export const getAssignmentHistory = async (req, res, next) => {
    try {
        const history = await LeadAssignmentHistory.find()
            .populate('lead_id', 'name')
            .populate('assigned_by', 'name username')
            .populate('assigned_from', 'name username')
            .populate('assigned_to', 'name username')
            .sort({ createdAt: -1 });
        res.json(history);
    } catch (err) {
        next(err);
    }
};

export const deleteAllLeadCallHistory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const lead = await Lead.findById(id);
        if (!lead) {
            return res.status(404).json({ message: 'Lead not found' });
        }
        lead.callHistory = [];

        // Save updated lead and delete associated Call and Note records concurrently
        await Promise.all([
            lead.save(),
            Call.deleteMany({ lead_id: id }),
            Note.deleteMany({ lead_id: id, type: 'call' })
        ]);

        res.json({ message: 'All call history for this lead deleted successfully' });
    } catch (err) {
        next(err);
    }
};

export const deleteSingleLeadCallHistory = async (req, res, next) => {
    try {
        const { id, callSid } = req.params;
        const lead = await Lead.findById(id);
        if (!lead) {
            return res.status(404).json({ message: 'Lead not found' });
        }
        
        // Remove from lead.callHistory array
        lead.callHistory = lead.callHistory.filter(call => call.callSid !== callSid && call.parentCallSid !== callSid);

        // Save updated lead and delete Call and Note records concurrently
        await Promise.all([
            lead.save(),
            Call.deleteMany({ 
                $or: [
                    { callSid: callSid },
                    { parentCallSid: callSid }
                ],
                lead_id: id
            }),
            Note.deleteMany({ 
                lead_id: id, 
                type: 'call',
                $or: [
                    { 'metadata.callSid': callSid },
                    { 'metadata.parentCallSid': callSid }
                ]
            })
        ]);

        res.json({ message: 'Call record deleted successfully' });
    } catch (err) {
        next(err);
    }
};

export const deleteLead = async (req, res, next) => {
    try {
        const { id } = req.params;
        const lead = await Lead.findByIdAndDelete(id);
        if (!lead) {
            return res.status(404).json({ message: 'Lead not found' });
        }

        // Concurrently delete all associated documents across other collections
        await Promise.all([
            Contact.deleteMany({ lead_id: id }),
            Followup.deleteMany({ lead_id: id }),
            LeadAssignmentHistory.deleteMany({ lead_id: id }),
            Note.deleteMany({ lead_id: id }),
            Call.deleteMany({ lead_id: id }),
            Meeting.deleteMany({ 
                $or: [
                    { lead_id: id },
                    { lead_ids: id }
                ]
            }),
            Task.deleteMany({ lead_id: id })
        ]);

        res.json({ message: 'Lead deleted successfully' });
    } catch (err) {
        next(err);
    }
};


