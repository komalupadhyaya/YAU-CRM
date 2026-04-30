import mongoose from 'mongoose';
import Lead from '../models/lead.model.js';
import Contact from '../models/contact.model.js';
import Note from '../models/note.model.js';

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
        const leads = await Lead.find({ campaign_id: req.params.campaignId }).sort({ name: 1 });
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
        const lead = await Lead.findById(req.params.id).populate('campaign_id', 'name').lean();
        if (!lead) {
            res.status(404);
            throw new Error('Lead not found');
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
            campaign_id, name, type, category_group, telephone, start_time, end_time, address_number, address, city, state, zip, website,
            // Primary Contact Person
            main_contact_name, main_contact_email, contact_title, contact_department, contact_direct_phone, contact_extension,
            contact_email, contact_best_time, contact_preferred_method,
            // Secondary Contact
            secondary_contact_name, secondary_contact_title, secondary_contact_phone, secondary_contact_extension, secondary_contact_email
        } = req.body;

        if (!name || !campaign_id || !main_contact_name || !contact_title || !contact_department || !contact_direct_phone || !contact_email || !contact_best_time || !contact_preferred_method) {
            res.status(400);
            throw new Error('All primary contact details, organization name, and campaign are required');
        }

        const lead = await Lead.create({
            campaign_id, name, type, category_group, telephone, start_time, end_time, address_number, address, city, state, zip, website
        });

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
            name, type, category_group, telephone, start_time, end_time, address_number, address, city, state, zip, website, campaign_id, status,
            // Primary Contact Person
            main_contact_name, main_contact_email, contact_title, contact_department, contact_direct_phone, contact_extension,
            contact_email, contact_best_time, contact_preferred_method,
            // Secondary Contact
            secondary_contact_name, secondary_contact_title, secondary_contact_phone, secondary_contact_extension, secondary_contact_email
        } = req.body;

        if (name !== undefined && !name.trim()) {
            res.status(400);
            throw new Error('Lead name cannot be empty');
        }

        const updatePayload = {
            name, type, category_group, telephone, start_time, end_time, address_number, address, city, state, zip, website, campaign_id, status
        };
        Object.keys(updatePayload).forEach(k => updatePayload[k] === undefined && delete updatePayload[k]);

        const lead = await Lead.findByIdAndUpdate(req.params.id, updatePayload, { new: true }).populate('campaign_id', 'name');

        if (!lead) {
            res.status(404);
            throw new Error('Lead not found');
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

        res.json(lead);
    } catch (err) {
        next(err);
    }
};
