/**
 * index.js
 * ─────────────────────────────────────────────────────────────────
 * Main entry point for YAU CRM Intelligence Layer (AI Services).
 * Exports all modular AI services:
 * - Queue & Concurrency Rate Limiter (`queue.service.js`)
 * - Provider Execution Wrapper (`provider.service.js`)
 * - Knowledge Base Context (`knowledgeBase.service.js`)
 * - Lead Scoring Engine (`scoring.service.js`)
 * - Initial SMS & AI Reply Assistant (`sms.service.js`)
 * - Stalled Lead Detection (`stalled.service.js`)
 * - Next Action Suggestions (`nextAction.service.js`)
 * - Weekly Executive Performance Report (`weeklyReport.service.js`)
 * ─────────────────────────────────────────────────────────────────
 */

import { aiQueue } from './queue.service.js';
import { executeAiCompletion } from './provider.service.js';
import { YAU_KNOWLEDGE_BASE, getKnowledgeBasePromptContext } from './knowledgeBase.service.js';
import { calculateLeadScore, scoreAndUpdateLead } from './scoring.service.js';
import { generateInitialPersonalizedSms, processInitialEALeadSms, handleInboundSmsReplyAi } from './sms.service.js';
import { draftStalledFollowupMessage, scanAndFlagStalledLeads } from './stalled.service.js';
import { generateAndSaveNextAction, acceptNextAction } from './nextAction.service.js';
import { generateWeeklyReport } from './weeklyReport.service.js';

export {
    aiQueue,
    executeAiCompletion,
    YAU_KNOWLEDGE_BASE,
    getKnowledgeBasePromptContext,
    calculateLeadScore,
    scoreAndUpdateLead,
    generateInitialPersonalizedSms,
    processInitialEALeadSms,
    handleInboundSmsReplyAi,
    draftStalledFollowupMessage,
    scanAndFlagStalledLeads,
    generateAndSaveNextAction,
    acceptNextAction,
    generateWeeklyReport
};

export default {
    aiQueue,
    executeAiCompletion,
    calculateLeadScore,
    scoreAndUpdateLead,
    generateInitialPersonalizedSms,
    processInitialEALeadSms,
    handleInboundSmsReplyAi,
    draftStalledFollowupMessage,
    scanAndFlagStalledLeads,
    generateAndSaveNextAction,
    acceptNextAction,
    generateWeeklyReport
};
