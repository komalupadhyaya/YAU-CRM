/**
 * provider.service.js
 * ─────────────────────────────────────────────────────────────────
 * Low-level AI model execution layer wrapping Groq & Claude SDKs.
 * Integrates with `aiQueue` for rate limit protection, exponential backoff,
 * and graceful fallback handling.
 * ─────────────────────────────────────────────────────────────────
 */

import Groq from 'groq-sdk';
import { aiQueue } from './queue.service.js';

const PROVIDER = process.env.AI_PROVIDER || 'groq';

// Groq client instance
let groqClient = null;
function getGroqClient() {
    if (!groqClient) {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) throw new Error('GROQ_API_KEY is not set in environment variables.');
        groqClient = new Groq({ apiKey });
    }
    return groqClient;
}

// Anthropic client instance (lazy loaded if AI_PROVIDER=claude)
let anthropicClient = null;
async function getAnthropicClient() {
    if (!anthropicClient) {
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set in environment variables.');
        anthropicClient = new Anthropic({ apiKey });
    }
    return anthropicClient;
}

/**
 * Execute completion via Groq SDK
 */
async function callGroqRaw(systemPrompt, userContent, jsonMode = false, maxTokens = 400) {
    const client = getGroqClient();
    const options = {
        model: 'llama-3.3-70b-versatile',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userContent }
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
    };
    if (jsonMode) {
        options.response_format = { type: 'json_object' };
    }
    const response = await client.chat.completions.create(options);
    return response.choices?.[0]?.message?.content?.trim() || '';
}

/**
 * Execute completion via Claude SDK
 */
async function callClaudeRaw(systemPrompt, userContent, jsonMode = false, maxTokens = 400) {
    const client = await getAnthropicClient();
    const response = await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
            { role: 'user', content: userContent }
        ]
    });
    return response.content?.[0]?.text?.trim() || '';
}

/**
 * Public method to run AI prompt through queued provider wrapper.
 * Returns raw string output or parsed JSON if jsonMode is true.
 */
export async function executeAiCompletion({ systemPrompt, userContent, jsonMode = false, maxTokens = 500 }) {
    return aiQueue.enqueue(async () => {
        try {
            let rawText = '';
            if (PROVIDER === 'groq') {
                rawText = await callGroqRaw(systemPrompt, userContent, jsonMode, maxTokens);
            } else if (PROVIDER === 'claude') {
                rawText = await callClaudeRaw(systemPrompt, userContent, jsonMode, maxTokens);
            } else {
                throw new Error(`Unsupported AI_PROVIDER: "${PROVIDER}". Valid options are "groq" or "claude".`);
            }

            if (jsonMode) {
                const jsonMatch = rawText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                }
                throw new Error('AI output did not contain valid JSON payload.');
            }

            return rawText;
        } catch (error) {
            console.error(`[AI Provider Error] Provider: ${PROVIDER}, Error:`, error.message);
            throw error;
        }
    });
}

export default { executeAiCompletion };
