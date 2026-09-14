import Campaign from '../models/campaign.model.js';
import Lead from '../models/lead.model.js';
import EALead from '../models/eaLead.model.js';
import Followup from '../models/followup.model.js';
import WeeklyReport from '../models/weeklyReport.model.js';
import aiService from '../services/ai/ai.service.js';
import { sendWeeklyPerformanceReportEmail } from '../services/email/mailer.js';
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
            leadAgg,
            followupAgg
        ] = await Promise.all([
            Campaign.countDocuments(),
            Lead.aggregate([
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

        const totalLeads = leadAgg.reduce((sum, s) => sum + s.count, 0);
        const fuCounts = followupAgg[0] || {
            totalPending: 0, totalCompleted: 0,
            overdue: 0, dueToday: 0, upcoming: 0
        };

        res.json({
            campaigns: { total: campaignTotal },
            leads: {
                total: totalLeads,
                byStatus: leadAgg.map(s => ({ status: s._id || 'Unknown', count: s.count }))
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
                    from: 'leads',
                    localField: '_id',
                    foreignField: 'campaign_id',
                    as: 'leads'
                }
            },
            {
                $lookup: {
                    from: 'followups',
                    let: { leadIds: '$leads._id' },
                    pipeline: [
                        { $match: { $expr: { $in: ['$lead_id', '$$leadIds'] } } },
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
                    totalLeads: { $size: '$leads' },
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
 */
export const exportData = async (req, res, next) => {
    try {
        const { type } = req.query;
        let data = [];
        let fields = [];
        let filename = `report_${type}_${new Date().toISOString().slice(0, 10)}.csv`;

        if (type === 'leads') { // schools -> leads
            data = await Lead.aggregate([
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
                        let: { leadId: '$_id' },
                        pipeline: [
                            { $match: { $expr: { $eq: ['$lead_id', '$$leadId'] } } },
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
                        main_contact_name: 1,
                        main_contact_email: 1,
                        telephone: 1,
                        city: 1,
                        state: 1
                    }
                }
            ]);
            fields = ['name', 'status', 'campaignName', 'lastContactedDate', 'main_contact_name', 'main_contact_email', 'telephone', 'city', 'state'];
        } else if (type === 'followups') {
            data = await Followup.aggregate([
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
                    $lookup: {
                        from: 'campaigns',
                        localField: 'lead.campaign_id',
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
                        leadName: '$lead.name', // schoolName -> leadName
                        campaignName: '$campaign.name',
                        reason: 1,
                        completed_at: 1
                    }
                }
            ]);
            fields = ['follow_up_date', 'status', 'leadName', 'campaignName', 'reason', 'completed_at'];
        } else if (type === 'campaigns') {
            data = await Campaign.aggregate([
                {
                    $lookup: {
                        from: 'leads',
                        localField: '_id',
                        foreignField: 'campaign_id',
                        as: 'leads'
                    }
                },
                {
                    $lookup: {
                        from: 'followups',
                        let: { leadIds: '$leads._id' },
                        pipeline: [
                            { $match: { $expr: { $in: ['$lead_id', '$$leadIds'] } } },
                            { $count: 'count' }
                        ],
                        as: 'fuCount'
                    }
                },
                {
                    $project: {
                        _id: 0,
                        name: 1,
                        totalLeads: { $size: '$leads' },
                        totalFollowups: { $ifNull: [{ $arrayElemAt: ['$fuCount.count', 0] }, 0] }
                    }
                }
            ]);
            fields = ['name', 'totalLeads', 'totalFollowups'];
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

/**
 * Collect raw CRM performance statistics across Leads, EA Leads, Follow-ups, and Campaigns.
 */
export const collectWeeklyMetrics = async () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const [
        totalLeads,
        newLeads7d,
        leadsByStatus,
        totalEALeads,
        newEALeads7d,
        eaLeadsByScore,
        stalledEALeads,
        followupCounts,
        completedFollowups7d,
        campaignPerformance
    ] = await Promise.all([
        // Total Leads
        Lead.countDocuments().catch(() => 0),
        // New Leads in last 7 days
        Lead.countDocuments({ createdAt: { $gte: sevenDaysAgo } }).catch(() => 0),
        // Leads by status
        Lead.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]).catch(() => []),

        // Total EA Leads
        EALead.countDocuments().catch(() => 0),
        // New EA Leads in last 7 days
        EALead.countDocuments({ createdAt: { $gte: sevenDaysAgo } }).catch(() => 0),
        // EA Leads by AI Score
        EALead.aggregate([
            { $group: { _id: '$aiScore', count: { $sum: 1 } } }
        ]).catch(() => []),
        // Stalled EA Leads
        EALead.countDocuments({ isStalled: true }).catch(() => 0),

        // Follow-ups general counts
        Followup.aggregate([
            {
                $group: {
                    _id: null,
                    totalPending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
                    totalCompleted: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
                    overdue: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'pending'] }, { $lt: ['$date_time', todayStart] }] }, 1, 0] } },
                    dueToday: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'pending'] }, { $gte: ['$date_time', todayStart] }, { $lt: ['$date_time', todayEnd] }] }, 1, 0] } },
                    upcoming: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'pending'] }, { $gte: ['$date_time', todayEnd] }] }, 1, 0] } }
                }
            }
        ]).catch(() => []),

        // Completed Follow-ups in last 7 days
        Followup.countDocuments({ status: 'done', updatedAt: { $gte: sevenDaysAgo } }).catch(() => 0),

        // Campaign performance
        Campaign.aggregate([
            {
                $lookup: {
                    from: 'leads',
                    localField: '_id',
                    foreignField: 'campaign_id',
                    as: 'leads'
                }
            },
            {
                $project: {
                    name: 1,
                    totalLeads: { $size: '$leads' }
                }
            },
            { $sort: { totalLeads: -1 } },
            { $limit: 5 }
        ]).catch(() => [])
    ]);

    const fu = followupCounts[0] || { totalPending: 0, totalCompleted: 0, overdue: 0, dueToday: 0, upcoming: 0 };

    const hotLeads = eaLeadsByScore.find(s => String(s._id).toLowerCase() === 'hot')?.count || 0;
    const warmLeads = eaLeadsByScore.find(s => String(s._id).toLowerCase() === 'warm')?.count || 0;
    const coldLeads = eaLeadsByScore.find(s => String(s._id).toLowerCase() === 'cold')?.count || 0;

    return {
        totalLeads,
        newLeadsThisWeek: newLeads7d,
        leads: {
            total: totalLeads,
            newInLast7Days: newLeads7d,
            byStatus: leadsByStatus.map(s => ({ status: s._id || 'Unknown', count: s.count }))
        },
        eaLeads: {
            total: totalEALeads,
            newInLast7Days: newEALeads7d,
            stalled: stalledEALeads,
            hotLeads,
            warmLeads,
            coldLeads,
            byScore: eaLeadsByScore.map(s => ({ score: s._id || 'Unscored', count: s.count }))
        },
        eaStats: {
            total: totalEALeads,
            newInLast7Days: newEALeads7d,
            stalledCount: stalledEALeads,
            hotLeads,
            warmLeads,
            coldLeads,
        },
        followups: {
            totalPending: fu.totalPending,
            totalCompleted: fu.totalCompleted,
            completedLast7Days: completedFollowups7d,
            overdue: fu.overdue,
            dueToday: fu.dueToday,
            upcoming: fu.upcoming
        },
        followupStats: {
            completedLast7Days: completedFollowups7d,
            overduePending: fu.overdue,
            totalPending: fu.totalPending,
            totalCompleted: fu.totalCompleted
        },
        topCampaigns: campaignPerformance.map(c => ({ name: c.name, leads: c.totalLeads }))
    };
};

/**
 * Generate the Weekly AI Performance Briefing and optionally email to recipient.
 *
 * @param {string} recipientEmail
 * @param {boolean} sendEmail - If true, sends HTML email to recipient. If false, saves only to database.
 */
export const generateAndSendWeeklyPerformanceReport = async (recipientEmail = 'play@yausports.com', sendEmail = true) => {
    const now = new Date();
    const weekStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekEndDate = now;

    const startStr = weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = weekEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const weekRange = `${startStr} – ${endStr}`;

    console.log(`[Weekly AI Report] Aggregating CRM statistics for ${weekRange}...`);
    const rawStats = await collectWeeklyMetrics();

    console.log('[Weekly AI Report] Calling Claude Sonnet 4.6 for executive summary...');
    let executiveSummary = '';
    try {
        executiveSummary = await aiService.generateWeeklyExecutiveSummary(rawStats);
    } catch (aiErr) {
        console.error('[Weekly AI Report] AI summary generation failed:', aiErr.message);
        executiveSummary = `<p><strong>Weekly Overview:</strong> During the week of ${weekRange}, the team tracked <strong>${rawStats.leads.total} total leads</strong> (+${rawStats.leads.newInLast7Days} new) and <strong>${rawStats.eaLeads.total} evening activity inquiries</strong>. Completed follow-ups reached <strong>${rawStats.followups.completedLast7Days}</strong> with <strong>${rawStats.followups.overdue}</strong> overdue tasks requiring attention.</p>`;
    }

    let emailResult = { success: false, html: '' };
    if (sendEmail) {
        console.log(`[Weekly AI Report] Dispatching HTML briefing email to ${recipientEmail}...`);
        emailResult = await sendWeeklyPerformanceReportEmail({
            to: recipientEmail,
            weekRange,
            executiveSummaryHtml: executiveSummary,
            stats: rawStats
        });
    } else {
        console.log('[Weekly AI Report] Manual generation requested — skipping email dispatch.');
    }

    const reportDoc = await WeeklyReport.create({
        weekStartDate,
        weekEndDate,
        generatedAt: now,
        rawStats,
        executiveSummary,
        emailHtml: emailResult.html || '',
        recipient: sendEmail ? recipientEmail : 'local',
        status: sendEmail ? (emailResult.success ? 'sent' : 'failed') : 'generated',
        error: emailResult.error || null
    });

    console.log(`[Weekly AI Report] Report saved to database (ID: ${reportDoc._id}, status: ${reportDoc.status}).`);
    return reportDoc;
};

/**
 * GET /api/reports/weekly-ai-report/latest
 */
export const getLatestWeeklyReport = async (req, res, next) => {
    try {
        const report = await WeeklyReport.findOne().sort({ generatedAt: -1 }).lean();
        res.json({ success: true, report: report || null });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/reports/weekly-ai-report/history
 */
export const getWeeklyReportsHistory = async (req, res, next) => {
    try {
        const reports = await WeeklyReport.find()
            .sort({ generatedAt: -1 })
            .limit(10)
            .select('-emailHtml')
            .lean();
        res.json({ success: true, reports });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/reports/weekly-ai-report/generate
 */
export const triggerWeeklyReportManual = async (req, res, next) => {
    try {
        const { recipientEmail, sendEmail = false } = req.body;
        const targetEmail = recipientEmail || 'play@yausports.com';
        // Manual triggers do not send email unless explicitly requested (defaults to false)
        const report = await generateAndSendWeeklyPerformanceReport(targetEmail, sendEmail);
        res.json({
            success: true,
            message: sendEmail
                ? `Weekly AI Report generated and sent to ${targetEmail}`
                : 'Weekly AI Report generated and saved to database',
            report
        });
    } catch (err) {
        console.error('Trigger weekly report error:', err);
        res.status(500).json({ success: false, error: err.message || 'Failed to generate weekly report' });
    }
};
