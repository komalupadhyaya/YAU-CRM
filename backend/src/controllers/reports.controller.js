import Campaign from '../models/campaign.model.js';
import School from '../models/school.model.js';
import Followup from '../models/followup.model.js';
import { jsonToCsv } from '../utils/csv.utils.js';
import mongoose from 'mongoose';

/**
 * GET /api/reports/overview
 * High-level CRM analytics.
 */
export const getReportsOverview = async (req, res, next) => {
    try {
        const todayStr = new Date().toISOString().slice(0, 10);

        const [
            campaignTotal,
            schoolAgg,
            followupAgg
        ] = await Promise.all([
            Campaign.countDocuments(),
            School.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]),
            Followup.aggregate([
                {
                    $group: {
                        _id: null,
                        totalPending: {
                            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
                        },
                        totalCompleted: {
                            $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] }
                        },
                        overdue: {
                            $sum: {
                                $cond: [
                                    { $and: [{ $eq: ['$status', 'pending'] }, { $lt: ['$follow_up_date', todayStr] }] },
                                    1, 0
                                ]
                            }
                        },
                        dueToday: {
                            $sum: {
                                $cond: [
                                    { $and: [{ $eq: ['$status', 'pending'] }, { $eq: ['$follow_up_date', todayStr] }] },
                                    1, 0
                                ]
                            }
                        },
                        upcoming: {
                            $sum: {
                                $cond: [
                                    { $and: [{ $eq: ['$status', 'pending'] }, { $gt: ['$follow_up_date', todayStr] }] },
                                    1, 0
                                ]
                            }
                        }
                    }
                }
            ])
        ]);

        const totalSchools = schoolAgg.reduce((sum, s) => sum + s.count, 0);
        const fuCounts = followupAgg[0] || {
            totalPending: 0, totalCompleted: 0,
            overdue: 0, dueToday: 0, upcoming: 0
        };

        res.json({
            campaigns: { total: campaignTotal },
            schools: {
                total: totalSchools,
                byStatus: schoolAgg.map(s => ({ status: s._id || 'Unknown', count: s.count }))
            },
            followups: fuCounts
        });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/reports/campaign-performance
 * Performance breakdown per campaign.
 */
export const getCampaignPerformance = async (req, res, next) => {
    try {
        const performance = await Campaign.aggregate([
            {
                $lookup: {
                    from: 'schools',
                    localField: '_id',
                    foreignField: 'campaign_id',
                    as: 'schools'
                }
            },
            {
                $lookup: {
                    from: 'followups',
                    let: { schoolIds: '$schools._id' },
                    pipeline: [
                        { $match: { $expr: { $in: ['$school_id', '$$schoolIds'] } } },
                        {
                            $group: {
                                _id: null,
                                total: { $sum: 1 },
                                completed: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
                                pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } }
                            }
                        }
                    ],
                    as: 'fuStats'
                }
            },
            {
                $project: {
                    campaignId: '$_id',
                    campaignName: '$name',
                    totalSchools: { $size: '$schools' },
                    totalFollowups: { $ifNull: [{ $arrayElemAt: ['$fuStats.total', 0] }, 0] },
                    completedFollowups: { $ifNull: [{ $arrayElemAt: ['$fuStats.completed', 0] }, 0] },
                    pendingFollowups: { $ifNull: [{ $arrayElemAt: ['$fuStats.pending', 0] }, 0] }
                }
            }
        ]);

        res.json(performance);
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/reports/followup-activity
 * Activity trends grouped by date.
 */
export const getFollowupActivity = async (req, res, next) => {
    try {
        const { startDate, endDate, campaignId } = req.query;
        let matchStage = {};

        if (startDate || endDate) {
            matchStage.follow_up_date = {};
            if (startDate) matchStage.follow_up_date.$gte = startDate;
            if (endDate) matchStage.follow_up_date.$lte = endDate;
        }

        const pipeline = [
            { $match: matchStage },
            // Filter by campaign if provided
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
                    _id: '$follow_up_date',
                    created: { $sum: 1 },
                    completed: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } }
                }
            },
            { $sort: { _id: 1 } },
            {
                $project: {
                    _id: 0,
                    date: '$_id',
                    created: 1,
                    completed: 1
                }
            }
        ];

        const activity = await Followup.aggregate(pipeline);
        res.json(activity);
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/reports/export
 * CSV export for schools, followups, or campaigns.
 */
export const exportData = async (req, res, next) => {
    try {
        const { type } = req.query;
        let data = [];
        let fields = [];
        let filename = `report_${type}_${new Date().toISOString().slice(0, 10)}.csv`;

        if (type === 'schools') {
            data = await School.aggregate([
                {
                    $lookup: {
                        from: 'campaigns',
                        localField: 'campaign_id',
                        foreignField: '_id',
                        as: 'campaign'
                    }
                },
                { $unwind: { path: '$campaign', preserveNullAndEmptyArrays: true } },
                {
                    $lookup: {
                        from: 'followups',
                        let: { schoolId: '$_id' },
                        pipeline: [
                            { $match: { $expr: { $eq: ['$school_id', '$$schoolId'] } } },
                            { $sort: { follow_up_date: -1 } },
                            { $limit: 1 }
                        ],
                        as: 'lastFU'
                    }
                },
                {
                    $project: {
                        _id: 0,
                        name: 1,
                        status: 1,
                        campaignName: '$campaign.name',
                        lastContactedDate: { $arrayElemAt: ['$lastFU.follow_up_date', 0] },
                        principal_name: 1,
                        principal_email: 1,
                        telephone: 1,
                        city: 1,
                        state: 1
                    }
                }
            ]);
            fields = ['name', 'status', 'campaignName', 'lastContactedDate', 'principal_name', 'principal_email', 'telephone', 'city', 'state'];
        } else if (type === 'followups') {
            data = await Followup.aggregate([
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
                    $lookup: {
                        from: 'campaigns',
                        localField: 'school.campaign_id',
                        foreignField: '_id',
                        as: 'campaign'
                    }
                },
                { $unwind: { path: '$campaign', preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        _id: 0,
                        follow_up_date: 1,
                        status: 1,
                        schoolName: '$school.name',
                        campaignName: '$campaign.name',
                        reason: 1,
                        completed_at: 1
                    }
                }
            ]);
            fields = ['follow_up_date', 'status', 'schoolName', 'campaignName', 'reason', 'completed_at'];
        } else if (type === 'campaigns') {
            data = await Campaign.aggregate([
                {
                    $lookup: {
                        from: 'schools',
                        localField: '_id',
                        foreignField: 'campaign_id',
                        as: 'schools'
                    }
                },
                {
                    $lookup: {
                        from: 'followups',
                        let: { schoolIds: '$schools._id' },
                        pipeline: [
                            { $match: { $expr: { $in: ['$school_id', '$$schoolIds'] } } },
                            { $count: 'count' }
                        ],
                        as: 'fuCount'
                    }
                },
                {
                    $project: {
                        _id: 0,
                        name: 1,
                        totalSchools: { $size: '$schools' },
                        totalFollowups: { $ifNull: [{ $arrayElemAt: ['$fuCount.count', 0] }, 0] }
                    }
                }
            ]);
            fields = ['name', 'totalSchools', 'totalFollowups'];
        } else {
            res.status(400);
            throw new Error('Invalid export type');
        }

        const csv = jsonToCsv(data, fields);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(csv);
    } catch (err) {
        next(err);
    }
};
