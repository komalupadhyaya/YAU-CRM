import mongoose from 'mongoose';
import Campaign from '../models/campaign.model.js';
import Lead from '../models/lead.model.js';
import Followup from '../models/followup.model.js';
import Settings from '../models/settings.model.js';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dashboard  –  Consolidated real-time CRM snapshot
// ─────────────────────────────────────────────────────────────────────────────
export const getConsolidatedDashboard = async (req, res, next) => {
    try {
        const { campaignId } = req.query;
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);

        const leadMatch = {};
        if (campaignId) {
            leadMatch.campaign_id = new mongoose.Types.ObjectId(campaignId);
        }

        const [
            totalCampaigns,
            leadAgg,
            followupAgg,
            campaignSummaries,
            settings
        ] = await Promise.all([
            Campaign.countDocuments(campaignId ? { _id: campaignId } : {}),

            Lead.aggregate([
                { $match: leadMatch },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]),

            Followup.aggregate([
                { $match: { status: 'pending' } },
                ...(campaignId ? [
                    {
                        $lookup: {
                            from: 'leads',
                            localField: 'lead_id',
                            foreignField: '_id',
                            as: 'lead'
                        }
                    },
                    { $unwind: '$lead' },
                    { $match: { 'lead.campaign_id': new mongoose.Types.ObjectId(campaignId) } }
                ] : []),
                {
                    $group: {
                        _id: null,
                        overdue: {
                            $sum: {
                                $cond: [{ $lt: ['$follow_up_date', todayStr] }, 1, 0]
                            }
                        },
                        dueToday: {
                            $sum: {
                                $cond: [{ $eq: ['$follow_up_date', todayStr] }, 1, 0]
                            }
                        },
                        upcoming: {
                            $sum: {
                                $cond: [{ $gt: ['$follow_up_date', todayStr] }, 1, 0]
                            }
                        }
                    }
                }
            ]),

            Lead.aggregate([
                {
                    $group: {
                        _id: '$campaign_id',
                        totalLeads: { $sum: 1 },
                        meetingsScheduled: {
                            $sum: { $cond: [{ $eq: ['$status', 'Meeting Scheduled'] }, 1, 0] }
                        }
                    }
                }
            ]),

            Settings.findOne()
        ]);

        const statusLabels = settings?.statusLabels || [
            "Not Contacted",
            "Spoke to Office",
            "Meeting Scheduled",
            "Closed"
        ];

        let totalLeads = 0;
        const aggMap = {};
        leadAgg.forEach(s => {
            aggMap[s._id] = s.count;
            totalLeads += s.count;
        });

        const byStatus = statusLabels.map(label => ({
            status: label,
            count: aggMap[label] || 0
        }));

        const fuCounts = followupAgg[0] || { overdue: 0, dueToday: 0, upcoming: 0 };

        res.json({
            campaigns: {
                total: totalCampaigns
            },
            leads: {
                total: totalLeads,
                byStatus
            },
            followups: {
                overdue: fuCounts.overdue,
                dueToday: fuCounts.dueToday,
                upcoming: fuCounts.upcoming
            },
            pipeline: {
                statusBreakdown: byStatus
            },
            campaignSummaries: campaignSummaries || []
        });
    } catch (err) {
        next(err);
    }
};

export const getDashboardStats = async (req, res, next) => {
    try {
        const today = new Date().toISOString().slice(0, 10);

        const all = await Followup.find({ status: 'pending' })
            .populate({
                path: 'lead_id',
                select: 'name telephone campaign_id',
                populate: { path: 'campaign_id', select: 'name' }
            })
            .sort({ follow_up_date: 1 });

        const flatAll = all.map(f => {
            const data = f.toJSON();
            return {
                ...data,
                lead_name: data.lead_id?.name, // school_name -> lead_name
                lead_id_val: data.lead_id?._id, // school_id_val -> lead_id_val
                telephone: data.lead_id?.telephone,
                campaign_name: data.lead_id?.campaign_id?.name,
                campaign_id_val: data.lead_id?.campaign_id?._id
            };
        });

        const overdue = flatAll.filter(f => f.follow_up_date < today);
        const due = flatAll.filter(f => f.follow_up_date === today);
        const upcoming = flatAll.filter(f => f.follow_up_date > today);

        res.json({ overdue, due, upcoming, all: flatAll });
    } catch (err) {
        next(err);
    }
};

export const getCampaignSummaries = async (req, res, next) => {
    try {
        const settings = await Settings.findOne();
        const statusLabels = settings?.statusLabels || [];
        const meetingLabel = statusLabels.find(l => l.toLowerCase().includes("meeting")) || "Meeting Scheduled";

        const summaries = await Lead.aggregate([
            {
                $group: {
                    _id: '$campaign_id',
                    totalLeads: { $sum: 1 },
                    meetingsScheduled: {
                        $sum: { $cond: [{ $eq: ['$status', meetingLabel] }, 1, 0] }
                    }
                }
            }
        ]);
        res.json(summaries || []);
    } catch (err) {
        next(err);
    }
};

export const getCampaignCounts = async (req, res, next) => {
    try {
        const settings = await Settings.findOne();
        const statusLabels = settings?.statusLabels || ["Not Contacted"];
        const initialStatus = statusLabels[0];

        const campaign_id = req.params.campaignId;
        const totalLeads = await Lead.countDocuments({ campaign_id });
        const contactedLeads = await Lead.countDocuments({
            campaign_id,
            status: { $ne: initialStatus }
        });

        res.json({ totalLeads, contactedLeads });
    } catch (err) {
        next(err);
    }
};
