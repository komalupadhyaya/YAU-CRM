import mongoose from 'mongoose';
import School from '../models/school.model.js';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/schools  –  Paginated master list with search / filter / enrichment
// ─────────────────────────────────────────────────────────────────────────────
export const getSchools = async (req, res, next) => {
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
                { principal_name: regex },
                { principal_email: regex },
                { telephone: regex }
            ];
        }

        // ── Aggregation pipeline ──────────────────────────────────────────────
        // Uses $facet to run the paginated data slice and the total count in
        // a single round-trip. The follow-up $lookup uses a sub-pipeline with
        // $sort + $limit: 1, so it loads at most ONE follow-up doc per school —
        // never the full array.
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
                    preserveNullAndEmptyArrays: true   // schools with no campaign still appear
                }
            },

            // 2. Enrich with latest follow-up date — sub-pipeline fetches ONLY the
            //    single most recent follow-up (sorted desc), never the full array.
            {
                $lookup: {
                    from: 'followups',
                    let: { schoolId: '$_id' },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$school_id', '$$schoolId'] } } },
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

        const [result] = await School.aggregate(pipeline);

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
// GET /api/schools/campaign/:campaignId  –  All schools for a campaign (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export const getSchoolsByCampaign = async (req, res, next) => {
    try {
        const schools = await School.find({ campaign_id: req.params.campaignId }).sort({ name: 1 });
        res.json(schools);
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/schools/:id  –  Single school (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export const getSchoolById = async (req, res, next) => {
    try {
        if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
            res.status(400);
            throw new Error('Invalid ID format');
        }
        const school = await School.findById(req.params.id);
        if (!school) {
            res.status(404);
            throw new Error('School not found');
        }
        res.json(school);
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/schools  –  Create school (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export const createSchool = async (req, res, next) => {
    try {
        const {
            campaign_id, name, type, grades, principal_name, principal_email,
            telephone, start_time, end_time, address, city, state, zip, website
        } = req.body;

        if (!name || !campaign_id) {
            res.status(400);
            throw new Error('name and campaign_id are required');
        }

        const school = await School.create({
            campaign_id, name, type, grades, principal_name, principal_email,
            telephone, start_time, end_time, address, city, state, zip, website
        });
        res.json(school);
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/schools/:id  –  Full edit of school details (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export const updateSchool = async (req, res, next) => {
    try {
        const {
            name, type, grades, principal_name, principal_email,
            telephone, start_time, end_time, address, city, state, zip, website
        } = req.body;

        // campaign_id is intentionally excluded from editable fields here —
        // it must only change if explicitly provided and validated elsewhere.
        if (name !== undefined && !name.trim()) {
            res.status(400);
            throw new Error('School name cannot be empty');
        }

        const updatePayload = {
            name, type, grades, principal_name, principal_email,
            telephone, start_time, end_time, address, city, state, zip, website
        };
        // Strip keys that are explicitly undefined (not sent by client)
        Object.keys(updatePayload).forEach(k => updatePayload[k] === undefined && delete updatePayload[k]);

        const school = await School.findByIdAndUpdate(req.params.id, updatePayload, { new: true });

        if (!school) {
            res.status(404);
            throw new Error('School not found');
        }
        res.json(school);
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/schools/:id  –  Status-only update (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export const updateSchoolStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        if (!status) {
            res.status(400);
            throw new Error('status is required');
        }

        const school = await School.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );

        if (!school) {
            res.status(404);
            throw new Error('School not found');
        }
        res.json(school);
    } catch (err) {
        next(err);
    }
};
