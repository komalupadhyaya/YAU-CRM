import Campaign from '../models/campaign.model.js';
import School from '../models/school.model.js';
import Followup from '../models/followup.model.js';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/campaigns  –  list all campaigns (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export const getCampaigns = async (req, res, next) => {
    try {
        const campaigns = await Campaign.find().sort({ createdAt: -1 });
        res.json(campaigns);
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/campaigns  –  create a campaign (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export const createCampaign = async (req, res, next) => {
    try {
        const { name } = req.body;
        if (!name) {
            res.status(400);
            throw new Error('Campaign name is required');
        }
        const campaign = await Campaign.create({ name });
        res.json(campaign);
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/campaigns/:id  –  campaign detail with live metrics
// ─────────────────────────────────────────────────────────────────────────────
export const getCampaignById = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Basic ObjectId guard
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
            res.status(400);
            throw new Error('Invalid campaign ID format');
        }

        const campaign = await Campaign.findById(id);
        if (!campaign) {
            res.status(404);
            throw new Error('Campaign not found');
        }

        // Run both aggregations in parallel — single round-trip pair
        const [schoolAgg, followupAgg] = await Promise.all([
            // Schools: total + status breakdown, all scoped to this campaign
            School.aggregate([
                { $match: { campaign_id: campaign._id } },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]),

            // Follow-ups scoped to schools belonging to this campaign only.
            // $lookup joins school doc; $match filters by campaign_id on the joined doc.
            Followup.aggregate([
                {
                    $lookup: {
                        from: 'schools',
                        localField: 'school_id',
                        foreignField: '_id',
                        as: 'school'
                    }
                },
                { $unwind: '$school' },
                {
                    $match: {
                        'school.campaign_id': campaign._id
                    }
                },
                {
                    $count: 'total'
                }
            ])
        ]);

        // ── Process school aggregation ────────────────────────────────────────
        let totalSchools = 0;
        const schoolStatusBreakdown = schoolAgg.map(s => {
            totalSchools += s.count;
            return { status: s._id || 'Unknown', count: s.count };
        });

        // ── Process follow-up aggregation ─────────────────────────────────────
        const totalFollowups = followupAgg[0]?.total ?? 0;

        res.json({
            campaign: campaign.toJSON(),
            metrics: {
                totalSchools,
                totalFollowups,
                schoolStatusBreakdown
            }
        });
    } catch (err) {
        next(err);
    }
};
