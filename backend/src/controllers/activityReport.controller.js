import ReportActivity, { ActivityReport } from '../models/activityReport.model.js';
import ReportDraft from '../models/reportDraft.model.js';
import User from '../models/user.model.js';
import Notification from '../models/notification.model.js';
import aiService from '../services/ai/ai.service.js';
import { sendActivityReportAdminNotification } from '../services/email/mailer.js';

// In-memory registry to guarantee single-run execution per report ID
const activeEvaluations = new Set();

/**
 * Executes Claude AI evaluation for a single activity report in the background.
 * Strictly guarantees single-execution: cannot loop, re-trigger, or execute concurrently.
 */
export const triggerSingleReportEvaluation = async ({ reportId, app, user }) => {
    if (!reportId) return;

    const reportIdStr = reportId.toString();

    // 1. In-memory single-run check
    if (activeEvaluations.has(reportIdStr)) {
        console.warn(`[Activity Report AI] Report ${reportIdStr} is already being evaluated. Skipping duplicate trigger.`);
        return;
    }
    activeEvaluations.add(reportIdStr);

    try {
        // 2. Atomic MongoDB transition from 'pending' to 'evaluating'
        // If it is already 'evaluating', 'completed', or 'failed', findOneAndUpdate returns null.
        const report = await ReportActivity.findOneAndUpdate(
            { _id: reportId, aiStatus: 'pending' },
            { aiStatus: 'evaluating' },
            { new: true }
        );

        if (!report) {
            console.warn(`[Activity Report AI] Report ${reportIdStr} not eligible for evaluation (status not 'pending'). Aborting.`);
            return;
        }

        console.log(`[Activity Report AI] Starting single-run evaluation for report ${reportIdStr} (${report.reportType})`);

        // 3. Run Claude AI evaluation ONCE
        let aiFeedback = {
            goingWell: '',
            patternsOrRedFlags: '',
            recommendations: [],
            performanceScore: null,
            scoreSummary: '',
            rawResponse: ''
        };
        let aiStatus = 'completed';
        let aiError = null;

        try {
            aiFeedback = await aiService.generateActivityReportFeedback({
                repName: report.userName,
                reportType: report.reportType,
                reportContent: report.rawContent
            });
        } catch (err) {
            console.error('[Activity Report AI] Claude evaluation failed:', err.message);
            aiStatus = 'failed';
            aiError = err.message;
            aiFeedback.scoreSummary = 'AI evaluation unavailable.';
        }

        // 4. Save results atomically in MongoDB
        const updatedReport = await ReportActivity.findByIdAndUpdate(
            reportId,
            {
                aiFeedback,
                aiStatus,
                aiError
            },
            { new: true }
        );

        // 5. Admin & Manager Notification Dispatch
        const typeLabel = report.reportType === 'weekly' ? 'Weekly' : 'Daily';
        const scoreText = aiFeedback.performanceScore != null ? ` (Score: ${aiFeedback.performanceScore}/10)` : '';

        try {
            const adminUsers = await User.find({ role: 'admin', isActive: true }, '_id');
            const notifyTargets = new Set(adminUsers.map(u => u._id.toString()));

            if (report.managerId) {
                notifyTargets.add(report.managerId.toString());
            }

            // Exclude the submitting user
            notifyTargets.delete(report.userId.toString());

            const notifications = Array.from(notifyTargets).map(targetId => ({
                userId: targetId,
                type: 'system',
                title: `New ${typeLabel} Report — ${report.userName}`,
                message: `${report.userName} submitted a ${typeLabel} activity report${scoreText}.`,
                link: `/reports?reportId=${report._id}`,
                isRead: false
            }));

            if (notifications.length > 0) {
                await Notification.insertMany(notifications);
            }
        } catch (notifErr) {
            console.error('[Activity Report AI] Failed to create in-app notifications:', notifErr.message);
        }

        // 6. Fire-and-forget email alert
        sendActivityReportAdminNotification({
            repName: report.userName,
            repEmail: user?.email || user?.username || '',
            reportType: report.reportType,
            submissionDate: report.submissionDate,
            rawContent: report.rawContent,
            aiFeedback,
            reportId: report._id
        }).catch(err => console.error('[Activity Report Mailer] Error:', err.message));

        // 7. Real-time Socket.IO broadcast of evaluated report
        const io = app?.get('io');
        if (io) {
            io.emit('activity_report:evaluated', {
                reportId: updatedReport._id,
                report: updatedReport
            });
        }

        console.log(`[Activity Report AI] Report ${reportIdStr} evaluated successfully (Status: ${aiStatus}, Score: ${aiFeedback.performanceScore ?? 'N/A'}).`);
    } catch (criticalErr) {
        console.error(`[Activity Report AI] Critical evaluation worker error on report ${reportIdStr}:`, criticalErr.message);
        try {
            await ReportActivity.findByIdAndUpdate(reportId, {
                aiStatus: 'failed',
                aiError: criticalErr.message
            });
            const io = app?.get('io');
            if (io) {
                io.emit('activity_report:evaluated', {
                    reportId,
                    report: { _id: reportId, aiStatus: 'failed', aiError: criticalErr.message }
                });
            }
        } catch (_) {}
    } finally {
        activeEvaluations.delete(reportIdStr);
    }
};

/**
 * POST /api/activity-reports
 * Submit a Daily or Weekly Activity Report.
 * Responds instantly (<100ms) with pending status and evaluates in background.
 */
export const submitReport = async (req, res, next) => {
    try {
        const { reportType, rawContent, submissionSource = 'web' } = req.body;

        if (!reportType || !['daily', 'weekly'].includes(reportType.toLowerCase())) {
            res.status(400);
            throw new Error('Report type must be either "daily" or "weekly".');
        }

        if (!rawContent || !rawContent.trim()) {
            res.status(400);
            throw new Error('Report content cannot be empty.');
        }

        const trimmedContent = rawContent.trim();
        const normalizedType = reportType.toLowerCase();

        // Get user details
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            res.status(401);
            throw new Error('Authentication required: user ID missing.');
        }
        const userName = req.user.name || req.user.username || req.user.email?.split('@')[0] || 'Team Member';
        const userRole = req.user.role || 'sales_rep';
        const managerId = req.user.managerId || null;

        // Create immutable report record with initial 'pending' status
        const report = await ReportActivity.create({
            userId,
            userName,
            userRole,
            managerId,
            reportType: normalizedType,
            submissionDate: new Date(),
            submissionSource,
            rawContent: trimmedContent,
            aiFeedback: {
                goingWell: '',
                patternsOrRedFlags: '',
                recommendations: [],
                performanceScore: null,
                scoreSummary: 'AI evaluation in progress...',
                rawResponse: ''
            },
            aiStatus: 'pending',
            aiError: null
        });

        // Clean up cloud draft for this user and reportType
        try {
            await ReportDraft.deleteMany({ userId, reportType: normalizedType });
        } catch (draftErr) {
            console.warn('[Activity Report Controller] Could not delete cloud draft on submit:', draftErr.message);
        }

        // Socket.IO broadcast for real-time dashboard updates (initial report creation)
        const io = req.app.get('io');
        if (io) {
            io.emit('activity_report:created', {
                reportId: report._id,
                userId: report.userId,
                userName: report.userName,
                userRole: report.userRole,
                reportType: report.reportType,
                submissionDate: report.submissionDate,
                aiStatus: 'pending',
                aiFeedback: report.aiFeedback
            });
        }

        const typeLabel = normalizedType === 'weekly' ? 'Weekly' : 'Daily';

        // 1. Respond immediately to the client (<100ms)
        res.status(201).json({
            success: true,
            message: `${typeLabel} report submitted. AI evaluation is processing in background.`,
            report
        });

        // 2. Fire single-run background AI evaluation (unawaited, isolated from response)
        triggerSingleReportEvaluation({
            reportId: report._id,
            app: req.app,
            user: req.user
        }).catch(bgErr => {
            console.error('[Activity Report Controller] Background evaluation error:', bgErr.message);
        });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/activity-reports
 * List activity reports based on Role-Based Privacy Rules:
 *  - Sales Reps: only see their own reports
 *  - Managers: see reports from reps they manage + their own
 *  - Admins: see all reports from all team members
 */
export const getReports = async (req, res, next) => {
    try {
        const currentUserId = req.user?.id || req.user?._id;
        const role = req.user?.role || 'sales_rep';
        const {
            reportType,
            userId,
            startDate,
            endDate,
            dateRange,
            minScore,
            maxScore,
            search,
            page = 1,
            limit = 20
        } = req.query;

        const query = {};

        // ── 1. Role-Based Privacy Enforcement ────────────────────────────
        if (role === 'admin') {
            // Admins can see all. If specific userId requested, filter by it.
            if (userId) query.userId = userId;
        } else if (role === 'manager') {
            // Managers can see their own reports AND all reports from all sales reps
            if (userId) {
                const targetUser = await User.findById(userId, 'role managerId');
                if (targetUser && (targetUser._id.toString() === currentUserId.toString() || targetUser.role === 'sales_rep' || targetUser.managerId?.toString() === currentUserId.toString())) {
                    query.userId = userId;
                } else {
                    query.userId = currentUserId; // fallback safely
                }
            } else {
                query.$or = [
                    { userId: currentUserId },
                    { userRole: 'sales_rep' },
                    { managerId: currentUserId }
                ];
            }
        } else {
            // Sales reps & view_only: STRICTLY their own reports only
            query.userId = currentUserId;
        }

        // ── 2. Filters ───────────────────────────────────────────────────
        if (reportType && ['daily', 'weekly'].includes(reportType.toLowerCase())) {
            query.reportType = reportType.toLowerCase();
        }

        if (startDate || endDate) {
            query.submissionDate = {};
            if (startDate) {
                const s = new Date(startDate);
                s.setHours(0, 0, 0, 0);
                query.submissionDate.$gte = s;
            }
            if (endDate) {
                const e = new Date(endDate);
                e.setHours(23, 59, 59, 999);
                query.submissionDate.$lte = e;
            }
        } else if (dateRange && dateRange !== 'all') {
            const now = new Date();
            query.submissionDate = {};
            if (dateRange === 'today') {
                const s = new Date(now);
                s.setHours(0, 0, 0, 0);
                query.submissionDate.$gte = s;
            } else if (dateRange === '7d') {
                const s = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                s.setHours(0, 0, 0, 0);
                query.submissionDate.$gte = s;
            } else if (dateRange === '14d') {
                const s = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
                s.setHours(0, 0, 0, 0);
                query.submissionDate.$gte = s;
            } else if (dateRange === '30d') {
                const s = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                s.setHours(0, 0, 0, 0);
                query.submissionDate.$gte = s;
            }
        }

        if (minScore != null || maxScore != null) {
            query['aiFeedback.performanceScore'] = {};
            if (minScore != null) query['aiFeedback.performanceScore'].$gte = parseFloat(minScore);
            if (maxScore != null) query['aiFeedback.performanceScore'].$lte = parseFloat(maxScore);
        }

        if (search && search.trim()) {
            const regex = new RegExp(search.trim(), 'i');
            query.$or = [
                { userName: regex },
                { rawContent: regex },
                { 'aiFeedback.goingWell': regex },
                { 'aiFeedback.patternsOrRedFlags': regex }
            ];
        }

        // ── 3. Pagination & Execution ────────────────────────────────────
        const pageNum = Math.max(1, parseInt(page, 10));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
        const skip = (pageNum - 1) * limitNum;

        const [reports, totalCount] = await Promise.all([
            ReportActivity.find(query)
                .sort({ submissionDate: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            ReportActivity.countDocuments(query)
        ]);

        // Calculate summary metrics for the current view
        const dailyCount = reports.filter(r => r.reportType === 'daily').length;
        const weeklyCount = reports.filter(r => r.reportType === 'weekly').length;
        const scoredReports = reports.filter(r => r.aiFeedback?.performanceScore != null);
        const averageScore = scoredReports.length > 0
            ? Math.round((scoredReports.reduce((acc, r) => acc + r.aiFeedback.performanceScore, 0) / scoredReports.length) * 10) / 10
            : null;

        res.json({
            success: true,
            reports,
            pagination: {
                total: totalCount,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(totalCount / limitNum) || 1
            },
            summary: {
                totalVisible: totalCount,
                dailyCount,
                weeklyCount,
                averageScore
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/activity-reports/:id
 * Retrieve a single report by ID, verifying privacy permissions.
 */
export const getReportById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const currentUserId = req.user?.id || req.user?._id;
        const role = req.user?.role || 'sales_rep';

        const report = await ReportActivity.findById(id).lean();
        if (!report) {
            res.status(404);
            throw new Error('Activity report not found.');
        }

        // Privacy check
        if (role !== 'admin') {
            const isOwn = report.userId.toString() === currentUserId.toString();
            if (!isOwn) {
                if (role === 'manager') {
                    // Managers can view any sales rep's report or reports from reps they manage
                    const isSalesRep = report.userRole === 'sales_rep';
                    const isManaged = report.managerId?.toString() === currentUserId.toString();
                    if (!isSalesRep && !isManaged) {
                        res.status(403);
                        throw new Error('Access denied: Managers can only view their own reports and sales rep reports.');
                    }
                } else {
                    res.status(403);
                    throw new Error('Access denied: You can only view your own reports.');
                }
            }
        }

        res.json({
            success: true,
            report
        });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/activity-reports/draft
 * Retrieve the current user's saved draft for a specific reportType (default: daily).
 */
export const getDraft = async (req, res, next) => {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            res.status(401);
            throw new Error('Authentication required: user ID missing.');
        }
        const reportType = (req.query.reportType || 'daily').toLowerCase();

        const draft = await ReportDraft.findOne({ userId, reportType }).lean();

        if (!draft || !draft.content || !draft.content.trim()) {
            return res.json({
                success: true,
                draft: null
            });
        }

        res.json({
            success: true,
            draft
        });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/activity-reports/draft
 * Save or update the current user's draft in MongoDB.
 */
export const saveDraft = async (req, res, next) => {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            res.status(401);
            throw new Error('Authentication required: user ID missing.');
        }
        const { reportType = 'daily', content = '' } = req.body;
        const normalizedType = reportType.toLowerCase();

        if (!['daily', 'weekly'].includes(normalizedType)) {
            res.status(400);
            throw new Error('Report type must be "daily" or "weekly".');
        }

        const draft = await ReportDraft.findOneAndUpdate(
            { userId, reportType: normalizedType },
            { content, updatedAt: new Date() },
            { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
        );

        res.json({
            success: true,
            message: 'Draft saved to cloud successfully.',
            draft: {
                reportType: draft.reportType,
                content: draft.content,
                updatedAt: draft.updatedAt
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * DELETE /api/activity-reports/draft
 * Clear the current user's draft in MongoDB.
 */
export const deleteDraft = async (req, res, next) => {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            res.status(401);
            throw new Error('Authentication required: user ID missing.');
        }
        const reportType = (req.query.reportType || req.body.reportType || 'daily').toLowerCase();

        await ReportDraft.deleteMany({ userId, reportType });

        res.json({
            success: true,
            message: 'Cloud draft cleared successfully.'
        });
    } catch (err) {
        next(err);
    }
};

