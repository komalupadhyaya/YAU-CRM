import mongoose from 'mongoose';
import Campaign from '../models/campaign.model.js';
import School from '../models/school.model.js';
import Followup from '../models/followup.model.js';
import Settings from '../models/settings.model.js';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dashboard  –  Consolidated real-time CRM snapshot
// Supports query params: ?campaignId
// ─────────────────────────────────────────────────────────────────────────────
export const getConsolidatedDashboard = async (req, res, next) => {
    try {
        const { campaignId } = req.query;
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);

        // Build status match for school-related aggregations
        const schoolMatch = {};
        if (campaignId) {
            schoolMatch.campaign_id = new mongoose.Types.ObjectId(campaignId);
        }

        // Run all aggregations in parallel
        const [
            totalCampaigns,
            schoolAgg,
            followupAgg,
            campaignSummaries,
            settings
        ] = await Promise.all([
            // 1. Total campaigns (honors filter for consistency)
            Campaign.countDocuments(campaignId ? { _id: campaignId } : {}),

            // 2. Total schools + grouped by status
            School.aggregate([
                { $match: schoolMatch },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]),

            // 3. Follow-up grouping (overdue / dueToday / upcoming)
            Followup.aggregate([
                { $match: { status: 'pending' } },
                ...(campaignId ? [
                    {
                        $lookup: {
                            from: 'schools',
                            localField: 'school_id',
                            foreignField: '_id',
                            as: 'school'
                        }
                    },
                    { $unwind: '$school' },
                    { $match: { 'school.campaign_id': new mongoose.Types.ObjectId(campaignId) } }
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

            // 4. Acquisition Summaries
            School.aggregate([
                {
                    $group: {
                        _id: '$campaign_id',
                        totalSchools: { $sum: 1 },
                        meetingsScheduled: {
                            $sum: { $cond: [{ $eq: ['$status', 'Meeting Scheduled'] }, 1, 0] }
                        }
                    }
                }
            ]),

            // 5. Fetch Status Labels from Settings
            Settings.findOne()
        ]);

        // ── Process school aggregation with dynamic labels ────────────────────
        const statusLabels = settings?.statusLabels || [
            "Not Contacted",
            "Spoke to Office",
            "Meeting Scheduled",
            "Closed"
        ];

        let totalSchools = 0;
        const aggMap = {};
        schoolAgg.forEach(s => {
            aggMap[s._id] = s.count;
            totalSchools += s.count;
        });

        const byStatus = statusLabels.map(label => ({
            status: label,
            count: aggMap[label] || 0
        }));

        // ── Process follow-up aggregation ─────────────────────────────────────
        const fuCounts = followupAgg[0] || { overdue: 0, dueToday: 0, upcoming: 0 };

        res.json({
            campaigns: {
                total: totalCampaigns
            },
            schools: {
                total: totalSchools,
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

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY – kept to avoid breaking existing routes that depend on these handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/followups/dashboard
 * Returns the full list of pending follow-ups grouped into overdue/due/upcoming arrays.
 * Used by the frontend Dashboard for the detailed task panel.
 */
export const getDashboardStats = async (req, res, next) => {
    try {
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

        const all = await Followup.find({ status: 'pending' })
            .populate({
                path: 'school_id',
                select: 'name telephone campaign_id',
                populate: { path: 'campaign_id', select: 'name' }
            })
            .sort({ follow_up_date: 1 });

        const flatAll = all.map(f => {
            const data = f.toJSON();
            return {
                ...data,
                school_name: data.school_id?.name,
                school_id_val: data.school_id?._id,
                telephone: data.school_id?.telephone,
                campaign_name: data.school_id?.campaign_id?.name,
                campaign_id_val: data.school_id?.campaign_id?._id
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

/**
 * GET /api/schools/campaign-summaries
 * Used by the Campaign Acquisition Overview on the Dashboard.
 */
export const getCampaignSummaries = async (req, res, next) => {
    try {
        const settings = await Settings.findOne();
        const statusLabels = settings?.statusLabels || [];
        const meetingLabel = statusLabels.find(l => l.toLowerCase().includes("meeting")) || "Meeting Scheduled";

        const summaries = await School.aggregate([
            {
                $group: {
                    _id: '$campaign_id',
                    totalSchools: { $sum: 1 },
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

/**
 * GET /api/schools/campaign/:campaignId/school-counts
 * Returns total and contacted schools for a given campaign.
 */
export const getCampaignCounts = async (req, res, next) => {
    try {
        const settings = await Settings.findOne();
        const statusLabels = settings?.statusLabels || ["Not Contacted"];
        const initialStatus = statusLabels[0];

        const campaign_id = req.params.campaignId;
        const totalSchools = await School.countDocuments({ campaign_id });
        const contactedSchools = await School.countDocuments({
            campaign_id,
            status: { $ne: initialStatus }
        });

        res.json({ totalSchools, contactedSchools });
    } catch (err) {
        next(err);
    }
};
