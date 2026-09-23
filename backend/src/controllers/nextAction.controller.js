import Lead from '../models/lead.model.js';
import EALead from '../models/eaLead.model.js';
import Task from '../models/tasks.model.js';
import Followup from '../models/followup.model.js';
import Note from '../models/note.model.js';
import User from '../models/user.model.js';
import aiService from '../services/ai/ai.service.js';
import { deriveScoreFromStatus } from '../services/ai/nextAction.service.js';

/**
 * Dismiss AI next action suggestion from lead card.
 */
export const dismissNextAction = async (req, res, next) => {
    try {
        const { id } = req.params;
        const leadType = req.body.leadType || req.query.leadType || 'lead';
        const cancelTask = req.body.cancelTask !== false; // Default true: cancel auto-task if pending

        let lead;
        if (leadType === 'ea_lead') {
            lead = await EALead.findById(id);
        } else {
            lead = await Lead.findById(id);
        }

        if (!lead) {
            return res.status(404).json({ error: 'Lead not found.' });
        }

        const taskId = lead.aiNextAction?.taskId;
        if (cancelTask && taskId) {
            try {
                // If the auto-created task is still pending, soft-delete it so it doesn't linger
                await Task.findOneAndUpdate(
                    { _id: taskId, status: 'pending' },
                    {
                        isDeleted: true,
                        deletedBy: req.user?.id || null,
                        deletedAt: new Date()
                    }
                );
            } catch (taskErr) {
                console.warn('[AI Next Action] Could not cancel task on dismiss:', taskErr.message);
            }
        }

        if (lead.aiNextAction) {
            lead.aiNextAction.status = 'dismissed';
            lead.aiNextAction.dismissedAt = new Date();
        }

        await lead.save();

        const io = req.app.get('io');
        if (io) {
            const eventName = leadType === 'ea_lead' ? 'ea_lead:next_action_updated' : 'lead:next_action_updated';
            io.emit(eventName, {
                leadId: lead._id.toString(),
                leadType,
                aiNextAction: lead.aiNextAction,
                aiScore: lead.aiScore
            });
        }

        res.json({ success: true, message: 'Suggestion dismissed.', lead });
    } catch (err) {
        next(err);
    }
};

/**
 * Accept AI next action suggestion (creates a task if one does not exist, e.g. for Cold leads).
 */
export const acceptNextAction = async (req, res, next) => {
    try {
        const { id } = req.params;
        const leadType = req.body.leadType || req.query.leadType || 'lead';

        let lead;
        if (leadType === 'ea_lead') {
            lead = await EALead.findById(id);
        } else {
            lead = await Lead.findById(id);
        }

        if (!lead || !lead.aiNextAction?.action) {
            return res.status(404).json({ error: 'Lead or active suggestion not found.' });
        }

        let task = null;
        let taskId = lead.aiNextAction.taskId;

        // If no task exists (e.g. for Cold leads), create it now
        if (!taskId) {
            const dueDate = lead.aiNextAction.recommendedDueDate || new Date(Date.now() + 24 * 60 * 60 * 1000);
            task = await Task.create({
                title: lead.aiNextAction.action,
                description: `${lead.aiNextAction.reason || ''}\n\n[Accepted by ${req.user?.name || 'Rep'} from AI suggestion]`,
                status: 'pending',
                priority: lead.aiNextAction.priority || 'medium',
                dueDate,
                assignedTo: lead.assigned_to || req.user?.id || null,
                createdBy: req.user?.id || null,
                lead_id: leadType === 'lead' ? lead._id : null,
                ea_lead_id: leadType === 'ea_lead' ? lead._id : null,
                isAiGenerated: true,
                aiActionReason: lead.aiNextAction.reason
            });
            taskId = task._id;
        } else {
            task = await Task.findById(taskId);
        }

        lead.aiNextAction.status = 'accepted';
        lead.aiNextAction.taskId = taskId;
        await lead.save();

        const io = req.app.get('io');
        if (io) {
            const eventName = leadType === 'ea_lead' ? 'ea_lead:next_action_updated' : 'lead:next_action_updated';
            io.emit(eventName, {
                leadId: lead._id.toString(),
                leadType,
                aiNextAction: lead.aiNextAction,
                aiScore: lead.aiScore
            });
        }

        res.json({ success: true, message: 'Suggestion accepted and task confirmed.', lead, task });
    } catch (err) {
        next(err);
    }
};

/**
 * Edit AI next action suggestion details and update the linked task if present.
 */
export const editNextAction = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { action, reason, dueDate, priority, leadType = 'lead' } = req.body;

        let lead;
        if (leadType === 'ea_lead') {
            lead = await EALead.findById(id);
        } else {
            lead = await Lead.findById(id);
        }

        if (!lead || !lead.aiNextAction) {
            return res.status(404).json({ error: 'Lead or suggestion not found.' });
        }

        if (action) lead.aiNextAction.action = action.trim();
        if (reason !== undefined) lead.aiNextAction.reason = reason.trim();
        if (dueDate) lead.aiNextAction.recommendedDueDate = new Date(dueDate);
        if (priority) lead.aiNextAction.priority = priority;
        lead.aiNextAction.status = 'edited';

        // Also update linked Task if exists
        if (lead.aiNextAction.taskId) {
            const existingTask = await Task.findById(lead.aiNextAction.taskId);
            if (existingTask) {
                const updateFields = {};
                if (action) updateFields.title = action.trim();
                if (reason !== undefined) {
                    let newDescription = reason.trim();
                    if (existingTask.description) {
                        const tagMatches = existingTask.description.match(/(\n\n\[(?:Converted to Follow-up|Accepted by|AI Task|AI Auto-Created Task)[^\]]*\])+$/);
                        if (tagMatches) {
                            newDescription = `${reason.trim()}${tagMatches[0]}`;
                        }
                    }
                    updateFields.description = newDescription;
                    updateFields.aiActionReason = reason.trim();
                }
                if (dueDate) updateFields.dueDate = new Date(dueDate);
                if (priority) updateFields.priority = priority;

                await Task.findByIdAndUpdate(lead.aiNextAction.taskId, updateFields, { returnDocument: 'after' });
            }
        }

        // Also update linked Followup if exists
        if (lead.aiNextAction.followupId) {
            const fuFields = {};
            if (action) fuFields.title = action.trim();
            if (reason !== undefined) fuFields.notes = reason.trim();
            if (dueDate) fuFields.date_time = new Date(dueDate);
            if (priority) {
                const rawPriority = priority.toLowerCase();
                fuFields.priority = rawPriority === 'high' ? 'High' : rawPriority === 'low' ? 'Low' : 'Medium';
            }
            await Followup.findByIdAndUpdate(lead.aiNextAction.followupId, fuFields, { returnDocument: 'after' });
        }

        await lead.save();

        const io = req.app.get('io');
        if (io) {
            const eventName = leadType === 'ea_lead' ? 'ea_lead:next_action_updated' : 'lead:next_action_updated';
            io.emit(eventName, {
                leadId: lead._id.toString(),
                leadType,
                aiNextAction: lead.aiNextAction,
                aiScore: lead.aiScore
            });
        }

        res.json({ success: true, message: 'Suggestion updated.', lead });
    } catch (err) {
        next(err);
    }
};

/**
 * Convert AI Next Action to a formal CRM Follow-up.
 * Automatically assigns to the assigned team member (if lead is assigned).
 * Follows default CRM visibility rules:
 * - Assigned team member sees this in /followups.
 * - Other sales reps cannot see it.
 * - Admins can see all follow-ups across the system.
 */
export const convertToFollowup = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { leadType = 'lead', title, date_time, type, priority, notes } = req.body;

        let lead;
        if (leadType === 'ea_lead') {
            lead = await EALead.findById(id).populate('assigned_to');
        } else {
            lead = await Lead.findById(id).populate('assigned_to');
        }

        if (!lead || !lead.aiNextAction?.action) {
            return res.status(404).json({ error: 'Lead or active suggestion not found.' });
        }

        // Determine assigned user for the Followup:
        // Default behavior: If lead is assigned to a team member, follow-up goes to that team member.
        let assignedUserName = null;
        if (lead.assigned_to) {
            if (typeof lead.assigned_to === 'object') {
                assignedUserName = lead.assigned_to.name || lead.assigned_to.username || lead.assigned_to.email || lead.assigned_to._id.toString();
            } else {
                const assignedUserDoc = await User.findById(lead.assigned_to).select('name username email');
                if (assignedUserDoc) {
                    assignedUserName = assignedUserDoc.name || assignedUserDoc.username || assignedUserDoc.email || assignedUserDoc._id.toString();
                }
            }
        }

        // Determine Follow-up type: 'Call' | 'Email' | 'Meeting' | 'Task'
        let followupType = type || 'Task';
        if (!type) {
            const actLower = (lead.aiNextAction.action || '').toLowerCase();
            if (actLower.startsWith('call') || actLower.includes('phone') || actLower.includes('dial')) {
                followupType = 'Call';
            } else if (actLower.startsWith('email') || actLower.includes('send email')) {
                followupType = 'Email';
            } else if (actLower.includes('meet') || actLower.includes('schedule demo')) {
                followupType = 'Meeting';
            }
        }

        // Format priority: Low, Medium, High
        const rawPriority = (priority || lead.aiNextAction.priority || 'medium').toLowerCase();
        const formattedPriority = rawPriority === 'high' ? 'High' : rawPriority === 'low' ? 'Low' : 'Medium';

        // Target Date & Time
        const scheduledDate = date_time 
            ? new Date(date_time) 
            : (lead.aiNextAction.recommendedDueDate || new Date(Date.now() + 24 * 60 * 60 * 1000));

        const followupTitle = (title || lead.aiNextAction.action || '').trim();
        const followupNotes = (notes || lead.aiNextAction.reason || '').trim();

        const isTaskTarget = type && type.toLowerCase() === 'task';

        let createdItem = null;
        let itemTarget = 'followup';

        if (isTaskTarget) {
            // --- TARGET 1: CRM Task (/tasks) ---
            itemTarget = 'task';
            const assignedToId = lead.assigned_to?._id || (typeof lead.assigned_to === 'string' ? lead.assigned_to : null) || req.user?.id || null;

            if (lead.aiNextAction.taskId) {
                createdItem = await Task.findByIdAndUpdate(lead.aiNextAction.taskId, {
                    title: followupTitle,
                    description: followupNotes,
                    dueDate: scheduledDate,
                    priority: rawPriority,
                    status: 'pending',
                    isDeleted: false,
                    deletedBy: null,
                    deletedAt: null,
                    assignedTo: assignedToId
                }, { returnDocument: 'after' });
            }

            if (!createdItem) {
                createdItem = await Task.create({
                    title: followupTitle,
                    description: followupNotes,
                    dueDate: scheduledDate,
                    priority: rawPriority,
                    status: 'pending',
                    isDeleted: false,
                    assignedTo: assignedToId,
                    createdBy: req.user?.id || null,
                    lead_id: leadType === 'lead' ? lead._id : null,
                    ea_lead_id: leadType === 'ea_lead' ? lead._id : null
                });
            }

            // Log to Activity Feed
            if (leadType === 'lead') {
                await Note.create({
                    lead_id: lead._id,
                    type: 'note',
                    content: `Created Task from Claude AI Next Action: ${followupTitle}\nDue: ${scheduledDate.toLocaleString()}${assignedUserName ? `\nAssigned to: ${assignedUserName}` : ''}${followupNotes ? `\nNotes: ${followupNotes}` : ''}`,
                    metadata: {
                        task_id: createdItem._id,
                        date_time: scheduledDate,
                        type: 'Task',
                        notes: followupNotes,
                        assigned_user: assignedUserName
                    }
                });
            }
        } else {
            // --- TARGET 2: CRM Follow-up (/followups) ---
            itemTarget = 'followup';
            const validFollowupType = ['Call', 'Email', 'Meeting', 'Task'].includes(followupType) ? followupType : 'Task';

            createdItem = await Followup.create({
                lead_id: leadType === 'lead' ? lead._id : null,
                ea_lead_id: leadType === 'ea_lead' ? lead._id : null,
                title: followupTitle,
                date_time: scheduledDate,
                type: validFollowupType,
                notes: followupNotes,
                assigned_user: assignedUserName,
                priority: formattedPriority,
                status: 'pending',
                created_by: req.user?.id || null
            });

            // Log to Activity Feed
            if (leadType === 'lead') {
                await Note.create({
                    lead_id: lead._id,
                    type: 'note',
                    content: `Scheduled Follow-up (${validFollowupType}) from Claude AI Next Action: ${followupTitle}\nDue: ${scheduledDate.toLocaleString()}${assignedUserName ? `\nAssigned to: ${assignedUserName}` : ''}${followupNotes ? `\nNotes: ${followupNotes}` : ''}`,
                    metadata: {
                        followup_id: createdItem._id,
                        date_time: scheduledDate,
                        type: validFollowupType,
                        notes: followupNotes,
                        assigned_user: assignedUserName
                    }
                });
            }

            // If an automated Task exists, retire it so it does not linger in pending or completed tasks
            if (lead.aiNextAction.taskId) {
                try {
                    await Task.findByIdAndUpdate(lead.aiNextAction.taskId, {
                        status: 'completed',
                        isDeleted: true,
                        deletedBy: req.user?.id || null,
                        deletedAt: new Date(),
                        description: `${lead.aiNextAction.reason || ''}\n\n[Converted to Follow-up #${createdItem._id}]`
                    }, { returnDocument: 'after' });
                } catch (taskErr) {
                    console.warn('[Convert Followup] Task update skipped:', taskErr.message);
                }
            }
        }

        // Reset AI Next Action on Lead back to default empty state
        lead.aiNextAction = {
            action: null,
            reason: null,
            priority: 'medium',
            recommendedDueDate: null,
            status: null,
            suggestedAt: null,
            dismissedAt: null,
            taskId: null,
            followupId: null,
            activityTrigger: {
                activityType: null,
                activityId: null,
                summary: null
            }
        };
        await lead.save();

        // Broadcast real-time Socket.IO events
        const io = req.app.get('io');
        if (io) {
            const eventName = leadType === 'ea_lead' ? 'ea_lead:next_action_updated' : 'lead:next_action_updated';
            io.emit(eventName, {
                leadId: lead._id.toString(),
                leadType,
                aiNextAction: lead.aiNextAction,
                aiScore: lead.aiScore
            });
            if (isTaskTarget) {
                io.emit('task:created', {
                    taskId: createdItem._id.toString(),
                    leadId: lead._id.toString()
                });
            } else {
                io.emit('followup:created', {
                    followupId: createdItem._id.toString(),
                    leadId: lead._id.toString(),
                    assigned_user: assignedUserName
                });
            }
        }

        const destinationName = isTaskTarget ? 'Task (/tasks)' : 'Follow-up (/followups)';
        res.json({
            success: true,
            target: itemTarget,
            message: `Converted to ${destinationName}${assignedUserName ? ` assigned to ${assignedUserName}` : ''}.`,
            lead,
            item: createdItem,
            assignedUser: assignedUserName
        });
    } catch (err) {
        next(err);
    }
};

/**
 * On-demand AI Next Action generation: evaluates recent activity feed and calls Claude AI.
 */
export const generateNextActionOnDemand = async (req, res, next) => {
    try {
        const { id } = req.params;
        const leadType = req.body.leadType || req.query.leadType || 'lead';
        const userId = req.user?.id || null;

        let lead;
        let score = 'Cold';
        let recentHistory = [];

        if (leadType === 'ea_lead') {
            lead = await EALead.findById(id);
            if (!lead) {
                return res.status(404).json({ error: 'Lead not found.' });
            }
            score = lead.aiScore || 'Cold';

            const recentSms = (lead.smsHistory || []).slice(-8).map(m => ({
                type: 'sms',
                date: m.timestamp,
                content: `[${m.direction === 'inbound' ? 'CLIENT' : 'YAU'}]: ${m.message}`
            }));

            const recentCalls = (lead.callHistory || []).slice(-4).map(c => ({
                type: 'call',
                date: c.timestamp,
                content: `Call (${c.direction}): ${c.aiSummary || c.transcript || c.status || 'Call logged'}`
            }));

            recentHistory = [...recentSms, ...recentCalls].sort((a, b) => new Date(a.date) - new Date(b.date));
        } else {
            lead = await Lead.findById(id);
            if (!lead) {
                return res.status(404).json({ error: 'Lead not found.' });
            }
            score = lead.aiScore || deriveScoreFromStatus(lead.status);

            const recentNotes = await Note.find({ lead_id: id })
                .sort({ createdAt: -1 })
                .limit(8)
                .lean();

            const recentCalls = (lead.callHistory || []).slice(-4).map(c => ({
                type: 'call',
                date: c.timestamp,
                content: `Call (${c.direction}): ${c.aiSummary || c.transcript || c.status || 'Call logged'}`
            }));

            const formattedNotes = recentNotes.map(n => ({
                type: n.type || 'note',
                date: n.createdAt,
                content: n.content
            }));

            recentHistory = [...formattedNotes, ...recentCalls].sort((a, b) => new Date(a.date) - new Date(b.date));
        }

        const triggerSummary = 'Rep requested AI next action evaluation based on activity feed';
        const suggestion = await aiService.generateNextActionSuggestion({
            leadName: lead.name,
            leadType,
            score,
            status: lead.status || 'Active',
            triggerActivity: {
                type: 'manual_generate',
                summary: triggerSummary
            },
            recentHistory
        });

        const daysOffset = typeof suggestion.recommendedDaysOffset === 'number' ? suggestion.recommendedDaysOffset : 1;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + daysOffset);
        dueDate.setHours(17, 0, 0, 0);

        let autoTaskId = null;
        if (score === 'Hot' || score === 'Warm') {
            try {
                const task = await Task.create({
                    title: suggestion.action,
                    description: `${suggestion.reason}\n\n[AI Task for ${lead.name} generated on demand]`,
                    status: 'pending',
                    priority: suggestion.priority || (score === 'Hot' ? 'high' : 'medium'),
                    dueDate,
                    assignedTo: lead.assigned_to || userId,
                    createdBy: userId,
                    lead_id: leadType === 'lead' ? lead._id : null,
                    ea_lead_id: leadType === 'ea_lead' ? lead._id : null,
                    isAiGenerated: true,
                    aiActionReason: suggestion.reason
                });
                autoTaskId = task._id;
            } catch (taskErr) {
                console.error('[AI Next Action OnDemand] Error creating task:', taskErr.message);
            }
        }

        lead.aiNextAction = {
            action: suggestion.action,
            reason: suggestion.reason,
            priority: suggestion.priority || (score === 'Hot' ? 'high' : 'medium'),
            recommendedDueDate: dueDate,
            status: 'active',
            suggestedAt: new Date(),
            dismissedAt: null,
            taskId: autoTaskId,
            followupId: null,
            activityTrigger: {
                activityType: 'manual_generate',
                activityId: null,
                summary: triggerSummary
            }
        };

        await lead.save();

        const io = req.app.get('io');
        if (io) {
            const eventName = leadType === 'ea_lead' ? 'ea_lead:next_action_updated' : 'lead:next_action_updated';
            io.emit(eventName, {
                leadId: lead._id.toString(),
                leadType,
                aiNextAction: lead.aiNextAction,
                aiScore: lead.aiScore
            });
            if (autoTaskId) {
                io.emit('task:created', {
                    taskId: autoTaskId.toString(),
                    leadId: lead._id.toString()
                });
            }
        }

        res.json({
            success: true,
            message: 'Claude AI next action generated successfully.',
            lead,
            aiNextAction: lead.aiNextAction
        });
    } catch (err) {
        next(err);
    }
};

export default {
    dismissNextAction,
    acceptNextAction,
    editNextAction,
    convertToFollowup,
    generateNextActionOnDemand
};
