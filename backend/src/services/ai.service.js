/**
 * ai.service.js
 * ─────────────────────────────────────────────────────────────────
 * Re-exports facade & legacy helper functions for YAU CRM AI services.
 * Real implementations are modularized under `./ai/`.
 * ─────────────────────────────────────────────────────────────────
 */

import { executeAiCompletion } from './ai/provider.service.js';
import * as AiModule from './ai/index.js';

// ── Legacy helper function for SMS generation (Backwards Compatible) ──
export async function generateSmsMessage({ leadName, contactName, leadStatus, recentMessages, userPrompt }) {
    const formattedMessages = (recentMessages && recentMessages.length > 0)
        ? recentMessages.map((m, i) => `  ${i + 1}. ${m.direction === 'inbound' ? '[THEM]' : '[YOU]'}: ${m.message}`).join('\n')
        : '  (No previous SMS messages — this will be the first contact)';

    const systemPrompt = `You are a professional CRM sales assistant for YAU Sports.
Write a short, warm, and effective SMS message under 160 characters.
Output ONLY the SMS text without quotes or commentary.`;

    const userContent = `Lead Details: ${leadName} (${contactName || 'Contact'}), Status: ${leadStatus}
Recent SMS History:
${formattedMessages}
Goal: ${userPrompt || 'Follow up naturally.'}`;

    return executeAiCompletion({ systemPrompt, userContent, jsonMode: false, maxTokens: 150 });
}

// ── Legacy helper function for Email generation ──
export async function generateEmailMessage({ leadName, contactName, contactTitle, leadStatus, leadCategory, recentNotes, userPrompt }) {
    const systemPrompt = `You are a professional CRM sales assistant for YAU Sports.
Compose a polite, compelling email. Return strictly JSON with "subject" and "body" keys.`;

    const userContent = `Lead Details: ${leadName} (${contactName || 'Partner'}, ${contactTitle || 'Title'}), Status: ${leadStatus}, Category: ${leadCategory}
Goal: ${userPrompt || 'Craft introductory email.'}`;

    return executeAiCompletion({ systemPrompt, userContent, jsonMode: true, maxTokens: 600 });
}

// ── Legacy helper function for Email Templates ──
export async function generateEmailTemplate({ prompt, category, existingContent }) {
    const systemPrompt = `You are an email marketing designer for YAU Sports.
Generate an email template. Return strictly JSON with "name", "subject", "category", and "content" keys. Use {{name}} as recipient placeholder.`;

    const userContent = `Prompt: ${prompt}\nCategory: ${category}\nExisting: ${existingContent || 'None'}`;

    return executeAiCompletion({ systemPrompt, userContent, jsonMode: true, maxTokens: 1000 });
}

// Re-export all modern AI module services
export const {
    aiQueue,
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
} = AiModule;

export default {
    generateSmsMessage,
    generateEmailMessage,
    generateEmailTemplate,
    ...AiModule
};
