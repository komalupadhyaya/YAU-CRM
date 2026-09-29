import mongoose from 'mongoose';
import Campaign from '../models/campaign.model.js';
import Lead from '../models/lead.model.js';
import EALead from '../models/eaLead.model.js';
import Followup from '../models/followup.model.js';
import Settings from '../models/settings.model.js';
import Call from '../models/call.model.js';
import Voicemail from '../models/voicemail.model.js';
import Meeting from '../models/meeting.model.js';
import User from '../models/user.model.js';
import Candidate from '../models/candidate.model.js';
import EmailCampaign from '../models/emailCampaign.model.js';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dashboard  –  Consolidated real-time CRM snapshot
// ─────────────────────────────────────────────────────────────────────────────
export const getConsolidatedDashboard = async (req, res, next) => {
    try {
        const { campaignId } = req.query;
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

        const isRep = req.currentUserRole === 'sales_rep';
        const repId = req.user?.id;

        // Concurrently resolve campaign count without sequential blocking
        const campaignCountPromise = (async () => {
            if (campaignId) {
                return Campaign.countDocuments({ _id: campaignId });
            }
            if (isRep && repId) {
                const assignedCampaignIds = await Lead.distinct('campaign_id', { assigned_to: repId });
                return Campaign.countDocuments({ _id: { $in: assignedCampaignIds } });
            }
            return Campaign.countDocuments({});
        })();

        const leadMatch = {};
        if (campaignId) {
            leadMatch.campaign_id = new mongoose.Types.ObjectId(campaignId);
        }
        if (isRep && repId) {
            leadMatch.assigned_to = new mongoose.Types.ObjectId(repId);
        }

        const [
            totalCampaigns,
            leadAgg,
            followupAgg,
            campaignSummaries,
            settings,
            eaScores
        ] = await Promise.all([
            campaignCountPromise,

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
                ...((isRep || campaignId) ? [
                    {
                        $lookup: {
                            from: 'leads',
                            localField: 'lead_id',
                            foreignField: '_id',
                            as: 'lead'
                        }
                    },
                    { $unwind: '$lead' },
                    ...(isRep ? [
                        { $match: { 'lead.assigned_to': new mongoose.Types.ObjectId(repId) } }
                    ] : []),
                    ...(campaignId ? [
                        { $match: { 'lead.campaign_id': new mongoose.Types.ObjectId(campaignId) } }
                    ] : [])
                ] : []),
                {
                    $group: {
                        _id: null,
                        overdue: {
                            $sum: {
                                $cond: [{ $lt: ['$date_time', startOfToday] }, 1, 0]
                            }
                        },
                        dueToday: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $gte: ['$date_time', startOfToday] },
                                            { $lt: ['$date_time', endOfToday] }
                                        ]
                                    }, 1, 0
                                ]
                            }
                        },
                        upcoming: {
                            $sum: {
                                $cond: [{ $gte: ['$date_time', endOfToday] }, 1, 0]
                            }
                        }
                    }
                }
            ]),

            Lead.aggregate([
                ...(isRep ? [
                    { $match: { assigned_to: new mongoose.Types.ObjectId(repId) } }
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

            Settings.findOne().lean().catch(() => null),

            EALead.aggregate([
                { $group: { _id: { $toLower: { $ifNull: ['$aiScore', 'cold'] } }, count: { $sum: 1 } } }
            ]).catch(() => [])
        ]);

        const eaScoresList = eaScores || [];

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

        // ── EA-Lead Temperature Pipeline Calculation (Exclusively for EA Leads) ──
        const eaHot = eaScoresList.find(s => String(s._id).toLowerCase() === 'hot')?.count || 0;
        const eaWarm = eaScoresList.find(s => String(s._id).toLowerCase() === 'warm')?.count || 0;
        const eaCold = eaScoresList.find(s => String(s._id).toLowerCase() === 'cold')?.count || 0;

        let crmHot = 0, crmWarm = 0, crmCold = 0;
        leadAgg.forEach(s => {
            const status = s._id;
            const count = s.count;
            if (['Meeting Scheduled', 'Proposal Sent', 'Interested', 'Program Confirmed'].includes(status)) {
                crmHot += count;
            } else if (['Spoke to Front Office', 'Spoke to Decision Maker', 'Waiting on Reply', 'Follow-Up Needed'].includes(status)) {
                crmWarm += count;
            } else {
                crmCold += count;
            }
        });

        const totalHot = eaHot;
        const totalWarm = eaWarm;
        const totalCold = eaCold;
        const totalOverall = totalHot + totalWarm + totalCold;

        const temperature = {
            total: totalOverall,
            hot: totalHot,
            warm: totalWarm,
            cold: totalCold,
            hotPct: totalOverall > 0 ? Math.round((totalHot / totalOverall) * 100) : 0,
            warmPct: totalOverall > 0 ? Math.round((totalWarm / totalOverall) * 100) : 0,
            coldPct: totalOverall > 0 ? Math.round((totalCold / totalOverall) * 100) : 0,
            ea: { hot: eaHot, warm: eaWarm, cold: eaCold, total: totalOverall },
            crm: { hot: crmHot, warm: crmWarm, cold: crmCold, total: totalLeads }
        };

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
            temperature,
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

        const isRep = req.currentUserRole === 'sales_rep';
        const repId = req.user?.id;

        // If sales rep, pre-filter lead IDs to avoid pulling all other reps' follow-ups
        let repLeadIds = null;
        if (isRep && repId) {
            repLeadIds = await Lead.find({ assigned_to: repId }).distinct('_id');
        }

        const followupQuery = {
            status: 'pending',
            ...(repLeadIds ? { lead_id: { $in: repLeadIds } } : {})
        };

        const all = await Followup.find(followupQuery)
            .select('_id title notes date_time type priority status lead_id candidate_id')
            .populate({
                path: 'lead_id',
                select: 'name telephone campaign_id assigned_to',
                populate: { path: 'campaign_id', select: 'name' }
            })
            .populate('candidate_id', 'name email phone')
            .sort({ date_time: 1 })
            .lean();

        let flatAll = all.map(f => ({
            ...f,
            lead_name: f.lead_id?.name || f.candidate_id?.name,
            lead_id_val: f.lead_id?._id,
            candidate_id_val: f.candidate_id?._id,
            telephone: f.lead_id?.telephone || f.candidate_id?.phone,
            campaign_name: f.lead_id?.campaign_id?.name || "HC Candidates",
            campaign_id_val: f.lead_id?.campaign_id?._id || "candidate"
        }));

        if (isRep && repId) {
            flatAll = flatAll.filter(f => f.lead_id?.assigned_to?.toString() === repId);
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
        const settings = await Settings.findOne().lean().catch(() => null);
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
        const campaign_id = req.params.campaignId;
        const filter = { campaign_id };
        if (req.currentUserRole === 'sales_rep') {
            filter.assigned_to = req.user.id;
        }

        const [settings, totalLeads] = await Promise.all([
            Settings.findOne().lean().catch(() => null),
            Lead.countDocuments(filter)
        ]);

        const statusLabels = settings?.statusLabels || ["Not Contacted"];
        const initialStatus = statusLabels[0];

        const contactedLeads = await Lead.countDocuments({
            ...filter,
            status: { $ne: initialStatus }
        });

        res.json({ totalLeads, contactedLeads });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dashboard/command-center
// Section 4 — AI Dashboard Redesign (Phase 4) Unified Command Center Aggregator
// ─────────────────────────────────────────────────────────────────────────────
export const getCommandCenterDashboard = async (req, res, next) => {
    try {
        const userRole = req.currentUserRole || req.user?.role;
        const isRep = userRole === 'sales_rep';
        const isAdmin = userRole === 'admin';
        const repId = req.user?.id || req.user?._id;
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Current week calculation (Monday to Sunday)
        const dayOfWeek = now.getDay();
        const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
        const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);

        const repObjectId = repId ? new mongoose.Types.ObjectId(repId) : null;
        const repFilter = (isRep && repObjectId) ? { assigned_to: { $in: [repObjectId, String(repId)] } } : {};
        const repFilterObj = repFilter;

        // Role-based scoping for meetings:
        // Sales Reps: only meetings where they are internal attendee, CC attendee, creator, or assigned lead.
        // Admin & Manager: all meetings across the organization this week.
        let repMeetingFilter = {};
        if (isRep) {
            const assignedLeadIds = await Lead.distinct('_id', { assigned_to: repId }).catch(() => []);
            const userEmail = (req.user?.email || '').toLowerCase();
            repMeetingFilter = {
                $or: [
                    { internal_attendees: new mongoose.Types.ObjectId(repId) },
                    { cc_attendees: new mongoose.Types.ObjectId(repId) },
                    { created_by: new mongoose.Types.ObjectId(repId) },
                    ...(userEmail ? [{ external_emails: userEmail }] : []),
                    ...(assignedLeadIds.length > 0 ? [{ lead_id: { $in: assignedLeadIds } }, { lead_ids: { $in: assignedLeadIds } }] : [])
                ]
            };
        }

        // Run independent widget queries in parallel
        const [
            crmHotLeadsRaw,
            eaHotLeadsRaw,
            stalledLeadsRaw,
            stalledCountsRaw,
            smsUnreadLeadsRaw,
            allFollowupsRaw,
            aiSuggestionsRaw,
            eaTodayCount,
            eaYesterdayCount,
            recentNewEaLeads,
            scoreBreakdownRaw,
            retellDataRaw,
            meetingsRaw,
            emailCampaignsRaw
        ] = await Promise.all([
            // ── Widget 1: Hot Leads (targeted select + lean) ──
            Lead.find({
                ...repFilterObj,
                $or: [
                    { aiScore: { $regex: /^hot$/i } },
                    { status: { $in: ['Meeting Scheduled', 'Proposal Sent', 'Interested', 'Program Confirmed'] } }
                ]
            })
                .select('name telephone campaign_id status aiScore aiScoreReason assigned_to lastActivityAt updatedAt')
                .populate('assigned_to', 'name email role')
                .populate('campaign_id', 'name')
                .sort({ updatedAt: -1 })
                .limit(20)
                .lean()
                .catch(() => []),

            EALead.find({
                ...repFilterObj,
                aiScore: { $regex: /^hot$/i }
            })
                .select('name phone status aiScore aiScoreReason assigned_to lastActivityAt updatedAt')
                .populate('assigned_to', 'name email role')
                .sort({ updatedAt: -1 })
                .limit(20)
                .lean()
                .catch(() => []),

            // ── Widget 2: Stalled Leads (Sales Rep: assigned CRM leads only; Admin/Manager: all EA & CRM) ──
            Promise.all([
                isRep ? Promise.resolve([]) : EALead.find({ isStalled: true })
                    .select('name phone email aiScore daysInactive stalledReason stalledReengagementDraft assigned_to')
                    .populate('assigned_to', 'name email role')
                    .sort({ daysInactive: -1 })
                    .limit(50)
                    .lean()
                    .catch(() => []),
                Lead.find({ isStalled: true, ...repFilter })
                    .select('name telephone email aiScore daysInactive stalledReason stalledReengagementDraft assigned_to')
                    .populate('assigned_to', 'name email role')
                    .sort({ daysInactive: -1 })
                    .limit(50)
                    .lean()
                    .catch(() => [])
            ]),

            // Stalled lead counts
            Promise.all([
                isRep ? Promise.resolve([]) : EALead.aggregate([
                    { $match: { isStalled: true } },
                    { $group: { _id: '$aiScore', count: { $sum: 1 } } }
                ]).catch(() => []),
                Lead.aggregate([
                    { $match: { isStalled: true, ...repFilter } },
                    { $group: { _id: '$aiScore', count: { $sum: 1 } } }
                ]).catch(() => [])
            ]),

            // ── Widget 3: Unread SMS Replies / Recent SMS Activity ──
            // Sales Reps: zero EA Leads, only assigned Main CRM Leads
            // Admins & Managers: all EA Leads and all CRM Leads
            Promise.all([
                isRep ? Promise.resolve([]) : EALead.find({
                    $or: [
                        { unreadCount: { $gt: 0 } },
                        { 'smsHistory.0': { $exists: true } }
                    ]
                }, { smsHistory: { $slice: -5 } })
                    .select('name phone smsHistory unreadCount aiScore updatedAt assigned_to')
                    .populate('assigned_to', 'name email')
                    .sort({ updatedAt: -1 })
                    .limit(30)
                    .lean()
                    .catch(() => []),
                Lead.find({
                    ...(isRep ? repFilter : {}),
                    $or: [
                        { unreadCount: { $gt: 0 } },
                        { 'smsHistory.0': { $exists: true } }
                    ]
                }, { smsHistory: { $slice: -5 } })
                    .select('name telephone smsHistory unreadCount aiScore updatedAt assigned_to')
                    .populate('assigned_to', 'name email')
                    .sort({ updatedAt: -1 })
                    .limit(30)
                    .lean()
                    .catch(() => [])
            ]),

            // ── Widget 4: Follow-Ups Due Today & Overdue (bounded to < endOfToday) ──
            Followup.find({
                status: 'pending',
                date_time: { $lt: endOfToday }
            })
                .select('_id title notes date_time type priority status lead_id ea_lead_id candidate_id')
                .populate({
                    path: 'lead_id',
                    select: 'name telephone campaign_id assigned_to',
                    populate: { path: 'campaign_id', select: 'name' }
                })
                .populate('ea_lead_id', 'name phone assigned_to aiScore')
                .populate('candidate_id', 'name email phone')
                .sort({ date_time: 1 })
                .lean()
                .catch(() => []),

            // ── Widget 5: AI Suggestions Pending (Sales Rep: assigned CRM leads only; Admin/Manager: all EA & CRM) ──
            Promise.all([
                isRep ? Promise.resolve([]) : EALead.find({
                    'aiNextAction.action': { $ne: null },
                    'aiNextAction.status': { $in: ['active', 'pending'] }
                })
                    .select('name phone email aiScore aiNextAction assigned_to updatedAt')
                    .populate('assigned_to', 'name email')
                    .limit(50)
                    .lean()
                    .catch(() => []),
                Lead.find({
                    ...(isRep ? { assigned_to: repId } : {}),
                    'aiNextAction.action': { $ne: null },
                    'aiNextAction.status': { $in: ['active', 'pending'] }
                })
                    .select('name telephone email aiScore status aiNextAction assigned_to updatedAt')
                    .populate('assigned_to', 'name email')
                    .limit(50)
                    .lean()
                    .catch(() => [])
            ]),

            // ── Widget 6: New EA Leads Today vs Yesterday ──
            EALead.countDocuments({
                dateSubmitted: { $gte: startOfToday, $lt: endOfToday },
                ...repFilterObj
            }).catch(() => 0),
            EALead.countDocuments({
                dateSubmitted: { $gte: startOfYesterday, $lt: startOfToday },
                ...repFilterObj
            }).catch(() => 0),
            EALead.find({
                dateSubmitted: { $gte: startOfToday, $lt: endOfToday },
                ...repFilterObj
            })
                .select('name phone email aiScore dateSubmitted assigned_to')
                .populate('assigned_to', 'name')
                .sort({ dateSubmitted: -1 })
                .limit(6)
                .lean()
                .catch(() => []),

            // ── Widget 7: EA-Lead Score Breakdown (Exclusively EA Leads) ──
            EALead.aggregate([
                ...(isRep ? [{ $match: { assigned_to: new mongoose.Types.ObjectId(repId) } }] : []),
                { $group: { _id: { $toLower: { $ifNull: ['$aiScore', 'cold'] } }, count: { $sum: 1 } } }
            ]).catch(() => []),

            // ── Widget 8: Retell AI Call Summary (Admin Only - Real Data Multi-Timeframe Aggregation) ──
            isAdmin ? Promise.all([
                Call.aggregate([
                    {
                        $group: {
                            _id: null,
                            aiCallsToday: {
                                $sum: {
                                    $cond: [
                                        {
                                            $and: [
                                                { $gte: ['$timestamp', startOfToday] },
                                                { $or: [{ $eq: ['$source', 'retell'] }, { $ne: ['$retellCallId', null] }] }
                                            ]
                                        },
                                        1, 0
                                    ]
                                }
                            },
                            transfersToday: {
                                $sum: {
                                    $cond: [
                                        {
                                            $and: [
                                                { $gte: ['$timestamp', startOfToday] },
                                                {
                                                    $or: [
                                                        { $and: [{ $ne: ['$forwardedToNumber', null] }, { $ne: ['$forwardedToNumber', ''] }] },
                                                        { $and: [{ $ne: ['$forwardedToUser', null] }, { $ne: ['$forwardedToUser', ''] }] }
                                                    ]
                                                }
                                            ]
                                        },
                                        1, 0
                                    ]
                                }
                            },
                            aiCalls7d: {
                                $sum: {
                                    $cond: [
                                        {
                                            $and: [
                                                { $gte: ['$timestamp', sevenDaysAgo] },
                                                { $or: [{ $eq: ['$source', 'retell'] }, { $ne: ['$retellCallId', null] }] }
                                            ]
                                        },
                                        1, 0
                                    ]
                                }
                            },
                            transfers7d: {
                                $sum: {
                                    $cond: [
                                        {
                                            $and: [
                                                { $gte: ['$timestamp', sevenDaysAgo] },
                                                {
                                                    $or: [
                                                        { $and: [{ $ne: ['$forwardedToNumber', null] }, { $ne: ['$forwardedToNumber', ''] }] },
                                                        { $and: [{ $ne: ['$forwardedToUser', null] }, { $ne: ['$forwardedToUser', ''] }] }
                                                    ]
                                                }
                                            ]
                                        },
                                        1, 0
                                    ]
                                }
                            },
                            aiCalls30d: {
                                $sum: {
                                    $cond: [
                                        {
                                            $and: [
                                                { $gte: ['$timestamp', thirtyDaysAgo] },
                                                { $or: [{ $eq: ['$source', 'retell'] }, { $ne: ['$retellCallId', null] }] }
                                            ]
                                        },
                                        1, 0
                                    ]
                                }
                            },
                            transfers30d: {
                                $sum: {
                                    $cond: [
                                        {
                                            $and: [
                                                { $gte: ['$timestamp', thirtyDaysAgo] },
                                                {
                                                    $or: [
                                                        { $and: [{ $ne: ['$forwardedToNumber', null] }, { $ne: ['$forwardedToNumber', ''] }] },
                                                        { $and: [{ $ne: ['$forwardedToUser', null] }, { $ne: ['$forwardedToUser', ''] }] }
                                                    ]
                                                }
                                            ]
                                        },
                                        1, 0
                                    ]
                                }
                            },
                            aiCallsAll: {
                                $sum: {
                                    $cond: [
                                        { $or: [{ $eq: ['$source', 'retell'] }, { $ne: ['$retellCallId', null] }] },
                                        1, 0
                                    ]
                                }
                            },
                            transfersAll: {
                                $sum: {
                                    $cond: [
                                        {
                                            $or: [
                                                { $and: [{ $ne: ['$forwardedToNumber', null] }, { $ne: ['$forwardedToNumber', ''] }] },
                                                { $and: [{ $ne: ['$forwardedToUser', null] }, { $ne: ['$forwardedToUser', ''] }] }
                                            ]
                                        },
                                        1, 0
                                    ]
                                }
                            }
                        }
                    }
                ]).catch(() => []),
                Voicemail.aggregate([
                    {
                        $group: {
                            _id: null,
                            voicemailsToday: {
                                $sum: { $cond: [{ $gte: ['$createdAt', startOfToday] }, 1, 0] }
                            },
                            voicemailsTodayUnread: {
                                $sum: {
                                    $cond: [
                                        { $and: [{ $gte: ['$createdAt', startOfToday] }, { $eq: ['$listenedAt', null] }] },
                                        1, 0
                                    ]
                                }
                            },
                            voicemails7d: {
                                $sum: { $cond: [{ $gte: ['$createdAt', sevenDaysAgo] }, 1, 0] }
                            },
                            voicemails7dUnread: {
                                $sum: {
                                    $cond: [
                                        { $and: [{ $gte: ['$createdAt', sevenDaysAgo] }, { $eq: ['$listenedAt', null] }] },
                                        1, 0
                                    ]
                                }
                            },
                            voicemails30d: {
                                $sum: { $cond: [{ $gte: ['$createdAt', thirtyDaysAgo] }, 1, 0] }
                            },
                            voicemails30dUnread: {
                                $sum: {
                                    $cond: [
                                        { $and: [{ $gte: ['$createdAt', thirtyDaysAgo] }, { $eq: ['$listenedAt', null] }] },
                                        1, 0
                                    ]
                                }
                            },
                            voicemailsAll: { $sum: 1 },
                            voicemailsAllUnread: {
                                $sum: { $cond: [{ $eq: ['$listenedAt', null] }, 1, 0] }
                            }
                        }
                    }
                ]).catch(() => [])
            ]) : null,

            // ── Widget 9: Meetings Scheduled (Multi-Timeframe Support) ──
            Meeting.find({
                status: { $ne: 'canceled' },
                ...repMeetingFilter
            })
                .select('title category date_time duration_minutes meeting_type meeting_link zoom_start_url status lead_id lead_ids candidate_id candidate_ids internal_attendees cc_attendees created_by')
                .populate('lead_id', 'name telephone')
                .populate('lead_ids', 'name telephone')
                .populate('candidate_id', 'name phone email applying_for')
                .populate('candidate_ids', 'name phone email applying_for')
                .populate('internal_attendees', 'name email role')
                .populate('cc_attendees', 'name email')
                .populate('created_by', 'name email')
                .sort({ date_time: 1 })
                .lean()
                .catch(() => []),

            // ── Widget 10: Email Campaign Activity (Admin Only) ──
            isAdmin ? EmailCampaign.find()
                .select('title subject status sentAt stats createdAt recipientLogs')
                .sort({ createdAt: -1 })
                .limit(50)
                .lean()
                .catch(() => []) : null
        ]);

        // ─────────────────────────────────────────────────────────────────────
        // Format Widget 1: Hot Leads
        // ─────────────────────────────────────────────────────────────────────
        const formattedCrmHot = (crmHotLeadsRaw || []).map(l => ({
            _id: l._id,
            name: l.name,
            leadType: 'lead',
            phone: l.telephone,
            campaignName: l.campaign_id?.name || 'General Campaign',
            status: l.status,
            aiScore: l.aiScore || 'Hot',
            aiScoreReason: l.aiScoreReason || (l.status ? `Status: ${l.status}` : 'High conversion probability'),
            assignedTo: l.assigned_to ? { name: l.assigned_to.name, email: l.assigned_to.email } : null,
            lastActivityAt: l.lastActivityAt || l.updatedAt
        }));

        const formattedEaHot = (eaHotLeadsRaw || []).map(l => ({
            _id: l._id,
            name: l.name,
            leadType: 'ea_lead',
            phone: l.phone,
            campaignName: 'Early Access',
            status: l.status || 'Active EA Lead',
            aiScore: l.aiScore || 'Hot',
            aiScoreReason: l.aiScoreReason || 'Engaged EA applicant / responsive',
            assignedTo: l.assigned_to ? { name: l.assigned_to.name, email: l.assigned_to.email } : null,
            lastActivityAt: l.lastActivityAt || l.updatedAt
        }));

        const combinedHotLeads = [...formattedCrmHot, ...formattedEaHot]
            .sort((a, b) => new Date(b.lastActivityAt || 0).getTime() - new Date(a.lastActivityAt || 0).getTime());

        // ─────────────────────────────────────────────────────────────────────
        // Format Widget 2: Stalled Leads
        // ─────────────────────────────────────────────────────────────────────
        const [stalledEAs, stalledCRMs] = stalledLeadsRaw || [[], []];
        const formattedStalled = [
            ...stalledEAs.map(l => ({
                _id: l._id,
                name: l.name,
                email: l.email,
                leadType: 'ea_lead',
                phone: l.phone,
                score: l.aiScore || 'Cold',
                daysInactive: l.daysInactive || 0,
                stalledReason: l.stalledReason,
                draftMessage: l.stalledReengagementDraft?.text,
                assignedTo: l.assigned_to ? { name: l.assigned_to.name, email: l.assigned_to.email } : null
            })),
            ...stalledCRMs.map(l => ({
                _id: l._id,
                name: l.name,
                email: l.email,
                leadType: 'lead',
                phone: l.telephone,
                score: l.aiScore || 'Cold',
                daysInactive: l.daysInactive || 0,
                stalledReason: l.stalledReason,
                draftMessage: l.stalledReengagementDraft?.text,
                assignedTo: l.assigned_to ? { name: l.assigned_to.name, email: l.assigned_to.email } : null
            }))
        ].sort((a, b) => (b.daysInactive || 0) - (a.daysInactive || 0));

        const [eaStalledAgg, crmStalledAgg] = stalledCountsRaw || [[], []];
        let stalledTotal = 0, stalledHot = 0, stalledWarm = 0, stalledCold = 0;
        [...eaStalledAgg, ...crmStalledAgg].forEach(item => {
            const sc = String(item._id || '').toLowerCase();
            const count = item.count || 0;
            stalledTotal += count;
            if (sc === 'hot') stalledHot += count;
            else if (sc === 'warm') stalledWarm += count;
            else stalledCold += count;
        });

        // ─────────────────────────────────────────────────────────────────────
        // Format Widget 3: Unread SMS Replies
        // ─────────────────────────────────────────────────────────────────────
        const [eaUnreadLeads, mainUnreadLeads] = smsUnreadLeadsRaw || [[], []];
        const unreadSmsList = [];
        let totalUnreadSmsCount = 0;

        (eaUnreadLeads || []).forEach(l => {
            totalUnreadSmsCount += (l.unreadCount || 0);
            const history = l.smsHistory || [];
            let unreadItems = history.filter(m => m.direction === 'inbound' && !m.isRead);
            if (unreadItems.length === 0 && history.length > 0) {
                const latestInbound = [...history].reverse().find(m => m.direction === 'inbound');
                const latest = latestInbound || history[history.length - 1];
                if (latest) unreadItems = [latest];
            }
            unreadItems.forEach(m => {
                unreadSmsList.push({
                    leadId: l._id,
                    leadType: 'ea_lead',
                    senderName: l.name,
                    phone: l.phone,
                    aiScore: l.aiScore || 'Hot',
                    message: m.message,
                    timestamp: m.timestamp,
                    unreadCount: l.unreadCount || 0,
                    assignedTo: l.assigned_to?.name || null,
                    assignedToId: l.assigned_to?._id?.toString() || l.assigned_to?.toString() || null
                });
            });
        });

        (mainUnreadLeads || []).forEach(l => {
            totalUnreadSmsCount += (l.unreadCount || 0);
            const history = l.smsHistory || [];
            let unreadItems = history.filter(m => m.direction === 'inbound' && !m.isRead);
            if (unreadItems.length === 0 && history.length > 0) {
                const latestInbound = [...history].reverse().find(m => m.direction === 'inbound');
                const latest = latestInbound || history[history.length - 1];
                if (latest) unreadItems = [latest];
            }
            unreadItems.forEach(m => {
                unreadSmsList.push({
                    leadId: l._id,
                    leadType: 'lead',
                    senderName: l.name,
                    phone: l.telephone,
                    aiScore: l.aiScore || 'Warm',
                    message: m.message,
                    timestamp: m.timestamp,
                    unreadCount: l.unreadCount || 0,
                    assignedTo: l.assigned_to?.name || null,
                    assignedToId: l.assigned_to?._id?.toString() || l.assigned_to?.toString() || null
                });
            });
        });

        unreadSmsList.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

        // ─────────────────────────────────────────────────────────────────────
        // Format Widget 4: Follow-Ups Due Today & Overdue
        // ─────────────────────────────────────────────────────────────────────
        let filteredFollowups = (allFollowupsRaw || []).map(f => {
            const leadAssignedTo = f.lead_id?.assigned_to?.toString() || f.ea_lead_id?.assigned_to?.toString();
            return {
                _id: f._id,
                title: f.title || `${f.type || 'Followup'}: ${f.lead_id?.name || f.ea_lead_id?.name || f.candidate_id?.name || 'Lead'}`,
                notes: f.notes || '',
                date_time: f.date_time,
                type: f.type || 'Task',
                priority: f.priority || 'Medium',
                status: f.status,
                lead_id_val: f.lead_id?._id || f.ea_lead_id?._id,
                lead_name: f.lead_id?.name || f.ea_lead_id?.name || f.candidate_id?.name || 'Lead',
                leadType: f.ea_lead_id ? 'ea_lead' : (f.candidate_id ? 'candidate' : 'lead'),
                telephone: f.lead_id?.telephone || f.ea_lead_id?.phone || f.candidate_id?.phone,
                assignedTo: f.lead_id?.assigned_to || f.ea_lead_id?.assigned_to,
                assignedRepId: leadAssignedTo
            };
        });

        if (isRep) {
            filteredFollowups = filteredFollowups.filter(f => f.assignedRepId === repId);
        }

        const overdueFollowups = filteredFollowups.filter(f => new Date(f.date_time) < startOfToday);
        const dueTodayFollowups = filteredFollowups.filter(f => {
            const dt = new Date(f.date_time);
            return dt >= startOfToday && dt < endOfToday;
        });

        // ─────────────────────────────────────────────────────────────────────
        // Format Widget 5: AI Suggestions Pending
        // ─────────────────────────────────────────────────────────────────────
        const [eaSuggestionsRaw, crmSuggestionsRaw] = aiSuggestionsRaw || [[], []];
        const aiSuggestions = [
            ...(eaSuggestionsRaw || []).map(l => ({
                leadId: l._id,
                leadType: 'ea_lead',
                name: l.name,
                phone: l.phone,
                email: l.email,
                aiScore: l.aiScore || 'Hot',
                action: l.aiNextAction?.action,
                reason: l.aiNextAction?.reason,
                priority: l.aiNextAction?.priority || 'medium',
                recommendedDueDate: l.aiNextAction?.recommendedDueDate,
                status: l.aiNextAction?.status,
                suggestedAt: l.aiNextAction?.suggestedAt || l.updatedAt,
                activityTrigger: l.aiNextAction?.activityTrigger,
                assignedTo: l.assigned_to?.name
            })),
            ...(crmSuggestionsRaw || []).map(l => ({
                leadId: l._id,
                leadType: 'lead',
                name: l.name,
                phone: l.telephone,
                email: l.email,
                aiScore: l.aiScore || 'Warm',
                action: l.aiNextAction?.action,
                reason: l.aiNextAction?.reason,
                priority: l.aiNextAction?.priority || 'medium',
                recommendedDueDate: l.aiNextAction?.recommendedDueDate,
                status: l.aiNextAction?.status,
                suggestedAt: l.aiNextAction?.suggestedAt || l.updatedAt,
                activityTrigger: l.aiNextAction?.activityTrigger,
                assignedTo: l.assigned_to?.name
            }))
        ].sort((a, b) => new Date(b.suggestedAt || 0).getTime() - new Date(a.suggestedAt || 0).getTime());

        // ─────────────────────────────────────────────────────────────────────
        // Format Widget 6: New EA Leads Today
        // ─────────────────────────────────────────────────────────────────────
        const eaDelta = (eaTodayCount || 0) - (eaYesterdayCount || 0);
        const eaPctChange = (eaYesterdayCount || 0) > 0
            ? Math.round((eaDelta / eaYesterdayCount) * 100)
            : ((eaTodayCount || 0) > 0 ? 100 : 0);

        const newEaLeadsWidget = {
            todayCount: eaTodayCount || 0,
            yesterdayCount: eaYesterdayCount || 0,
            delta: eaDelta,
            pctChange: eaPctChange,
            recentLeads: (recentNewEaLeads || []).map(l => ({
                _id: l._id,
                name: l.name,
                phone: l.phone,
                email: l.email,
                aiScore: l.aiScore || 'Cold',
                dateSubmitted: l.dateSubmitted,
                assignedTo: l.assigned_to?.name
            }))
        };

        // ─────────────────────────────────────────────────────────────────────
        // Format Widget 7: EA-Lead Score Breakdown (Exclusively EA Leads)
        // ─────────────────────────────────────────────────────────────────────
        const eaScoreAgg = scoreBreakdownRaw || [];
        let totalHotCount = 0, totalWarmCount = 0, totalColdCount = 0;

        (Array.isArray(eaScoreAgg) ? eaScoreAgg : []).forEach(item => {
            const sc = String(item._id || '').toLowerCase();
            const count = item.count || 0;
            if (sc === 'hot') totalHotCount += count;
            else if (sc === 'warm') totalWarmCount += count;
            else if (sc === 'cold') totalColdCount += count;
        });

        const totalScoredLeads = totalHotCount + totalWarmCount + totalColdCount;
        const scoreBreakdown = {
            hot: totalHotCount,
            warm: totalWarmCount,
            cold: totalColdCount,
            total: totalScoredLeads,
            hotPct: totalScoredLeads > 0 ? Math.round((totalHotCount / totalScoredLeads) * 100) : 0,
            warmPct: totalScoredLeads > 0 ? Math.round((totalWarmCount / totalScoredLeads) * 100) : 0,
            coldPct: totalScoredLeads > 0 ? Math.round((totalColdCount / totalScoredLeads) * 100) : 0
        };

        // ─────────────────────────────────────────────────────────────────────
        // Format Widget 8: Retell AI Call Summary (Admin Only - Multi-Timeframe)
        // ─────────────────────────────────────────────────────────────────────
        let retellCallSummary = null;
        if (isAdmin && retellDataRaw) {
            const [callAgg, vmAgg] = retellDataRaw;
            const cs = callAgg?.[0] || {};
            const vs = vmAgg?.[0] || {};

            retellCallSummary = {
                today: {
                    aiCalls: cs.aiCallsToday || 0,
                    transfersCompleted: cs.transfersToday || 0,
                    voicemails: vs.voicemailsToday || 0,
                    voicemailsUnread: vs.voicemailsTodayUnread || 0
                },
                "7d": {
                    aiCalls: cs.aiCalls7d || 0,
                    transfersCompleted: cs.transfers7d || 0,
                    voicemails: vs.voicemails7d || 0,
                    voicemailsUnread: vs.voicemails7dUnread || 0
                },
                "30d": {
                    aiCalls: cs.aiCalls30d || 0,
                    transfersCompleted: cs.transfers30d || 0,
                    voicemails: vs.voicemails30d || 0,
                    voicemailsUnread: vs.voicemails30dUnread || 0
                },
                all: {
                    aiCalls: cs.aiCallsAll || 0,
                    transfersCompleted: cs.transfersAll || 0,
                    voicemails: vs.voicemailsAll || 0,
                    voicemailsUnread: vs.voicemailsAllUnread || 0
                },
                // Backwards compatibility fallbacks
                aiCallsToday: cs.aiCallsToday || 0,
                transfersCompleted: cs.transfersToday || 0,
                voicemailsToday: vs.voicemailsToday || 0,
                voicemailsUnread: vs.voicemailsTodayUnread || 0
            };
        }

        // ─────────────────────────────────────────────────────────────────────
        // Format Widget 9: Meetings Scheduled (Multi-Timeframe Support)
        // ─────────────────────────────────────────────────────────────────────
        const allFormattedMeetings = (meetingsRaw || []).map(m => {
            const rawLink = m.meeting_link || m.zoom_start_url;
            const sanitizedLink = rawLink
                ? (rawLink.startsWith('http://') || rawLink.startsWith('https://') ? rawLink : `https://${rawLink}`)
                : null;
            return {
                _id: m._id,
                title: m.title,
                category: m.category, // 'school' | 'hr'
                dateTime: m.date_time,
                duration: m.duration_minutes || 30,
                meetingType: m.meeting_type || 'online',
                meetingLink: sanitizedLink,
                status: m.status || 'scheduled',
                leadName: m.lead_id?.name || (m.lead_ids && m.lead_ids[0]?.name),
                candidateName: m.candidate_id?.name || (m.candidate_ids && m.candidate_ids[0]?.name),
                attendees: (m.internal_attendees || []).map(u => u.name).filter(Boolean),
                createdByName: m.created_by?.name
            };
        });

        const sevenDaysAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        const todayMeetings = allFormattedMeetings.filter(m => {
            const dt = new Date(m.dateTime);
            return dt >= startOfToday && dt < endOfToday;
        });

        const sevenDaysMeetings = allFormattedMeetings.filter(m => {
            const dt = new Date(m.dateTime);
            return (dt >= startOfWeek && dt <= endOfWeek) || (dt >= startOfToday && dt <= sevenDaysAhead);
        });

        const thirtyDaysMeetings = allFormattedMeetings.filter(m => {
            const dt = new Date(m.dateTime);
            return dt >= startOfToday && dt <= thirtyDaysAhead;
        });

        const meetingsWidget = {
            today: todayMeetings,
            "7d": sevenDaysMeetings,
            "30d": thirtyDaysMeetings,
            all: allFormattedMeetings
        };

        // ─────────────────────────────────────────────────────────────────────
        // Format Widget 10: Email Campaign Activity (Admin Only)
        // ─────────────────────────────────────────────────────────────────────
        let emailCampaignActivity = null;
        if (isAdmin && emailCampaignsRaw) {
            emailCampaignActivity = (emailCampaignsRaw || []).map(c => {
                let delivered = 0;
                let opens = 0;
                let clicks = 0;
                let sent = 0;

                if (Array.isArray(c.recipientLogs) && c.recipientLogs.length > 0) {
                    const logs = c.recipientLogs;
                    sent = logs.length;
                    const bounces = logs.filter(l =>
                        ['bounce', 'bounced', 'blocked', 'failed'].includes(l.status) ||
                        (l.error && (l.error.includes('550') || l.error.includes('5.1.1') || String(l.error).toLowerCase().includes('does not exist')))
                    ).length;
                    delivered = Math.max(0, sent - bounces);
                    opens = logs.filter(l => ['open', 'opened', 'click', 'clicked', 'unsubscribe', 'unsubscribed'].includes(l.status)).length;
                    clicks = logs.filter(l => ['click', 'clicked', 'unsubscribe', 'unsubscribed'].includes(l.status)).length;
                } else {
                    sent = c.stats?.sent || 0;
                    const bounces = c.stats?.bounces || 0;
                    delivered = c.stats?.delivered || Math.max(0, sent - bounces) || (c.status === 'sent' ? sent : 0);
                    opens = c.stats?.opens || 0;
                    clicks = c.stats?.clicks || 0;
                }

                const openRate = delivered > 0 ? Math.round((opens / delivered) * 100) : 0;
                const clickRate = delivered > 0 ? Math.round((clicks / delivered) * 100) : 0;

                return {
                    _id: c._id,
                    title: c.title,
                    subject: c.subject,
                    status: c.status,
                    sentAt: c.sentAt || c.createdAt,
                    sentCount: sent,
                    deliveredCount: delivered,
                    delivered,
                    opensCount: opens,
                    opens,
                    clicksCount: clicks,
                    clicks,
                    openRate,
                    clickRate
                };
            });
        }

        res.json({
            success: true,
            userRole: req.currentUserRole,
            widgets: {
                // Priority 1 — Highest
                hotLeads: combinedHotLeads,
                // Priority 2
                stalledLeads: {
                    counts: {
                        total: stalledTotal,
                        hot: stalledHot,
                        warm: stalledWarm,
                        cold: stalledCold,
                        ea: (stalledEAs || []).length,
                        crm: (stalledCRMs || []).length
                    },
                    leads: formattedStalled
                },
                // Priority 3
                unreadSms: {
                    totalCount: totalUnreadSmsCount,
                    messages: unreadSmsList
                },
                // Priority 4
                followupsToday: {
                    overdueCount: overdueFollowups.length,
                    dueTodayCount: dueTodayFollowups.length,
                    items: dueTodayFollowups,
                    overdueItems: overdueFollowups
                },
                // Priority 5
                aiSuggestions: aiSuggestions,
                // Priority 6
                newEaLeadsToday: newEaLeadsWidget,
                // Priority 7
                leadScoreBreakdown: scoreBreakdown,
                // Priority 8 (Admin/Manager only)
                retellCallSummary: retellCallSummary,
                // Priority 9
                meetingsThisWeek: sevenDaysMeetings,
                meetings: meetingsWidget,
                // Priority 10 (Admin/Manager only)
                emailCampaignActivity: emailCampaignActivity
            }
        });

    } catch (err) {
        next(err);
    }
};
