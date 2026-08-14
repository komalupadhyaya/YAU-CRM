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

// ── System prompt builder for SMS ─────────────────────────────────
function buildSmsSystemPrompt() {
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

// ── User content builder for SMS ──────────────────────────────────
function buildSmsUserContent({ leadName, contactName, leadStatus, recentMessages, userPrompt }) {
    const formattedMessages = (recentMessages && recentMessages.length > 0)
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
- Organization / Lead Name: ${leadName || 'Unknown'}
- Contact Person: ${contactName || 'Primary Contact'}
- Current CRM Status: ${leadStatus || 'Unknown'}

Last ${(recentMessages || []).length} SMS messages (oldest → newest):
${formattedMessages}

Your goal for this new message:
${goal}

Write the SMS now:`;
}

// ── System prompt builder for Email ───────────────────────────────
function buildEmailSystemPrompt() {
    return `You are a professional CRM sales and partnership assistant for YAU Sports — an organization providing youth athletics programs, sports clinics, after-school camps, and sports enrichment for schools and organizations.

Your job is to compose a polite, compelling, well-structured email on behalf of the sales / partnerships team.

RULES (follow strictly):
- Generate a clear, engaging subject line and an email body formatted with HTML tags (such as <p>, <br>, <ul>, <li>, <strong>) suitable for a rich-text email editor.
- Address the recipient respectfully by name if provided.
- Tone: Professional, warm, consultative, and concise.
- If a user goal/prompt is provided, address it directly (e.g. follow-up after call, introducing athletic programs, scheduling a meeting, sharing information).
- If no goal is provided, craft an effective introductory or follow-up email tailored to the lead's status and organization.
- Sign off professionally from "The YAU Sports Team".
- Return your response strictly as a JSON object with keys "subject" and "body".
Example output format:
{
  "subject": "Exciting Sports Programs for [School/Organization]",
  "body": "<p>Hi [Name],</p><p>I hope your week is off to a great start...</p><p>Best regards,<br>The YAU Sports Team</p>"
}`;
}

// ── User content builder for Email ────────────────────────────────
function buildEmailUserContent({ leadName, contactName, contactTitle, leadStatus, leadCategory, recentNotes, userPrompt }) {
    const formattedNotes = (recentNotes && recentNotes.length > 0)
        ? recentNotes.map((n, i) => `  ${i + 1}. [${(n.type || 'NOTE').toUpperCase()}] ${n.content}`).join('\n')
        : '  (No previous notes logged)';

    const goal = userPrompt && userPrompt.trim()
        ? userPrompt.trim()
        : 'Generate a professional introductory or follow-up email tailored to this organization.';

    return `Lead Details:
- Organization Name: ${leadName || 'Unknown'}
- Contact Person: ${contactName || 'Valued Partner'}
- Contact Title: ${contactTitle || 'N/A'}
- Category / Type: ${leadCategory || 'Educational / Sports Organization'}
- Current CRM Status: ${leadStatus || 'Unknown'}

Recent Lead Activity Notes:
${formattedNotes}

Rep's Goal for this email:
${goal}

Generate the email JSON now:`;
}

// ── Groq provider ─────────────────────────────────────────────────
async function callGroq(systemPrompt, userContent, jsonMode = false) {
    const client = getGroqClient();
    const options = {
        model: 'llama-3.3-70b-versatile', // Best Groq model for instruction following
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userContent }
        ],
        max_tokens: jsonMode ? 800 : 200,  // Cap tokens
        temperature: 0.7,
    };
    if (jsonMode) {
        options.response_format = { type: 'json_object' };
    }
    const response = await client.chat.completions.create(options);
    return response.choices?.[0]?.message?.content?.trim() || '';
}

// ── Claude provider (ready for future switch) ─────────────────────
async function callClaude(systemPrompt, userContent, maxTokens = 200) {
    const client = await getAnthropicClient();
    const response = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: maxTokens,
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
 * @param {string} [params.contactName]  - Contact person's name
 * @param {string} params.leadStatus     - Current CRM status of the lead
 * @param {Array}  params.recentMessages - Last N smsHistory entries from DB
 * @param {string} [params.userPrompt]   - Optional goal/intent from the sales rep
 * @returns {Promise<string>}            - The AI-generated SMS draft text
 */
async function generateSmsMessage({ leadName, contactName, leadStatus, recentMessages, userPrompt }) {
    const systemPrompt = buildSmsSystemPrompt();
    const userContent  = buildSmsUserContent({ leadName, contactName, leadStatus, recentMessages, userPrompt });

    if (PROVIDER === 'groq') {
        return callGroq(systemPrompt, userContent, false);
    }

    if (PROVIDER === 'claude') {
        return callClaude(systemPrompt, userContent, 200);
    }

    throw new Error(`Unknown AI_PROVIDER: "${PROVIDER}". Valid values: "groq", "claude".`);
}

/**
 * Generate an AI-suggested Email subject and body for a lead.
 *
 * @param {Object} params
 * @param {string} params.leadName       - Lead / organization name
 * @param {string} [params.contactName]  - Contact person's name
 * @param {string} [params.contactTitle] - Contact person's title
 * @param {string} [params.leadStatus]   - Current CRM status of the lead
 * @param {string} [params.leadCategory] - Category/type of lead
 * @param {Array}  [params.recentNotes]  - Recent notes or activity logs
 * @param {string} [params.userPrompt]   - Optional goal/intent from the sales rep
 * @returns {Promise<{ subject: string, body: string }>} - Draft subject and HTML body
 */
async function generateEmailMessage({ leadName, contactName, contactTitle, leadStatus, leadCategory, recentNotes, userPrompt }) {
    const systemPrompt = buildEmailSystemPrompt();
    const userContent  = buildEmailUserContent({ leadName, contactName, contactTitle, leadStatus, leadCategory, recentNotes, userPrompt });

    let raw = '';
    if (PROVIDER === 'groq') {
        raw = await callGroq(systemPrompt, userContent, true);
    } else if (PROVIDER === 'claude') {
        raw = await callClaude(systemPrompt, userContent, 800);
    } else {
        throw new Error(`Unknown AI_PROVIDER: "${PROVIDER}". Valid values: "groq", "claude".`);
    }

    try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                subject: parsed.subject || `Partnering with YAU Sports - ${leadName || ''}`,
                body: parsed.body || `<p>${raw.replace(/\n/g, '<br/>')}</p>`
            };
        }
    } catch (e) {
        console.warn('Failed to parse AI email JSON, falling back to text:', e);
    }

    return {
        subject: `Partnering with YAU Sports - ${leadName || ''}`,
        body: `<p>${raw.replace(/\n/g, '<br/>')}</p>`
    };
}

// ── System prompt builder for Templates ────────────────────────────
function buildTemplateSystemPrompt() {
    return `You are a world-class email marketing designer and copywriter for YAU Sports — a youth sports, athletic development, and school sports partnership organization.

Your job is to generate or update a high-converting, beautifully formatted email marketing template based on the user's prompt.

RULES (follow strictly):
- Create an engaging, professional subject line.
- Create a complete HTML email body with modern inline-styled structure, clear headings, bullet points, call-to-action button, and polite closing.
- Use {{name}} as the dynamic placeholder for the recipient's name (e.g. "Hi {{name}},").
- If existing HTML template code is provided, PRESERVE its overall layout and structure while modifying, adding, or styling sections according to the user's new instructions.
- Return strictly JSON format with keys "name", "subject", "content", and "category".
Example output format:
{
  "name": "Summer Basketball Camp Invitation",
  "subject": "Registration Open for Summer Basketball Camp! 🏀",
  "category": "Promotional",
  "content": "<h2>Join Our Summer Basketball Camp</h2><p>Hi {{name}},</p><p>We are excited to invite your young athlete...</p><p><a href=\\"https://youthathleteuniversity.org\\" style=\\"background:#0066cc;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;\\">Register Now</a></p><br/><p>Best regards,<br/>The YAU Team</p>"
}`;
}

/**
 * Generate or refine an AI-created Email Template using Groq AI.
 *
 * @param {Object} params
 * @param {string} params.prompt           - User's prompt/idea or follow-up instruction
 * @param {string} [params.category]        - Optional category tag
 * @param {string} [params.existingContent] - Optional existing HTML template code to refine
 * @returns {Promise<{ name: string, subject: string, content: string, category: string }>}
 */
async function generateEmailTemplate({ prompt, category, existingContent }) {
    const systemPrompt = buildTemplateSystemPrompt();
    let userContent = `User Request / Prompt: ${prompt || 'Create a general sports program announcement email template.'}\nCategory Preference: ${category || 'General'}`;

    if (existingContent && existingContent.trim()) {
        userContent += `\n\n[EXISTING HTML TEMPLATE CODE TO MODIFY / REFINE]:\n\`\`\`html\n${existingContent}\n\`\`\`\n\nInstructions: Apply the user's requested changes directly to the existing HTML template code above. Return the updated complete HTML email in the JSON response.`;
    }

    let raw = '';
    if (PROVIDER === 'groq') {
        raw = await callGroq(systemPrompt, userContent, true);
    } else if (PROVIDER === 'claude') {
        raw = await callClaude(systemPrompt, userContent, 1000);
    } else {
        throw new Error(`Unknown AI_PROVIDER: "${PROVIDER}". Valid values: "groq", "claude".`);
    }

    try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                name: parsed.name || 'AI Generated Template',
                subject: parsed.subject || 'Special Announcement from YAU Sports',
                category: parsed.category || category || 'AI Generated',
                content: parsed.content || `<p>Hi {{name}},</p><p>${raw.replace(/\n/g, '<br/>')}</p>`
            };
        }
    } catch (e) {
        console.warn('Failed to parse AI template JSON, falling back to text:', e);
    }

    return {
        name: 'AI Generated Template',
        subject: 'Special Announcement from YAU Sports',
        category: category || 'AI Generated',
        content: `<p>Hi {{name}},</p><p>${raw.replace(/\n/g, '<br/>')}</p>`
    };
}

export default { generateSmsMessage, generateEmailMessage, generateEmailTemplate };

