/**
 * nextAction.service.js
 * ─────────────────────────────────────────────────────────────────
 * Feature 6 — Next Action Suggestions Engine
 * Analyzes recent lead interactions (call logs, notes, meetings, emails)
 * and generates actionable recommendations for sales reps with 1-click task creation.
 * ─────────────────────────────────────────────────────────────────
 */

import { executeAiCompletion } from './provider.service.js';
import EALead from '../../models/eaLead.model.js';
import Lead from '../../models/lead.model.js';
import Followup from '../../models/followup.model.js';
import Tasks from '../../models/tasks.model.js';

function buildNextActionPrompt() {
    return `You are a sales methodology coach for YAU Sports (youth sports programs).
Your job is to recommend the single best next action for a sales rep after an activity or interaction is logged.

SALES PLAYBOOK RULES:
- If call reached decision maker and interested: Recommend scheduling a program review call or sending proposal within 48 hours.
- If left voicemail: Recommend calling again tomorrow afternoon and sending a short follow-up text.
- If meeting completed: Recommend sending a meeting recap email and setting a follow-up task within 24 hours.
- If lead opened email but didn't reply: Recommend sending a quick SMS check-in.
- If lead has been Cold for > 7 days: Recommend sending a testimonial or video highlight link.

RETURN FORMAT:
Return strictly a JSON object with:
  "actionText": string (clear, actionable recommendation),
  "taskType": "Call" | "Email" | "Meeting" | "SMS" | "Follow-up",
  "suggestedDaysDelay": number (number of days from today for task due date),
  "rationale": string (1 sentence explaining why this step is recommended)
`;
}

function buildNextActionUserContent(leadData, activityContext) {
    return `Lead Profile:
- Name: ${leadData.name || 'Unknown'}
- Status: ${leadData.status || 'Not Contacted'}
- Category / Type: ${leadData.source || leadData.type || 'N/A'}
- Score Tier: ${leadData.aiScore?.score || 'Warm'}

Recent Activity Context:
${activityContext}

Generate the recommended next action JSON now:`;
}

/**
 * Generate Next Action suggestion using AI and update the lead doc.
 */
export async function generateAndSaveNextAction(leadId, leadType = 'ea_lead', activityContext = 'Interaction updated') {
    try {
        let leadDoc = leadType === 'ea_lead' ? await EALead.findById(leadId) : await Lead.findById(leadId);
        if (!leadDoc) return null;

        const systemPrompt = buildNextActionPrompt();
        const userContent = buildNextActionUserContent(leadDoc, activityContext);

        const aiResult = await executeAiCompletion({
            systemPrompt,
            userContent,
            jsonMode: true,
            maxTokens: 300
        }).catch(err => {
            console.error('[AI Next Action] AI execution error:', err.message);
            return null;
        });

        if (!aiResult || !aiResult.actionText) return null;

        const suggestedDays = aiResult.suggestedDaysDelay || 1;
        const suggestedDate = new Date();
        suggestedDate.setDate(suggestedDate.getDate() + suggestedDays);

        leadDoc.aiNextAction = {
            actionText: aiResult.actionText,
            taskType: aiResult.taskType || 'Follow-up',
            suggestedDate: suggestedDate,
            rationale: aiResult.rationale || 'Recommended next step based on sales playbook.',
            createdAt: new Date()
        };

        await leadDoc.save();
        console.log(`[AI Next Action] Generated suggestion for ${leadType} (${leadId}): ${aiResult.actionText}`);
        return leadDoc.aiNextAction;

    } catch (err) {
        console.error('[AI Next Action Error]:', err.message);
        return null;
    }
}

/**
 * Accept a Next Action suggestion and automatically create a Followup / Task.
 */
export async function acceptNextAction(leadId, leadType = 'ea_lead', userId = null) {
    try {
        let leadDoc = leadType === 'ea_lead' ? await EALead.findById(leadId) : await Lead.findById(leadId);
        if (!leadDoc || !leadDoc.aiNextAction?.actionText) {
            throw new Error('No active AI next action recommendation found for this lead.');
        }

        const action = leadDoc.aiNextAction;

        // Create Followup Task in DB
        const newFollowup = await Followup.create({
            lead_id: leadType === 'main_lead' ? leadDoc._id : null,
            date_time: action.suggestedDate || new Date(Date.now() + 24 * 60 * 60 * 1000),
            type: action.taskType || 'Call',
            priority: 'High',
            notes: `[AI Suggestion] ${action.actionText} — ${action.rationale}`,
            status: 'pending',
            assigned_user: userId || leadDoc.assigned_to
        });

        // Clear suggestion after accepting
        leadDoc.aiNextAction = null;
        await leadDoc.save();

        return newFollowup;
    } catch (err) {
        console.error('[AI Accept Next Action Error]:', err.message);
        throw err;
    }
}

export default { generateAndSaveNextAction, acceptNextAction };
