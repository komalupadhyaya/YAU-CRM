/**
 * ai.service.js
 * ─────────────────────────────────────────────────────────────────
 * Provider-agnostic AI wrapper for SMS message generation.
 *
 * Currently wired to: Groq  (AI_PROVIDER=groq)
 * Future switch to:   Claude (AI_PROVIDER=claude)
 *
 * To switch to Claude:
 *   1. Set AI_PROVIDER=claude in .env
 *   2. Set ANTHROPIC_API_KEY=sk-ant-xxx in .env
 *   3. Run: npm install @anthropic-ai/sdk
 *   4. Done — zero changes needed anywhere else.
 * ─────────────────────────────────────────────────────────────────
 */

import Groq from 'groq-sdk';

const PROVIDER = process.env.AI_PROVIDER || 'groq';

// ── Groq client (lazy-initialized) ───────────────────────────────
let groqClient = null;
function getGroqClient() {
    if (!groqClient) {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) throw new Error('GROQ_API_KEY is not set in environment variables.');
        groqClient = new Groq({ apiKey });
    }
    return groqClient;
}

// ── Claude client (lazy-initialized, when future-switching) ───────
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

// ── System prompt builder ─────────────────────────────────────────
function buildSystemPrompt() {
    return `You are a professional CRM sales assistant for YAU Sports — a company that coordinates sports programs with schools and organizations.

Your job is to write a short, warm, and effective SMS message on behalf of the sales team.

RULES (follow strictly):
- Keep the message under 160 characters (one SMS segment). This is a hard limit.
- Be friendly, professional, and action-oriented.
- Do NOT be spammy, pushy, or overly salesy.
- If the lead's last message was inbound (they reached out), respond naturally to what they said.
- If a user goal/prompt is provided, use it as the primary objective of the message.
- If no goal is provided, suggest a natural, context-aware follow-up based on the conversation history.
- Output ONLY the SMS text. No explanation, no quotes, no labels, no extra commentary.
- Never include placeholder text like [Name] or [Company] — use actual names if available.`;
}

// ── User content builder ──────────────────────────────────────────
function buildUserContent({ leadName, leadStatus, recentMessages, userPrompt }) {
    const formattedMessages = recentMessages.length > 0
        ? recentMessages.map((m, i) => {
            const dir = m.direction === 'inbound' ? '[THEM]' : '[YOU]';
            const ts = m.timestamp ? new Date(m.timestamp).toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : '';
            return `  ${i + 1}. ${dir} (${ts}): ${m.message}`;
          }).join('\n')
        : '  (No previous SMS messages — this will be the first contact)';

    const goal = userPrompt && userPrompt.trim()
        ? userPrompt.trim()
        : 'Not specified — generate a natural, context-appropriate follow-up.';

    return `Lead Information:
- Name: ${leadName || 'Unknown'}
- Current CRM Status: ${leadStatus || 'Unknown'}

Last ${recentMessages.length} SMS messages (oldest → newest):
${formattedMessages}

Your goal for this new message:
${goal}

Write the SMS now:`;
}

// ── Groq provider ─────────────────────────────────────────────────
async function callGroq(systemPrompt, userContent) {
    const client = getGroqClient();
    const response = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile', // Best Groq model for instruction following
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userContent }
        ],
        max_tokens: 200,  // SMS should be short; cap to avoid runaway output
        temperature: 0.7, // Some creativity, but not too unpredictable
    });
    return response.choices?.[0]?.message?.content?.trim() || '';
}

// ── Claude provider (ready for future switch) ─────────────────────
async function callClaude(systemPrompt, userContent) {
    const client = await getAnthropicClient();
    const response = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 200,
        system: systemPrompt,
        messages: [
            { role: 'user', content: userContent }
        ]
    });
    return response.content?.[0]?.text?.trim() || '';
}

// ── Public API ────────────────────────────────────────────────────
/**
 * Generate an AI-suggested SMS message for a lead.
 *
 * @param {Object} params
 * @param {string} params.leadName       - Lead / organization name
 * @param {string} params.leadStatus     - Current CRM status of the lead
 * @param {Array}  params.recentMessages - Last N smsHistory entries from DB
 * @param {string} [params.userPrompt]   - Optional goal/intent from the sales rep
 * @returns {Promise<string>}            - The AI-generated SMS draft text
 */
async function generateSmsMessage({ leadName, leadStatus, recentMessages, userPrompt }) {
    const systemPrompt = buildSystemPrompt();
    const userContent  = buildUserContent({ leadName, leadStatus, recentMessages, userPrompt });

    if (PROVIDER === 'groq') {
        return callGroq(systemPrompt, userContent);
    }

    if (PROVIDER === 'claude') {
        return callClaude(systemPrompt, userContent);
    }

    throw new Error(`Unknown AI_PROVIDER: "${PROVIDER}". Valid values: "groq", "claude".`);
}

export default { generateSmsMessage };
