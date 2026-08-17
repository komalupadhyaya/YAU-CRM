/**
 * stalled.service.js
 * ─────────────────────────────────────────────────────────────────
 * Feature 5 — Stalled Lead Detection & Alerts Engine
 * Scans active leads nightly to detect inactive leads based on score thresholds,
 * pre-drafts contextual follow-up messages using AI, and flags leads for reps.
 * ─────────────────────────────────────────────────────────────────
 */

import { executeAiCompletion } from './provider.service.js';
import EALead from '../../models/eaLead.model.js';
import Lead from '../../models/lead.model.js';
import { Settings } from '../../models/settings.model.js';

// Default threshold days if not configured in Settings
const DEFAULT_THRESHOLDS = {
    Hot: 3,
    Warm: 5,
    Cold: 7
};

function buildStalledFollowupPrompt() {
    return `You are a sales follow-up expert for YAU Sports (youth sports programs).
A lead has had no activity or response for several days. Write a short, warm, low-pressure re-engagement SMS message.

RULES:
- Length: Under 160 characters.
- Tone: Friendly, casual, non-demanding check-in.
- Content: Re-open conversation with a simple relevant question about youth sports programs in their county.
- Output: Return ONLY the SMS message text. No quotes or commentary.`;
}

function buildStalledFollowupUserContent(leadData, daysInactive) {
    return `Lead Details:
- Name: ${leadData.name || 'Valued Lead'}
- Score Tier: ${leadData.aiScore?.score || 'Warm'}
- Days Inactive: ${daysInactive}
- Sport / Area: ${leadData.sport || leadData.category_group || leadData.county || 'sports programs'}

Write the re-engagement check-in SMS now:`;
}

/**
 * Pre-draft a re-engagement follow-up message for a stalled lead using AI.
 */
export async function draftStalledFollowupMessage(leadData, daysInactive) {
    const systemPrompt = buildStalledFollowupPrompt();
    const userContent = buildStalledFollowupUserContent(leadData, daysInactive);

    try {
        const text = await executeAiCompletion({
            systemPrompt,
            userContent,
            jsonMode: false,
            maxTokens: 150
        });

        if (text && text.trim()) {
            return text.trim().replace(/^["']|["']$/g, '');
        }
    } catch (err) {
        console.error('[AI Stalled Followup Error]:', err.message);
    }

    const firstName = leadData.name ? leadData.name.split(' ')[0] : 'there';
    return `Hi ${firstName}! Just checking in from YAU Sports to see if you have any questions about upcoming sports programs. Hope you're having a great week!`;
}

/**
 * Main function run by nightly cron job to scan and flag all stalled leads across EA Leads & Main Leads.
 */
export async function scanAndFlagStalledLeads() {
    try {
        console.log('[AI Stalled Leads Scan] Starting nightly stalled lead scanning...');
        
        let settingsDoc = await Settings.findOne().catch(() => null);
        const sourceThresholds = settingsDoc?.aiSettings?.stalledThresholds || {};

        const getThresholdDays = (leadScore = 'Warm', leadSource = 'default') => {
            const sourceRule = sourceThresholds[leadSource] || sourceThresholds['default'] || DEFAULT_THRESHOLDS;
            return sourceRule[leadScore] || DEFAULT_THRESHOLDS[leadScore] || 5;
        };

        const now = Date.now();
        let eaStalledCount = 0;
        let mainStalledCount = 0;

        // 1. Scan EA Leads
        const eaLeads = await EALead.find();
        for (const eaLead of eaLeads) {
            const lastActivity = eaLead.updatedAt || eaLead.dateSubmitted || eaLead.createdAt;
            const daysInactive = Math.floor((now - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));
            const leadScore = eaLead.aiScore?.score || 'Warm';
            const thresholdDays = getThresholdDays(leadScore, 'ea_lead');

            if (daysInactive >= thresholdDays) {
                if (!eaLead.stalledInfo?.isStalled) {
                    const draftMsg = await draftStalledFollowupMessage(eaLead, daysInactive);
                    eaLead.stalledInfo = {
                        isStalled: true,
                        daysStalled: daysInactive,
                        flaggedAt: new Date(),
                        draftFollowup: draftMsg
                    };
                    await eaLead.save();
                    eaStalledCount++;
                } else {
                    eaLead.stalledInfo.daysStalled = daysInactive;
                    await eaLead.save();
                }
            } else if (eaLead.stalledInfo?.isStalled) {
                // Clear stalled flag if recent activity occurred
                eaLead.stalledInfo.isStalled = false;
                await eaLead.save();
            }
        }

        // 2. Scan Main Leads
        const mainLeads = await Lead.find();
        for (const mainLead of mainLeads) {
            const lastActivity = mainLead.last_contacted || mainLead.updatedAt || mainLead.createdAt;
            const daysInactive = Math.floor((now - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));
            const leadScore = mainLead.aiScore?.score || 'Warm';
            const thresholdDays = getThresholdDays(leadScore, 'main_lead');

            if (daysInactive >= thresholdDays) {
                if (!mainLead.stalledInfo?.isStalled) {
                    const draftMsg = await draftStalledFollowupMessage(mainLead, daysInactive);
                    mainLead.stalledInfo = {
                        isStalled: true,
                        daysStalled: daysInactive,
                        flaggedAt: new Date(),
                        draftFollowup: draftMsg
                    };
                    await mainLead.save();
                    mainStalledCount++;
                } else {
                    mainLead.stalledInfo.daysStalled = daysInactive;
                    await mainLead.save();
                }
            } else if (mainLead.stalledInfo?.isStalled) {
                mainLead.stalledInfo.isStalled = false;
                await mainLead.save();
            }
        }

        console.log(`[AI Stalled Leads Scan] Complete. Newly flagged stalled leads: ${eaStalledCount} EA Leads, ${mainStalledCount} Main Leads.`);
        return { eaStalledCount, mainStalledCount };

    } catch (err) {
        console.error('[AI Stalled Leads Scan Error]:', err.message);
        return { error: err.message };
    }
}

export default { draftStalledFollowupMessage, scanAndFlagStalledLeads };
