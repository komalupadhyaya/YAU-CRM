import Lead from '../models/lead.model.js';
import Note from '../models/note.model.js';
import Followup from '../models/followup.model.js';

/**
 * Calculates lead temperature (Hot, Warm, Cold) strictly based on actual CRM activities
 * (notes, calls, meetings, follow-ups, emails, SMS) and pipeline status.
 *
 * NOTE: This is strictly decoupled from and NEVER considers AI Next Action suggestions.
 *
 * @param {Object} params
 * @param {Object} params.lead - The lead document
 * @param {Array} params.notes - Recent notes for this lead
 * @param {Array} params.followups - Recent follow-ups/meetings for this lead
 * @returns {{ score: 'Hot' | 'Warm' | 'Cold', reason: string, isOverridden: boolean }}
 */
export function calculateLeadActivityScore({ lead, notes = [], followups = [] }) {
    if (!lead) return { score: 'Cold', reason: 'No lead data', isOverridden: false };

    // 1. If rep manually set and locked the score, preserve user intent
    if (lead.aiScoreOverride === true && lead.aiScore) {
        return {
            score: lead.aiScore,
            reason: lead.aiScoreReason || 'Manually updated by Team Member',
            isOverridden: true
        };
    }

    const status = lead.status || 'Not Contacted';
    const calls = lead.callHistory || [];

    // Filter activities within the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentNotes = notes.filter(n => !n.createdAt || new Date(n.createdAt) >= thirtyDaysAgo);
    const recentCalls = calls.filter(c => !c.timestamp || new Date(c.timestamp) >= thirtyDaysAgo);
    const recentFollowups = followups.filter(f => !f.createdAt || new Date(f.createdAt) >= thirtyDaysAgo);

    const hasMeeting = followups.some(f => f.type === 'Meeting' || f.status === 'done') ||
                      status === 'Meeting Scheduled';

    const highIntentStatuses = ['Meeting Scheduled', 'Proposal Sent', 'Interested', 'Program Confirmed'];
    const inProgressStatuses = ['Spoke to Front Office', 'Spoke to Decision Maker', 'Waiting on Reply', 'Follow-Up Needed'];

    const totalRecentTouchpoints = recentNotes.length + recentCalls.length + recentFollowups.length;

    // RULE 1: High Intent / Close to Closing / Meeting Confirmed -> HOT
    if (highIntentStatuses.includes(status)) {
        return {
            score: 'Hot',
            reason: `High intent pipeline stage: "${status}" with active communications.`,
            isOverridden: false
        };
    }

    if (hasMeeting) {
        return {
            score: 'Hot',
            reason: 'Meeting scheduled or completed with decision maker.',
            isOverridden: false
        };
    }

    // RULE 2: High activity frequency (4+ recent interactions in 30 days) -> HOT
    if (totalRecentTouchpoints >= 4) {
        return {
            score: 'Hot',
            reason: `High engagement frequency: ${totalRecentTouchpoints} interactions logged in past 30 days.`,
            isOverridden: false
        };
    }

    // RULE 3: In-progress discussions OR at least 1-3 interactions -> WARM
    if (inProgressStatuses.includes(status)) {
        return {
            score: 'Warm',
            reason: `Outreach in progress: status is "${status}".`,
            isOverridden: false
        };
    }

    if (totalRecentTouchpoints >= 1) {
        return {
            score: 'Warm',
            reason: `Active engagement: ${totalRecentTouchpoints} interaction(s) logged.`,
            isOverridden: false
        };
    }

    // RULE 4: No recent touchpoints or uncontacted status -> COLD
    return {
        score: 'Cold',
        reason: `Minimal engagement: no recent outreach recorded (Status: ${status}).`,
        isOverridden: false
    };
}

/**
 * Re-evaluates and persists the lead activity score in MongoDB.
 * If score has changed, updates lead and emits 'lead:score_updated' via Socket.IO.
 */
export async function recalculateAndSaveLeadScore(leadId, io = null) {
    if (!leadId) return null;

    try {
        const lead = await Lead.findById(leadId);
        if (!lead) return null;

        // Skip if locked by user
        if (lead.aiScoreOverride === true) {
            return lead;
        }

        const notes = await Note.find({ lead_id: leadId }).lean();
        const followups = await Followup.find({ lead_id: leadId }).lean();

        const evaluation = calculateLeadActivityScore({ lead, notes, followups });

        const scoreChanged = lead.aiScore !== evaluation.score;
        lead.aiScore = evaluation.score;
        lead.aiScoreReason = evaluation.reason;
        lead.aiScoreUpdatedAt = new Date();

        await lead.save();

        if (io) {
            io.emit('lead:score_updated', {
                leadId: lead._id.toString(),
                aiScore: lead.aiScore,
                aiScoreReason: lead.aiScoreReason,
                aiScoreOverride: lead.aiScoreOverride,
                aiScoreUpdatedAt: lead.aiScoreUpdatedAt
            });
        }

        if (scoreChanged) {
            console.log(`[Lead Activity Scoring] 🌡️ Updated score for "${lead.name}": ${evaluation.score} (${evaluation.reason})`);
        }

        return lead;
    } catch (err) {
        console.error('[Lead Activity Scoring] Error recalculating score:', err.message);
        return null;
    }
}

export default {
    calculateLeadActivityScore,
    recalculateAndSaveLeadScore
};
