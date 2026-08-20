import cron from 'node-cron';
import mongoose from 'mongoose';
import Followup from '../models/followup.model.js';
import Task from '../models/tasks.model.js';
import { User } from '../models/user.model.js';
import Notification from '../models/notification.model.js';
import { sendDailySummaryEmail, sendReminderEmail } from '../services/email/mailer.js';
import { invalidatedUsers } from './sessionCache.js';
import EmailCampaign from '../models/emailCampaign.model.js';
import { resolveSegmentRecipients } from '../controllers/segments.controller.js';
import { dispatchCampaignInBackground } from '../controllers/campaigns.controller.js';

export const initCronJobs = () => {

    // ── 1. Morning daily summary — 8:00 AM EST ────────────────────────────────
    cron.schedule('0 8 * * *', async () => {
        console.log('Running morning follow-up summary (8:00 AM EST)...');
        
        // Clean up user invalidation map entries older than 7 days (JWT lifespan)
        try {
            const nowTime = Date.now();
            const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
            let deletedCount = 0;
            for (const [userId, changeTime] of invalidatedUsers.entries()) {
                if (nowTime - changeTime > SEVEN_DAYS_MS) {
                    invalidatedUsers.delete(userId);
                    deletedCount++;
                }
            }
            if (deletedCount > 0) {
                console.log(`[Cron Cache Cleanup] Purged ${deletedCount} expired invalidation records from memory.`);
            }
        } catch (err) {
            console.error('Error running cache cleanup inside morning summary cron:', err);
        }

        try {
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const endOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

            const followups = await Followup.find({
                status:    'pending',
                date_time: { $gte: startOfDay, $lt: endOfDay }
            }).populate('lead_id');

            const overdueFollowups = await Followup.find({
                status:    'pending',
                date_time: { $lt: startOfDay }
            }).populate('lead_id');

            if (followups.length === 0 && overdueFollowups.length === 0) {
                console.log('No pending follow-ups or overdue tasks today. Skipping daily summary email.');
                return;
            }

            const adminEmail = process.env.ADMIN_EMAIL || 'chiragsoftiatric@gmail.com';
            sendDailySummaryEmail({ followups, overdueFollowups, to: adminEmail });
            console.log('Morning summary background task dispatched successfully.');
        } catch (err) {
            console.error('Error running morning summary cron:', err);
        }
    }, {
        scheduled: true,
        timezone: 'America/New_York'
    });

    // ── 2. 30-minute reminder — runs every minute ─────────────────────────────
    cron.schedule('* * * * *', async () => {
        const now  = new Date();
        const in30 = new Date(now.getTime() + 30 * 60 * 1000);

        console.log(`[Reminder Cron] Tick at ${now.toISOString()} | Window until ${in30.toISOString()}`);

        // ─── Tasks ─────────────────────────────────────────────────────────────
        try {
            const dueTasks = await Task.find({
                status:       'pending',
                reminderSent: { $ne: true },  // ✅ catches false AND missing field (pre-migration docs)
                dueDate:      { $lte: in30, $gt: now }
            }).populate('assignedTo');

            console.log(`[Reminder Cron] Tasks due soon: ${dueTasks.length}`);

            for (const task of dueTasks) {
                const user = task.assignedTo;

                if (user) {
                    await Notification.create({
                        userId:  user._id,
                        type:    'task_reminder',
                        title:   '⏰ Task Due Soon',
                        message: `"${task.title}" is due in ~30 minutes`,
                        link:    '/tasks',
                    });

                    if (user.email) {
                        sendReminderEmail({
                            to: user.email, userName: user.name,
                            title: task.title, type: 'Task', dueAt: task.dueDate,
                        });
                    }
                    console.log(`[Reminder Cron] Task "${task.title}" → notified ${user.email}`);
                } else {
                    console.log(`[Reminder Cron] Task "${task.title}" has no assignee — skipped.`);
                }

                task.reminderSent = true;
                await task.save();
            }
        } catch (err) {
            console.error('[Reminder Cron] Task error:', err.message);
        }

        // ─── Follow-ups ────────────────────────────────────────────────────────
        try {
            const dueFollowups = await Followup.find({
                status:       'pending',
                reminderSent: { $ne: true },  // ✅ catches false AND missing field
                date_time:    { $lte: in30, $gt: now }
            }).populate('created_by').populate('lead_id');        // Needed to resolve 'self' assignments and fallback

            console.log(`[Reminder Cron] Follow-ups due soon: ${dueFollowups.length}`);

            for (const fu of dueFollowups) {
                let user = null;

                const av = fu.assigned_user;

                if (!av || av === 'self') {
                    // ── Case 1: 'self' or empty → use whoever created the follow-up
                    user = fu.created_by;
                    if (!user && fu.lead_id && fu.lead_id.assigned_to) {
                        user = await User.findById(fu.lead_id.assigned_to);
                        console.log(`[Reminder Cron] Creator is null, fallback to lead assignee: ${user?.email}`);
                    } else {
                        console.log(`[Reminder Cron] assigned_user="${av}" → resolving to creator: ${user?.email}`);
                    }
                } else {
                    // ── Case 2: stored as name, username, email, or _id string
                    const queryConditions = [
                        { username: av },
                        { email:    av },
                        { name:     av }
                    ];
                    if (mongoose.Types.ObjectId.isValid(av)) {
                        queryConditions.push({ _id: av });
                    }
                    user = await User.findOne({ $or: queryConditions });
                    console.log(`[Reminder Cron] assigned_user="${av}" → found user: ${user?.email || 'NOT FOUND'}`);
                }


                if (user) {
                    await Notification.create({
                        userId:  user._id,
                        type:    'followup_reminder',
                        title:   '⏰ Follow-up Due Soon',
                        message: `"${fu.title || fu.type}" is due in ~30 minutes`,
                        link:    '/followups',
                    });

                    if (user.email) {
                        sendReminderEmail({
                            to: user.email, userName: user.name,
                            title: fu.title || fu.type, type: fu.type, dueAt: fu.date_time,
                        });
                    }
                    console.log(`[Reminder Cron] Follow-up "${fu.title || fu.type}" → notified ${user.email}`);
                } else {
                    console.warn(`[Reminder Cron] Could not resolve a user for follow-up ${fu._id} (assigned_user="${fu.assigned_user}")`);
                }

                fu.reminderSent = true;
                await fu.save();
            }
        } catch (err) {
            console.error('[Reminder Cron] Follow-up error:', err.message);
        }
    });

    // ── 3. Scheduled Campaign Sender — runs every minute ──────────────────────
    cron.schedule('* * * * *', async () => {
        try {
            const now = new Date();
            const pendingCampaigns = await EmailCampaign.find({
                status: 'scheduled',
                sendAt: { $lte: now }
            }).populate('segmentId');

            if (pendingCampaigns.length > 0) {
                console.log(`[Campaign Cron] Found ${pendingCampaigns.length} scheduled campaigns due for delivery.`);
            }

            for (const campaign of pendingCampaigns) {
                campaign.status = 'sending';
                campaign.sentAt = new Date();
                await campaign.save();

                // For standard campaigns, resolve segment recipients; for AI campaigns, recipientLogs are used
                const recipients = campaign.isAiPersonalized 
                    ? [] 
                    : await resolveSegmentRecipients(campaign.segmentId);
                
                // Dispatch in background
                dispatchCampaignInBackground(campaign, recipients);
            }
        } catch (err) {
            console.error('[Campaign Cron] Error dispatching scheduled campaigns:', err.message);
        }
    });

    console.log('✅ Cron jobs initialized: Daily summary (8AM EST) + 30-min reminders (every minute) + campaign sender (every minute).');
};
