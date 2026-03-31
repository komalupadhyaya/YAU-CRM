import Campaign from '../models/campaign.model.js';
import Lead from '../models/lead.model.js';
import Followup from '../models/followup.model.js';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/campaigns  –  list all campaigns
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
// POST /api/campaigns  –  create a campaign
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

        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
            res.status(400);
            throw new Error('Invalid campaign ID format');
        }

        const campaign = await Campaign.findById(id);
        if (!campaign) {
            res.status(404);
            throw new Error('Campaign not found');
        }

        const [leadAgg, followupAgg] = await Promise.all([
            Lead.aggregate([
                { $match: { campaign_id: campaign._id } },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]),

            Followup.aggregate([
                {
                    $lookup: {
                        from: 'leads',
                        localField: 'lead_id',
                        foreignField: '_id',
                        as: 'lead'
                    }
                },
                { $unwind: '$lead' },
                {
                    $match: {
                        'lead.campaign_id': campaign._id
                    }
                },
                {
                    $count: 'total'
                }
            ])
        ]);

        let totalLeads = 0;
        const leadStatusBreakdown = leadAgg.map(s => {
            totalLeads += s.count;
            return { status: s._id || 'Unknown', count: s.count };
        });

        const totalFollowups = followupAgg[0]?.total ?? 0;

        res.json({
            campaign: campaign.toJSON(),
            metrics: {
                totalLeads, // totalSchools -> totalLeads
                totalFollowups,
                leadStatusBreakdown // schoolStatusBreakdown -> leadStatusBreakdown
            }
        });
    } catch (err) {
        next(err);
    }
};
