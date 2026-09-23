import Lead from '../../models/lead.model.js';
import EALead from '../../models/eaLead.model.js';
import Task from '../../models/tasks.model.js';
import Note from '../../models/note.model.js';
import aiService from './ai.service.js';

/**
 * Derives a score (Hot, Warm, Cold) for Main CRM Leads based on their pipeline status if aiScore is not set.
 */
export function deriveScoreFromStatus(status) {
    if (!status) return 'Cold';
    const hotStatuses = ['Meeting Scheduled', 'Proposal Sent', 'Interested', 'Program Confirmed'];
    const warmStatuses = ['Spoke to Front Office', 'Spoke to Decision Maker', 'Waiting on Reply', 'Follow-Up Needed'];
    if (hotStatuses.includes(status)) return 'Hot';
    if (warmStatuses.includes(status)) return 'Warm';
    return 'Cold';
}

/**
 * Triggers Claude Next Action evaluation asynchronously in the background.
 * Safe non-blocking execution: errors are logged and will not disrupt the calling controller.
 */
export async function triggerNextActionEvaluation({
    leadId,
    leadType = 'lead',
    activityType,
    activityData = {},
    userId = null,
    io = null
}) {
    if (!leadId) return;

    // Run completely in background without blocking the caller
    setImmediate(async () => {
        try {
            console.log(`[AI Next Action] 🎯 Evaluating next action for ${leadType} (${leadId}) after trigger: ${activityType}`);

            let lead;
            let score = 'Cold';
            let recentHistory = [];

            if (leadType === 'ea_lead') {
                lead = await EALead.findById(leadId);
                if (!lead) return;

                score = lead.aiScore || 'Cold';

                // Collect recent SMS & call history for context
                const recentSms = (lead.smsHistory || []).slice(-5).map(m => ({
                    type: 'sms',
                    date: m.timestamp,
                    content: `[${m.direction === 'inbound' ? 'CLIENT' : 'YAU'}]: ${m.message}`
                }));

                const recentCalls = (lead.callHistory || []).slice(-3).map(c => ({
                    type: 'call',
                    date: c.timestamp,
                    content: `Call (${c.direction}): ${c.aiSummary || c.transcript || c.status || 'Call logged'}`
                }));

                recentHistory = [...recentSms, ...recentCalls].sort((a, b) => new Date(a.date) - new Date(b.date));
            } else {
                lead = await Lead.findById(leadId);
                if (!lead) return;

                score = lead.aiScore || deriveScoreFromStatus(lead.status);

                // Collect recent notes & calls for context
                const recentNotes = await Note.find({ lead_id: leadId })
                    .sort({ createdAt: -1 })
                    .limit(6)
                    .lean();

                const recentCalls = (lead.callHistory || []).slice(-3).map(c => ({
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

            // Call Claude AI via aiService
            const triggerSummary = activityData.summary || activityData.content || `${activityType} activity logged`;
            const suggestion = await aiService.generateNextActionSuggestion({
                leadName: lead.name,
                leadType,
                score,
                status: lead.status || 'Active',
                triggerActivity: {
                    type: activityType,
                    summary: triggerSummary
                },
                recentHistory
            });

            // Calculate recommended due date
            const daysOffset = typeof suggestion.recommendedDaysOffset === 'number' ? suggestion.recommendedDaysOffset : 1;
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + daysOffset);
            dueDate.setHours(17, 0, 0, 0); // default to 5 PM EST

            let autoTaskId = null;

            // Auto-create task ONLY for Hot and Warm leads
            if (score === 'Hot' || score === 'Warm') {
                try {
                    const task = await Task.create({
                        title: suggestion.action,
                        description: `${suggestion.reason}\n\n[AI Auto-Created Task for ${lead.name} based on ${activityType}]`,
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
                    console.log(`[AI Next Action] ✅ Auto-created task (${task._id}) for ${score} lead "${lead.name}"`);
                } catch (taskErr) {
                    console.error('[AI Next Action] Error creating auto-task:', taskErr.message);
                }
            } else {
                console.log(`[AI Next Action] ℹ️ Cold lead "${lead.name}" — Display-only suggestion (no auto-task)`);
            }

            // Save suggestion on the lead
            lead.aiNextAction = {
                action: suggestion.action,
                reason: suggestion.reason,
                priority: suggestion.priority || (score === 'Hot' ? 'high' : 'medium'),
                recommendedDueDate: dueDate,
                status: 'active',
                suggestedAt: new Date(),
                dismissedAt: null,
                taskId: autoTaskId,
                activityTrigger: {
                    activityType,
                    activityId: activityData._id || null,
                    summary: triggerSummary
                }
            };

            await lead.save();

            // Broadcast via Socket.IO if available
            if (io) {
                const eventName = leadType === 'ea_lead' ? 'ea_lead:next_action_updated' : 'lead:next_action_updated';
                io.emit(eventName, {
                    leadId: lead._id.toString(),
                    leadType,
                    aiNextAction: lead.aiNextAction,
                    aiScore: score
                });
            }

            console.log(`[AI Next Action] 🚀 Successfully updated next action for ${lead.name}: "${suggestion.action}"`);
        } catch (err) {
            console.error('[AI Next Action] Evaluation error:', err.message, err.stack);
        }
    });
}

export default {
    deriveScoreFromStatus,
    triggerNextActionEvaluation
};
