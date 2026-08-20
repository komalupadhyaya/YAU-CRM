/**
 * ai.service.js
 * ─────────────────────────────────────────────────────────────────
 * Provider-agnostic AI wrapper for Email Templates, Campaigns,
 * 1-to-1 Emails, and SMS message generation.
 *
 * Configured for: Anthropic Claude (YAU Anthropic)
 * ─────────────────────────────────────────────────────────────────
 */

import Anthropic from '@anthropic-ai/sdk';
import Groq from 'groq-sdk';

const PROVIDER = process.env.AI_PROVIDER || 'claude';

// ── Anthropic Claude client (YAU Anthropic) ──────────────────────
let anthropicClient = null;
function getAnthropicClient() {
    if (!anthropicClient) {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set in environment variables.');
        anthropicClient = new Anthropic({ apiKey });
    }
    return anthropicClient;
}

// ── Groq client (fallback if AI_PROVIDER=groq) ───────────────────
let groqClient = null;
function getGroqClient() {
    if (!groqClient) {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) throw new Error('GROQ_API_KEY is not set in environment variables.');
        groqClient = new Groq({ apiKey });
    }
    return groqClient;
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
        model: 'openai/gpt-oss-120b',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userContent }
        ],
        max_tokens: jsonMode ? 1200 : 200,
        temperature: 0.7,
    };
    const response = await client.chat.completions.create(options);
    return response.choices?.[0]?.message?.content?.trim() || '';
}

// ── Anthropic Claude provider (YAU Anthropic) ────────────────────
async function callClaude(systemPrompt, userContent, maxTokens = 1200) {
    const client = getAnthropicClient();
    
    // Primary model: claude-sonnet-4-6 via official Anthropic SDK
    const candidateModels = [
        'claude-sonnet-4-6',
        'claude-haiku-4-5-20251001',
        'claude-sonnet-4-5-20250929'
    ];

    const uniqueModels = [...new Set(candidateModels)];
    let lastError = null;

    for (const model of uniqueModels) {
        try {
            console.log(`[Anthropic AI] API Key hit | Model: ${model} | MaxTokens: ${maxTokens}`);
            const response = await client.messages.create({
                model,
                max_tokens: maxTokens,
                system: systemPrompt,
                messages: [
                    { role: 'user', content: userContent }
                ]
            });
            return response.content?.[0]?.text?.trim() || '';
        } catch (err) {
            lastError = err;
            if (err?.status === 404) {
                console.warn(`[Anthropic AI] Model "${model}" not found, trying next candidate model...`);
                continue;
            }
            throw err;
        }
    }

    throw lastError;
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

    if (PROVIDER === 'claude' || PROVIDER === 'anthropic') {
        return callClaude(systemPrompt, userContent, 200);
    }

    if (PROVIDER === 'groq') {
        return callGroq(systemPrompt, userContent, false);
    }

    // Default to Claude
    return callClaude(systemPrompt, userContent, 200);
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
 * @returns {Promise<{ subject: string, body: string, provider: string, apiHit: boolean }>} - Draft subject and HTML body
 */
async function generateEmailMessage({ leadName, contactName, contactTitle, leadStatus, leadCategory, recentNotes, userPrompt }) {
    const systemPrompt = buildEmailSystemPrompt();
    const userContent  = buildEmailUserContent({ leadName, contactName, contactTitle, leadStatus, leadCategory, recentNotes, userPrompt });

    let raw = '';
    if (PROVIDER === 'claude' || PROVIDER === 'anthropic') {
        raw = await callClaude(systemPrompt, userContent, 1000);
    } else if (PROVIDER === 'groq') {
        raw = await callGroq(systemPrompt, userContent, true);
    } else {
        raw = await callClaude(systemPrompt, userContent, 1000);
    }

    try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                subject: parsed.subject || `Partnering with YAU Sports - ${leadName || ''}`,
                body: parsed.body || `<p>${raw.replace(/\n/g, '<br/>')}</p>`,
                provider: 'anthropic',
                apiHit: true
            };
        }
    } catch (e) {
        console.warn('Failed to parse AI email JSON, falling back to text:', e);
    }

    return {
        subject: `Partnering with YAU Sports - ${leadName || ''}`,
        body: `<p>${raw.replace(/\n/g, '<br/>')}</p>`,
        provider: 'anthropic',
        apiHit: true
    };
}

// ── System prompt builder for Templates ────────────────────────────
function buildTemplateSystemPrompt() {
    return `You are a world-class email marketing designer and copywriter for YAU Sports — a youth sports, athletic development, and school sports partnership organization.

Your job is to generate or update a high-converting, beautifully formatted email marketing template based on the user's prompt.

EMAIL DESIGN & HTML RULES (follow strictly):
1. NO BROKEN IMAGES: Never insert <img> tags with placeholder, local, or non-existent URLs (like logo.png or placeholder.com). Instead, use beautifully styled CSS header banners, colored badges, icons/emojis, and typography.
2. EMAIL CLIENT COMPATIBILITY (Gmail & Outlook):
   - Use table-based container layouts with max-width: 600px, centered with margin: 0 auto.
   - All styling MUST be inline (e.g. style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 24px;").
   - Use clean, modern colors: Navy/Blue (#1e3a8a, #2563eb), Slate (#0f172a, #334155), Emerald (#059669).
   - Clear visual hierarchy: Header banner, greeting, body sections with bullet points, high-contrast call-to-action button, and professional sign-off.
3. PERSONALIZATION: Use {{name}} as the dynamic placeholder for the recipient's name (e.g. "Hi {{name}},").
4. STRICT TEMPLATE & DESIGN PRESERVATION: If existing HTML template code is provided, you MUST STRICTLY PRESERVE the entire surrounding HTML table layout, inline CSS styles, containers, background colors, header banners, borders, and CTA button structure/styling. Do NOT discard or alter the visual design or formatting. ONLY replace or insert the textual content (headlines, greeting, body paragraphs, bullet points, button text) according to the user's prompt.
5. RESPONSE FORMAT: Return strictly JSON format with keys "name", "subject", "content", and "category".

Example output format:
{
  "name": "Summer Basketball Camp Invitation",
  "subject": "Registration Open for Summer Basketball Camp! 🏀",
  "category": "Promotional",
  "content": "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:600px;margin:0 auto;font-family:Arial,sans-serif;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;\"><tr><td style=\"background:linear-gradient(135deg,#1e3a8a,#2563eb);padding:28px 24px;text-align:center;color:#ffffff;\"><h1 style=\"margin:0;font-size:22px;font-weight:800;letter-spacing:-0.5px;\">Youth Athlete University</h1><p style=\"margin:6px 0 0 0;font-size:13px;opacity:0.9;\">Summer Basketball Skill Camp 2025</p></td></tr><tr><td style=\"padding:28px 24px;color:#334155;line-height:1.6;font-size:14px;\"><p style=\"margin-top:0;\">Hi {{name}},</p><p>We are excited to invite your young athlete to our premier summer development clinic...</p><div style=\"text-align:center;margin:28px 0;\"><a href=\"https://youthathleteuniversity.org\" style=\"background:#2563eb;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;font-size:14px;\">Register Today &rarr;</a></div><p style=\"margin-bottom:0;color:#64748b;font-size:13px;\">Best regards,<br/><strong style=\"color:#0f172a;\">The YAU Sports Team</strong></p></td></tr></table>"
}`;
}

/**
 * Generate or refine an AI-created Email Template using Anthropic Claude.
 *
 * @param {Object} params
 * @param {string} params.prompt           - User's prompt/idea or follow-up instruction
 * @param {string} [params.category]        - Optional category tag
 * @param {string} [params.existingContent] - Optional existing HTML template code to refine
 * @returns {Promise<{ name: string, subject: string, content: string, category: string, provider: string, apiHit: boolean }>}
 */
async function generateEmailTemplate({ prompt, category, existingContent }) {
    const systemPrompt = buildTemplateSystemPrompt();
    let userContent = `User Request / Prompt: ${prompt || 'Create a general sports program announcement email template.'}\nCategory Preference: ${category || 'General'}`;

    if (existingContent && existingContent.trim()) {
        userContent += `\n\n[EXISTING HTML TEMPLATE CODE TO MODIFY / REFINE]:\n\`\`\`html\n${existingContent}\n\`\`\`\n\nInstructions: Apply the user's requested changes directly to the existing HTML template code above. Return the updated complete HTML email in the JSON response.`;
    }

    let raw = '';
    if (PROVIDER === 'claude' || PROVIDER === 'anthropic') {
        raw = await callClaude(systemPrompt, userContent, 4000);
    } else if (PROVIDER === 'groq') {
        raw = await callGroq(systemPrompt, userContent, true);
    } else {
        raw = await callClaude(systemPrompt, userContent, 4000);
    }

    try {
        // Strip markdown ```json code blocks if returned
        let cleanRaw = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        const jsonMatch = cleanRaw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                name: parsed.name || 'AI Generated Template',
                subject: parsed.subject || 'Special Announcement from YAU Sports',
                category: parsed.category || category || 'AI Generated',
                content: parsed.content || `<p>Hi {{name}},</p><p>${raw.replace(/\n/g, '<br/>')}</p>`,
                provider: 'anthropic',
                apiHit: true
            };
        }
    } catch (e) {
        console.warn('Failed to parse AI template JSON, falling back to text:', e);
    }

    return {
        name: 'AI Generated Template',
        subject: 'Special Announcement from YAU Sports',
        category: category || 'AI Generated',
        content: `<p>Hi {{name}},</p><p>${raw.replace(/\n/g, '<br/>')}</p>`,
        provider: 'anthropic',
        apiHit: true
    };
}

// ── System prompt builder for Personalized Campaigns ─────────────────
function buildPersonalizedCampaignSystemPrompt(hasTemplate = false) {
    return `You are a world-class AI sales and partnership strategist for YAU Sports (Youth Athlete University) — a premier provider of youth athletic programs, school sports clinics, PE enrichment, and tournament coaching.

Your task is to write a highly customized, natural, 1-to-1 email for a specific school or organization contact as part of an email campaign.

CRITICAL RULES:
${hasTemplate ? `1. STRICT TEMPLATE & DESIGN PRESERVATION:
   - A BASE HTML TEMPLATE is provided in the prompt.
   - You MUST STRICTLY PRESERVE the exact HTML layout, tables, containers (e.g. max-width 600px), header banners, background colors, inline CSS styling, fonts, borders, and CTA button structure/styles.
   - Do NOT discard or change the visual layout, shape, or colors of the template.
   - PERSONALIZE ONLY THE INNER TEXT: Replace the greeting (address the contact by name), the body paragraphs, bullet points, and CTA button text with personalized content tailored to this specific contact.` : `1. EMAIL STRUCTURE:
   - Return clean HTML for the body with appropriate <p>, <br/>, and <strong> tags or clean styled tables.`}

2. DEEP CONTEXT INTEGRATION:
   - Carefully review all prior interactions provided: SMS text conversations, previous email exchanges, phone call logs, sales notes, and CRM pipeline status.
   - If there were prior conversations, naturally acknowledge the previous discussion, unanswered questions, or past interest (e.g., "Following up on our SMS exchange regarding gym availability..." or "Circling back to our discussion last month about the after-school basketball clinic...").
   - If there are no past communications logged, craft a compelling, tailored introduction highlighting programs most relevant to their organization type (e.g. elementary PE, middle school after-school athletics, high school training).

3. TONE & SIGN-OFF:
   - Professional, warm, consultative, and concise. Never sound like a generic robotic mass blast.
   - Include a clear, low-friction call-to-action.
   - Sign off professionally from "The YAU Sports Team".

4. STRICT JSON OUTPUT:
   Return ONLY a valid JSON object with the following schema:
   {
     "subject": "Clear, engaging, personalized email subject line",
     "body": "${hasTemplate ? 'Complete updated HTML code preserving all original styling, tables, colors, and layout, with inner text personalized' : '<p>HTML formatted email body...</p>'}",
     "contextReasoning": "1 short sentence explaining what specific previous history or profile detail was leveraged to personalize this email."
   }`;
}

// ── User content builder for Personalized Campaigns ──────────────────
function buildPersonalizedCampaignUserContent({
    recipient = {},
    smsHistory = [],
    emailHistory = [],
    notesHistory = [],
    campaignGoal = '',
    tone = 'Professional & Warm',
    customInstruction = '',
    baseTemplateHtml = '',
    templateSubject = ''
}) {
    const formatSms = (smsHistory && smsHistory.length > 0)
        ? smsHistory.slice(-6).map((m, i) => {
            const dir = m.direction === 'inbound' ? '[THEM]' : '[YOU]';
            const ts = m.timestamp ? new Date(m.timestamp).toLocaleDateString() : '';
            return `  ${i + 1}. ${dir} (${ts}): ${m.message}`;
          }).join('\n')
        : '  (No prior SMS messages)';

    const formatEmails = (emailHistory && emailHistory.length > 0)
        ? emailHistory.slice(-5).map((e, i) => {
            const dir = e.direction === 'inbound' ? '[THEM]' : '[YOU]';
            const ts = e.sentAt || e.timestamp ? new Date(e.sentAt || e.timestamp).toLocaleDateString() : '';
            const preview = (e.body || '').replace(/<[^>]*>/g, ' ').slice(0, 140);
            return `  ${i + 1}. ${dir} (${ts}) Subject: "${e.subject || ''}" | Content: ${preview}`;
          }).join('\n')
        : '  (No prior emails logged)';

    const formatNotes = (notesHistory && notesHistory.length > 0)
        ? notesHistory.slice(-5).map((n, i) => {
            const ts = n.createdAt ? new Date(n.createdAt).toLocaleDateString() : '';
            return `  ${i + 1}. [${(n.type || 'NOTE').toUpperCase()}] (${ts}): ${n.content}`;
          }).join('\n')
        : '  (No prior activity notes logged)';

    let prompt = `### RECIPIENT PROFILE
- Organization / School Name: ${recipient.leadName || recipient.organization || 'Unknown'}
- Contact Person: ${recipient.contactName || 'Primary Contact'}
- Contact Title: ${recipient.contactTitle || 'Decision Maker'}
- Email: ${recipient.email || 'N/A'}
- CRM Status: ${recipient.leadStatus || 'Active'}
- Category / Type: ${recipient.leadCategory || 'Educational Institution'}

### HISTORICAL COMMUNICATION CONTEXT

[PAST SMS MESSAGES]
${formatSms}

[PAST EMAIL EXCHANGES]
${formatEmails}

[PAST ACTIVITY NOTES & CALL LOGS]
${formatNotes}

### CAMPAIGN INSTRUCTIONS
- Campaign Goal / Key Message: ${campaignGoal || 'Re-connect and explore youth athletic programming opportunities'}
- Desired Tone: ${tone || 'Professional & Warm'}
${customInstruction ? `- Specific Rep Override Instruction: ${customInstruction}` : ''}`;

    if (baseTemplateHtml && baseTemplateHtml.trim()) {
        prompt += `\n\n### [MANDATORY BASE TEMPLATE TO PRESERVE]
\`\`\`html
${baseTemplateHtml.trim()}
\`\`\`
${templateSubject ? `Base Template Subject Idea: "${templateSubject}"` : ''}

INSTRUCTION: Keep the exact HTML layout, tables, header banners, background colors, CSS inline styling, and buttons from the base template above. Replace and personalize ONLY the text copy inside (greetings, paragraphs, bullet points, CTA button text) specifically for this recipient based on their profile and past communication history.`;
    }

    prompt += `\n\nGenerate the personalized email JSON now:`;
    return prompt;
}

/**
 * Generate a hyper-personalized email for an individual recipient in a campaign
 * based on all historical SMS, email, notes, and CRM status.
 */
async function generatePersonalizedEmailMessage({
    recipient,
    smsHistory,
    emailHistory,
    notesHistory,
    campaignGoal,
    tone,
    customInstruction,
    baseTemplateHtml,
    templateSubject
}) {
    const hasTemplate = !!(baseTemplateHtml && baseTemplateHtml.trim());
    const systemPrompt = buildPersonalizedCampaignSystemPrompt(hasTemplate);
    const userContent = buildPersonalizedCampaignUserContent({
        recipient,
        smsHistory,
        emailHistory,
        notesHistory,
        campaignGoal,
        tone,
        customInstruction,
        baseTemplateHtml,
        templateSubject
    });

    const maxTokens = hasTemplate ? 3500 : 1400;

    let raw = '';
    if (PROVIDER === 'claude' || PROVIDER === 'anthropic') {
        raw = await callClaude(systemPrompt, userContent, maxTokens);
    } else if (PROVIDER === 'groq') {
        raw = await callGroq(systemPrompt, userContent, true);
    } else {
        raw = await callClaude(systemPrompt, userContent, maxTokens);
    }

    try {
        let cleanRaw = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        const jsonMatch = cleanRaw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                subject: parsed.subject || templateSubject || `Youth Athletic Programs for ${recipient.leadName || recipient.organization || ''}`,
                body: parsed.body || baseTemplateHtml || `<p>${raw.replace(/\n/g, '<br/>')}</p>`,
                contextReasoning: parsed.contextReasoning || 'Personalized based on past communication history and organization profile.',
                provider: 'anthropic',
                apiHit: true
            };
        }
    } catch (e) {
        console.warn('Failed to parse AI personalized email JSON, falling back to text:', e);
    }

    return {
        subject: templateSubject || `Youth Athletic Programs for ${recipient.leadName || recipient.organization || ''}`,
        body: baseTemplateHtml ? baseTemplateHtml.replace(/\{\{\s*name\s*\}\}/gi, recipient.contactName || recipient.leadName || 'there') : `<p>${raw.replace(/\n/g, '<br/>')}</p>`,
        contextReasoning: 'Personalized based on organization profile.',
        provider: 'anthropic',
        apiHit: true
    };
}

export {
    generateSmsMessage,
    generateEmailMessage,
    generateEmailTemplate,
    generatePersonalizedEmailMessage
};

export default {
    generateSmsMessage,
    generateEmailMessage,
    generateEmailTemplate,
    generatePersonalizedEmailMessage
};

