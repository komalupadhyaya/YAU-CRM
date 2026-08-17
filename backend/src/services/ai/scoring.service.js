/**
 * scoring.service.js
 * ─────────────────────────────────────────────────────────────────
 * Feature 2 — Automated Lead Scoring Engine
 * Analyzes incoming and existing leads (EA Leads and Main Leads) to assign
 * dynamic scores: Hot (Red 🔴), Warm (Yellow 🟡), Cold (Blue 🔵).
 * ─────────────────────────────────────────────────────────────────
 */

import { executeAiCompletion } from './provider.service.js';
import EALead from '../../models/eaLead.model.js';
import Lead from '../../models/lead.model.js';
import presenceService from '../presence.service.js';

function buildScoringSystemPrompt() {
    return `You are an expert sales operations AI for YAU Sports (youth athletics & school sports programs).
Your job is to analyze lead data and assign an automated lead score: Hot, Warm, or Cold.

SCORING CRITERIA:
🔴 HOT (High Intent):
- Submitted request within the last 24 hours from high-converting sources (EA Form, direct school inquiry, incoming phone call).
- Has actively replied to an SMS or opened/clicked recent email campaigns.
- Expressed interest in immediate multi-program enrollment or school partnerships.
- Located in high-priority counties (Prince George's, Montgomery, Fairfax, Howard, DC).

🟡 WARM (Moderate Engagement):
- Submitted form within 1-7 days with complete contact info (sport interest, county, grade level).
- Form submission with no direct response yet, but from mid-tier acquisition channels (Meta ads, general web forms).
- Opened email campaigns or had preliminary staff contact.

🔵 COLD (Low / No Engagement):
- Older lead (> 7 days) with zero follow-up or no response to outbound messages.
- Incomplete contact information or generic directory lead.
- Unsubscribed or revoked SMS/Email consent.

RULES:
- Return strictly a JSON object with keys: "score" ("Hot", "Warm", or "Cold") and "reason" (a 1-2 sentence concise explanation).
Example:
{
  "score": "Hot",
  "reason": "Submitted EA form for Prince George's County soccer within 2 hours and opted into SMS communications."
}`;
}

function buildScoringUserContent(leadData) {
    const smsCount = (leadData.smsHistory || []).length;
    const inboundSmsCount = (leadData.smsHistory || []).filter(m => m.direction === 'inbound').length;
    const daysSinceSubmission = leadData.dateSubmitted || leadData.createdAt
        ? Math.floor((Date.now() - new Date(leadData.dateSubmitted || leadData.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    return `Lead Details to Score:
- Name / Organization: ${leadData.name || 'Unknown'}
- Source: ${leadData.source || leadData.type || 'Form Submission'}
- County / Location: ${leadData.county || leadData.city || leadData.state || 'Not specified'}
- Sport Interest / Category: ${leadData.sport || leadData.category_group || 'Youth Sports'}
- Days Since Form Submission: ${daysSinceSubmission}
- SMS Consent: ${leadData.isConsent !== false ? 'Yes' : 'No'}
- Total SMS History: ${smsCount} messages (${inboundSmsCount} inbound replies from lead)
- Current Status: ${leadData.status || 'New Submission'}

Analyze this lead and return score JSON now:`;
}

/**
 * Calculate lead score using AI provider with fallback rules.
 */
export async function calculateLeadScore(leadData) {
    const systemPrompt = buildScoringSystemPrompt();
    const userContent = buildScoringUserContent(leadData);

    try {
        const result = await executeAiCompletion({
            systemPrompt,
            userContent,
            jsonMode: true,
            maxTokens: 250
        });

        if (result && ['Hot', 'Warm', 'Cold'].includes(result.score)) {
            return {
                score: result.score,
                reason: result.reason || `Automatically scored as ${result.score} based on lead details.`
            };
        }
    } catch (err) {
        console.warn('[AI Scoring] Falling back to rule-based scoring due to AI error:', err.message);
    }

    // Heuristic Rule-Based Fallback
    const inboundSmsCount = (leadData.smsHistory || []).filter(m => m.direction === 'inbound').length;
    if (inboundSmsCount > 0 || leadData.source === 'EA Form') {
        return {
            score: 'Hot',
            reason: 'High priority lead based on form source and active engagement.'
        };
    }

    return {
        score: 'Warm',
        reason: 'Standard lead captured with valid contact details.'
    };
}

/**
 * Score and update an EA Lead or Main Lead in the database.
 */
export async function scoreAndUpdateLead(leadId, leadType = 'ea_lead', forceOverride = false) {
    try {
        let leadDoc = null;
        if (leadType === 'ea_lead') {
            leadDoc = await EALead.findById(leadId);
        } else {
            leadDoc = await Lead.findById(leadId);
        }

        if (!leadDoc) return null;

        // Skip re-scoring if admin manually set score (unless forced)
        if (leadDoc.aiScore?.isManualOverride && !forceOverride) {
            return leadDoc.aiScore;
        }

        const scoreResult = await calculateLeadScore(leadDoc);

        leadDoc.aiScore = {
            score: scoreResult.score,
            reason: scoreResult.reason,
            scoreUpdated: new Date(),
            isManualOverride: false
        };

        await leadDoc.save();
        console.log(`[AI Scoring] Scored ${leadType} (${leadId}): ${scoreResult.score} — ${scoreResult.reason}`);

        // Broadcast real-time Socket.IO event to all frontend clients
        if (presenceService?.io) {
            presenceService.io.emit('ai:scored', {
                leadId: leadDoc._id,
                leadName: leadDoc.name,
                score: scoreResult.score,
                reason: scoreResult.reason,
                leadType
            });
        }

        return leadDoc.aiScore;
    } catch (err) {
        console.error(`[AI Scoring Error] Lead ${leadId}:`, err.message);
        return null;
    }
}

export default { calculateLeadScore, scoreAndUpdateLead };
