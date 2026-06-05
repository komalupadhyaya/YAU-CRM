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

        let assignedCampaignIds = [];
        if (req.currentUserRole === 'sales_rep') {
            assignedCampaignIds = await Lead.distinct('campaign_id', { assigned_to: req.user.id });
        }

        const campaignFilter = campaignId 
            ? { _id: campaignId } 
            : (req.currentUserRole === 'sales_rep' ? { _id: { $in: assignedCampaignIds } } : {});

        const leadMatch = {};
        if (campaignId) {
            leadMatch.campaign_id = new mongoose.Types.ObjectId(campaignId);
        }
        if (req.currentUserRole === 'sales_rep') {
            leadMatch.assigned_to = new mongoose.Types.ObjectId(req.user.id);
        }

        const [
            totalCampaigns,
            leadAgg,
            followupAgg,
            campaignSummaries,
            settings
        ] = await Promise.all([
            Campaign.countDocuments(campaignFilter),

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
                {
                    $lookup: {
                        from: 'leads',
                        localField: 'lead_id',
                        foreignField: '_id',
                        as: 'lead'
                    }
                },
                { $unwind: '$lead' },
                ...(req.currentUserRole === 'sales_rep' ? [
                    { $match: { 'lead.assigned_to': new mongoose.Types.ObjectId(req.user.id) } }
                ] : []),
                ...(campaignId ? [
                    { $match: { 'lead.campaign_id': new mongoose.Types.ObjectId(campaignId) } }
                ] : []),
                {
                    $group: {
                        _id: null,
                        overdue: {
                            $sum: {
                                $cond: [{ $lt: ['$date_time', new Date(now.getFullYear(), now.getMonth(), now.getDate())] }, 1, 0]
                            }
                        },
                        dueToday: {
                            $sum: {
                                $cond: [
                                    { $and: [
                                        { $gte: ['$date_time', new Date(now.getFullYear(), now.getMonth(), now.getDate())] },
                                        { $lt: ['$date_time', new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)] }
                                    ]}, 1, 0
                                ]
                            }
                        },
                        upcoming: {
                            $sum: {
                                $cond: [{ $gte: ['$date_time', new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)] }, 1, 0]
                            }
                        }
                    }
                }
            ]),

            Lead.aggregate([
                ...(req.currentUserRole === 'sales_rep' ? [
                    { $match: { assigned_to: new mongoose.Types.ObjectId(req.user.id) } }
                ] : []),
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
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

        const all = await Followup.find({ status: 'pending' })
            .populate({
                path: 'lead_id',
                select: 'name telephone campaign_id assigned_to',
                populate: { path: 'campaign_id', select: 'name' }
            })
            .sort({ date_time: 1 });

        let flatAll = all.map(f => {
            const data = f.toJSON();
            return {
                ...data,
                lead_name: data.lead_id?.name,
                lead_id_val: data.lead_id?._id,
                telephone: data.lead_id?.telephone,
                campaign_name: data.lead_id?.campaign_id?.name,
                campaign_id_val: data.lead_id?.campaign_id?._id
            };
        });

        // Filter for sales reps
        if (req.currentUserRole === 'sales_rep') {
            flatAll = flatAll.filter(f => f.lead_id?.assigned_to?.toString() === req.user.id);
        }

        const overdue = flatAll.filter(f => new Date(f.date_time) < startOfToday);
        const due = flatAll.filter(f => {
            const dt = new Date(f.date_time);
            return dt >= startOfToday && dt < endOfToday;
        });
        const upcoming = flatAll.filter(f => new Date(f.date_time) >= endOfToday);

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
            ...(req.currentUserRole === 'sales_rep' ? [
                { $match: { assigned_to: new mongoose.Types.ObjectId(req.user.id) } }
            ] : []),
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
        const filter = { campaign_id };
        if (req.currentUserRole === 'sales_rep') {
            filter.assigned_to = req.user.id;
        }

        const totalLeads = await Lead.countDocuments(filter);
        const contactedLeads = await Lead.countDocuments({
            ...filter,
            status: { $ne: initialStatus }
        });

        res.json({ totalLeads, contactedLeads });
    } catch (err) {
        next(err);
    }
};
