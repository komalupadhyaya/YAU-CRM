import axios from 'axios';
import RetellKnowledgeBase from '../../models/retellKnowledgeBase.model.js';

const RETELL_API_BASE = 'https://api.retellai.com';

export function getSanitizedToolName(deptName, index = 0) {
    const raw = (deptName || '').toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    const clean = raw.slice(0, 30);
    return clean ? `transfer_to_${clean}` : `transfer_to_dept_${index}`;
}

/**
 * Builds the complete Markdown Universal Prompt from the database Knowledge Base model.
 *
 * @param {Object} kb - RetellKnowledgeBase document
 * @returns {string} - Full Markdown prompt
 */
export function buildPromptFromKnowledgeBase(kb) {
    const safeKb = kb || {};
    const personalityTraitsStr = (safeKb.personalityTraits || [])
        .map(t => `- **${t}**`)
        .join('\n');

    const toneRulesStr = (safeKb.toneRules || [])
        .map(r => `- ${r}`)
        .join('\n');

    const differentiatorsStr = (safeKb.differentiators || [])
        .map((d, i) => `  ${i + 1}. **${d.split('—')[0]?.trim()}**: ${d}`)
        .join('\n');

    const sportsStr = (kb.sportsPrograms || [])
        .map((s, i) => `${i + 1}. ${s.emoji || '⚽'} **${s.name}** (${s.grades || 'K – 8th Grade'}): ${s.description}`)
        .join('\n');

    const locationsTable = (kb.locations || []).map(loc => 
        `| **${loc.name}** | ${loc.school} | ${loc.practiceDays} | ${loc.practiceTime || '6:00 PM – 7:30 PM'} |`
    ).join('\n');

    const faqsStr = (kb.faqs || []).map((faq, i) => 
        `${i + 1}. **"${faq.question}"**\n   *"${faq.answer}"*`
    ).join('\n\n');

    const objectionsStr = (kb.objections || []).map(obj => 
        `- **"${obj.trigger}"**:\n  *"${obj.response}"*`
    ).join('\n\n');

    const triggersStr = (kb.humanTransferTriggers || [])
        .map((t, i) => `${i + 1}. ${t}`)
        .join('\n');

    let pricingStr = '';
    if (kb.pricingPlans && kb.pricingPlans.length > 0) {
        pricingStr = kb.pricingPlans.map((plan, i) => {
            const intervalText = plan.interval ? ` / ${plan.interval}` : '';
            const recText = plan.isRecommended ? ' (Recommended)' : '';
            return `${i + 1}. **${plan.name} — $${plan.price}${intervalText}${recText}**:\n   - ${plan.includes || 'Features and details as described'}`;
        }).join('\n\n');
    } else {
        pricingStr = `1. **Monthly Membership — $${kb.monthlyPrice || 50} / month (Recommended)**:\n   - ${kb.monthlyIncludes || 'All 4 sports — rotate anytime. No re-registration fees.'}\n   - Uniforms are purchased separately.\n\n2. **Seasonal Fee — $${kb.seasonalPrice || 200} / season**:\n   - ${kb.seasonalIncludes || 'Covers one specific sport for 3–4 months. Uniform included.'}`;
    }

    const departments = (kb.transferDepartments && kb.transferDepartments.length > 0)
        ? kb.transferDepartments
        : [
            {
                departmentName: 'Executive Management & Escalations',
                phoneNumber: kb.humanTransferPhone || '+12027013900',
                triggers: 'Director requests, management escalations, serious complaints, special circumstance reviews',
                transferType: 'warm_transfer',
                onHoldMusic: 'ringtone'
            },
            {
                departmentName: 'Program Coordination & Support',
                phoneNumber: '+12023413778',
                triggers: 'Registration questions, scheduling details, program coordinator requests, team assignments',
                transferType: 'warm_transfer',
                onHoldMusic: 'ringtone'
            }
        ];

    const departmentRoutingLines = departments.map((dept, i) => {
        const toolName = getSanitizedToolName(dept.departmentName, i);
        return `- **${dept.departmentName}** (Tool: \`${toolName}\`):\n  - **Topic / Triggers**: ${dept.triggers || 'General department requests'}\n  - **Action**: Speak warm transfer script and invoke tool \`${toolName}\`. NEVER recite or speak the phone number digits aloud.`;
    }).join('\n\n');

    const bh = kb.businessHours || {
        enabled: true,
        timezone: 'America/New_York',
        monFri: '9:00 AM – 5:00 PM',
        sat: '10:00 AM – 2:00 PM',
        sun: 'Closed'
    };

    const activeTz = kb.timezone || bh.timezone || 'America/New_York';
    let tzLabel = 'Eastern Time (ET)';
    if (activeTz === 'Asia/Kolkata') tzLabel = 'India Standard Time (IST)';
    else if (activeTz === 'America/Chicago') tzLabel = 'Central Time (CT)';
    else if (activeTz === 'America/Los_Angeles') tzLabel = 'Pacific Time (PT)';

    const rawPrompt = `# YOUTH ATHLETE UNIVERSITY (Y.A.U.) — VOICE AGENT OPERATING INSTRUCTIONS

## 🕒 LIVE CURRENT DATE & TIME (REAL-TIME CONTEXT)
The live current date and time right now is: **{{current_time_${activeTz}}}** (${tzLabel}).
Always evaluate this live timestamp to determine whether the call is taking place during standard business hours or after-hours.

## 1. IDENTITY, ROLE & MANDATORY PRONUNCIATION (CRITICAL)
You are a warm, enthusiastic, and knowledgeable team member representing Youth Athlete University (phonetic pronunciation: **"Why-Ay-You"** or **"Y. A. U."**). You speak directly with parents and families over the phone.

- **STRICT PRONUNCIATION & ENUNCIATION RULES (MANDATORY)**:
  1. **NEVER PRONOUNCE "YAU" AS A SINGLE BLENDED WORD** like "Yao", "Yowl", or "Yaw". It is strictly an acronym for Youth Athlete University.
  2. **ALWAYS pronounce the acronym as three distinct, separated letters**: **"Why - Ay - You"** (or speak the full name **"Youth Athlete University"**).
  3. **IN ALL YOUR TEXT AND SPEECH OUTPUTS**: Whenever referring to our organization's short name, ALWAYS format it with periods as **"Y.A.U."** or write out **"Youth Athlete University"**. NEVER output the raw letters "YAU" without punctuation, so the speech engine pronounces each individual letter distinctly every single time.
${personalityTraitsStr}

## 2. CONVERSATIONAL TONE RULES & SILENT TRANSFERS
${toneRulesStr}
- **SILENT TRANSFER RULE (STRICT)**: When transferring a caller, NEVER announce, read out, or recite phone number digits (e.g. do not say "I am transferring you to 1-800..." or "Calling 202-..."). Simply say the warm transfer script and execute the transfer tool directly in the background.
- **GOLDEN RULE**: ${kb.goldenRule || 'Every caller is a potential family for life.'}

---

## 3. LIVE BUSINESS HOURS & STRICT AFTER-HOURS GUARDRAILS (CRITICAL)
- **Live Operating Schedule (${tzLabel})**:
  - **Monday – Friday**: ${bh.monFri || '9:00 AM – 5:00 PM'}
  - **Saturday**: ${bh.sat || '10:00 AM – 2:00 PM'}
  - **Sunday**: ${bh.sun || 'Closed'}

- **AFTER-HOURS CALL HANDLING & TRANSFER RESTRICTION (MANDATORY)**:
  - Check the live current timestamp **{{current_time_${activeTz}}}**.
  - If the current time is **BEFORE 9:00 AM**, **AFTER 5:00 PM** (Monday–Friday), **BEFORE 10:00 AM** or **AFTER 2:00 PM** (Saturday), or anytime on **Sunday**:
    1. **STRICT TRANSFER GUARDRAIL**: **DO NOT INVOKE ANY TRANSFER TOOLS** (\`transfer_to_...\` or \`transfer_to_human\`). Our human staff are off-duty and cannot take live calls.
    2. **Acknowledge Closed Hours Immediately**:
       *"${kb.afterHoursScript || 'Thanks for calling Youth Athlete University! Our team is currently unavailable outside of our regular business hours (Monday through Friday 9:00 AM to 5:00 PM, and Saturday 10:00 AM to 2:00 PM Eastern). I would love to answer your questions about our sports programs, or I can take a message and have someone from our team reach out first thing tomorrow morning.'}"*
    3. **If the Caller Requests a Human Transfer / Staff Member During After-Hours**:
       - Politely explain that human staff are off for the day and unavailable for live transfers.
       - Transition directly to taking a message:
       *"Our staff are currently off for the day, but I can take your name and what you need help with right now, and our team will call you back first thing tomorrow morning!"*
    4. **Message Taking Protocol**:
       - Ask for the caller's **Name** and **what they need help with**. (Do NOT ask for their phone number since our system records their caller ID automatically).
       - Reassure them that our staff will review the message and follow up promptly.

---

## 4. UNATTENDED TRANSFER & VOICEMAIL MESSAGE PROTOCOL
- If you initiate a call transfer during open business hours and the department or team member does not answer (unattended / busy / unavailable):
  - Step in gracefully and say:
  - *"${kb.takeMessageScript || 'It looks like our team member is currently unavailable or on another line. No problem at all! Let me take a message for you. Go ahead and leave your name and what you need help with, and someone from our team will call you right back.'}"*
  - **IMPORTANT**: Do NOT ask for the caller's phone number because our system automatically captures their caller ID. Simply ask for their **name** and **what they need help with**.
  - Reassure them that our staff will review the message and call them back promptly.

---

## 5. ABOUT Y.A.U. — STORY, MISSION & DIFFERENTIATORS
- **Who We Are**: ${kb.organizationName || 'Youth Athlete University'} is a 501(c)(3) nonprofit organization located in Fort Washington, Maryland.
- **Motto**: "${kb.motto || 'Where Parents Trust Us. Kids Have Fun and Athletic Skills Improve.'}"
- **Core Belief**: ${kb.mission || 'Every child deserves access to quality sports that build character, confidence, and discipline.'}
- **What Sets Y.A.U. Apart**:
${differentiatorsStr}
- **Contact Info**: Email: ${kb.contactEmail || 'team@yausports.com'} | Web: ${kb.contactWebsite || 'youthathleteuniversity.org'}

---

## 6. SPORTS PROGRAMS & GRADE LEVEL RULES
Y.A.U. offers programs for children in **Kindergarten through 8th Grade**.
**CRITICAL RULE**: Teams are organized strictly by **GRADE LEVEL**, not age. If a parent mentions age, ask: *"Great! And what grade is your child in? We organize all our teams by grade level so kids are with their peers."*

${sportsStr}

---

## 7. PRACTICE LOCATIONS, SCHEDULES & EXPANSION
All evening practices run from **6:00 PM to 7:30 PM** across our DC metro locations:

| Location | Facility / School | Practice Days | Time |
| :--- | :--- | :--- | :--- |
${locationsTable}

- **Games & Weekends**: ${kb.gameSchedule || 'Games are held on Saturdays, with some Sunday afternoon games starting around 1:00 PM to respect church schedules.'}
- **If Caller is Outside These Areas**: Say: *"${kb.outOfAreaScript || 'We are actively growing! Let me take down your contact info so we can notify you when we open in your community.'}"*

---

## 8. PRICING & MEMBERSHIP OPTIONS
Always present recommended membership plans first as the best value for families:

${pricingStr}

### STRICT REFUND POLICY
- ${kb.refundPolicy || 'Youth Athlete University has a strict NO REFUND policy. NEVER promise a refund. Always connect to a human team member for special circumstance reviews.'}
- Refund Script: *"${kb.refundHandlingScript || 'Our standard policy is non-refundable, but let me connect you with one of our team members who can personally review your situation.'}"*

---

## 9. CALL FLOW SCRIPTS & CONVERSATION GUIDANCE
- **Opening**: *"${kb.inboundOpeningScript || 'Thank you for calling Youth Athlete University! This is Cimo — how can I help you and your athlete today?'}"*
- **Hesitant / Exploring**: *"${kb.hesitantCallerScript || 'No worries at all, take your time! I am happy to walk you through everything.'}"*
- **Positive Close**: *"${kb.positiveCloseScript || 'It was so wonderful speaking with you! We can not wait to welcome your athlete into the Youth Athlete University family.'}"*
- **Think About It Close**: *"${kb.thinkAboutItCloseScript || 'Take all the time you need! I can send our complete info packet to your email.'}"*
- **Voicemail Outreach Script**: *"${kb.voicemailScript || 'Hi, this message is from Youth Athlete University! Feel free to reach back out or I will try you again soon.'}"*

---

## 10. FREQUENTLY ASKED QUESTIONS
${faqsStr}

---

## 11. OBJECTION HANDLING GUIDELINES
${objectionsStr}

---

## 12. SPECIAL SITUATIONS & DEPARTMENT ROUTING RULES
- **Cancellation Requests**: *"${kb.cancellationHandlingScript || 'I am sorry to hear you are thinking of cancelling. Let me connect you with a team member who can help.'}"*
- **After-School Programs**: *"${kb.afterSchoolScript || 'After-school programs vary by school. Please check directly with your school front office or I can have our coordinator reach out.'}"*

### Department-Specific Transfer Routing:
Whenever a caller inquires about a specific topic during open business hours, route to the corresponding department:

${departmentRoutingLines}

### Immediate Human Transfer Triggers (DURING OPEN BUSINESS HOURS ONLY):
Politely initiate a transfer to a human team member for:
${triggersStr}

**Warm Transfer Script (NEVER recite phone numbers)**:
*"${kb.warmTransferScript || 'That is a great question and I want to make sure you get the exact right answer. Let me connect you with one of our team members right now — one moment please!'}"*

---

## 13. CALL CONTROL & TOOL EXECUTION RULES (CRITICAL)
- **Topic-Based Call Transfers (DURING OPEN BUSINESS HOURS ONLY)**:
  - First, check the live current timestamp **{{current_time_${activeTz}}}**.
  - **If AFTER-HOURS or CLOSED**: **DO NOT EXECUTE ANY TRANSFER TOOLS**. Explain the office is closed and take a message.
  - **If OPEN (During Business Hours)**: When the caller's request matches a specific department topic or explicitly asks for a human, speak the warm transfer script and **invoke the matching transfer tool** (e.g. \`transfer_to_...\` or \`transfer_to_human\`).
  - NEVER read phone numbers aloud.
- **Ending & Cancelling Calls (end_call)**:
  - Whenever the caller says goodbye, asks to hang up, says *"please cancel the call"*, *"hang up"*, *"cut the call"*, *"that is all"*, or indicates the conversation has finished:
  - Respond with a brief, friendly goodbye: *"${kb.positiveCloseScript || 'Thank you for calling Youth Athlete University! Have a wonderful day!'}"*
  - **IMMEDIATELY invoke the end_call tool** to terminate the phone call.
`;

    // Sanitize any remaining unpunctuated YAU instances to ensure TTS spells each letter individually
    return rawPrompt
        .replace(/\bYAU\b/g, 'Y.A.U.')
        .replace(/\bY-A-U\b/g, 'Y.A.U.');
}

/**
 * Gets the Retell API Key from DB or Environment
 */
function getRetellApiKey() {
    return process.env.RETELL_API_KEY || null;
}

/**
 * Gets the Retell Agent ID strictly from Environment Variables
 */
function getRetellAgentId() {
    return process.env.RETELL_AGENT_ID || 'agent_1c01375d88b99ba36b050ef0f8';
}

/**
 * Fetches the agent details from Retell AI REST API
 */
export async function getRetellAgentDetails(agentId) {
    const apiKey = getRetellApiKey();
    if (!apiKey) {
        throw new Error('RETELL_API_KEY is not configured in backend environment.');
    }

    try {
        // Try GET /get-agent/{agent_id} or /agents/{agent_id}
        const res = await axios.get(`${RETELL_API_BASE}/get-agent/${agentId}`, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        }).catch(() => {
            return axios.get(`${RETELL_API_BASE}/agents/${agentId}`, {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
        });

        return res.data;
    } catch (err) {
        console.error('[Retell Service] Failed to fetch agent details:', err.response?.data || err.message);
        throw new Error(err.response?.data?.message || err.message);
    }
}

/**
 * Syncs the KnowledgeBase document to Retell AI Agent prompt & tools via Retell REST API
 */
export async function syncKnowledgeBaseToRetell(kbParam) {
    const apiKey = getRetellApiKey();
    const agentId = getRetellAgentId();

    if (!apiKey) {
        throw new Error('RETELL_API_KEY is not configured in environment variables.');
    }

    if (!agentId) {
        throw new Error('Retell Agent ID is not configured.');
    }

    let kb = kbParam;
    if (!kb) {
        kb = await RetellKnowledgeBase.findOne();
        if (!kb) {
            kb = await RetellKnowledgeBase.create({});
        }
    }

    const compiledPrompt = buildPromptFromKnowledgeBase(kb);
    const welcomeMsg = kb.welcomeMessage || 'Thank you for calling Youth Athlete University! This is Cimo — how can I help you and your athlete today?';
    const transferNumber = kb.humanTransferPhone || process.env.RETELL_TRANSFER_NUMBER || '+12027013900';

    // Build dynamic transfer_call tools for each department
    const departments = (kb.transferDepartments && kb.transferDepartments.length > 0)
        ? kb.transferDepartments
        : [
            {
                departmentName: 'Executive Management & Escalations',
                phoneNumber: '+12027013900',
                triggers: 'Director requests, management escalations, serious complaints, special circumstance reviews',
                transferType: 'warm_transfer',
                onHoldMusic: 'ringtone'
            },
            {
                departmentName: 'Program Coordination & Support',
                phoneNumber: '+12023413778',
                triggers: 'Registration questions, scheduling details, program coordinator requests, team assignments',
                transferType: 'warm_transfer',
                onHoldMusic: 'ringtone'
            }
        ];

    const transferTools = departments.map((dept, idx) => {
        const toolName = getSanitizedToolName(dept.departmentName, idx);
        const isWarm = dept.transferType === 'warm_transfer';
        const transferOption = isWarm
            ? {
                type: 'warm_transfer',
                on_hold_music: dept.onHoldMusic || 'ringtone',
                enable_bridge_audio_cue: true
            }
            : {
                type: 'cold_transfer'
            };

        return {
            type: 'transfer_call',
            name: toolName,
            description: `Transfer call to ${dept.departmentName}. ONLY execute this tool during live business hours (Mon-Fri 9:00 AM-5:00 PM, Sat 10:00 AM-2:00 PM Eastern). DO NOT invoke during after-hours or on Sundays when the office is closed. Triggers: ${dept.triggers || 'department requests'}.`,
            transfer_destination: {
                type: 'predefined',
                number: dept.phoneNumber || transferNumber
            },
            transfer_option: transferOption
        };
    });

    // Also include general fallback transfer tool
    if (!transferTools.some(t => t.name === 'transfer_to_human')) {
        transferTools.push({
            type: 'transfer_call',
            name: 'transfer_to_human',
            description: 'Transfer the call to a live staff member. ONLY execute this tool during live business hours (Mon-Fri 9:00 AM-5:00 PM, Sat 10:00 AM-2:00 PM Eastern). DO NOT invoke during after-hours or on Sundays when the office is closed.',
            transfer_destination: {
                type: 'predefined',
                number: transferNumber
            },
            transfer_option: {
                type: 'warm_transfer',
                on_hold_music: 'ringtone',
                enable_bridge_audio_cue: true
            }
        });
    }

    const generalTools = [
        ...transferTools,
        {
            type: 'end_call',
            name: 'end_call',
            description: 'End or hang up the call when the user says goodbye, asks to hang up, cancel the call, or when the conversation is finished.'
        }
    ];

    let llmId = process.env.RETELL_LLM_ID || null;
    let agentDetails = null;
    let targetVersion = 1;

    try {
        agentDetails = await getRetellAgentDetails(agentId);
        targetVersion = agentDetails?.version || 1;
        if (agentDetails?.response_engine?.llm_id) {
            llmId = agentDetails.response_engine.llm_id;
        }
    } catch (agentFetchErr) {
        console.warn('[Retell Service] Warning: Could not fetch agent details:', agentFetchErr.message);
    }

    let responseData = {};
    let syncError = null;

    // 1. If agent is currently published, create a new draft version first so the LLM becomes editable
    if (agentDetails?.is_published) {
        try {
            console.log(`[Retell Service] Agent is published at version ${targetVersion}. Creating draft version from base_version ${targetVersion}...`);
            const createVerRes = await axios.post(
                `${RETELL_API_BASE}/create-agent-version/${agentId}`,
                { base_version: targetVersion },
                {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            if (createVerRes?.data?.version) {
                targetVersion = createVerRes.data.version;
                agentDetails = createVerRes.data;
                if (createVerRes.data.response_engine?.llm_id) {
                    llmId = createVerRes.data.response_engine.llm_id;
                }
                console.log(`✅ [Retell Service] Created draft agent version ${targetVersion} with LLM ${llmId}`);
            }
        } catch (createErr) {
            console.log('[Retell Service] Note on create-agent-version:', createErr.response?.data?.message || createErr.message);
        }
    }

    // 2. Update Retell LLM (Prompt, Begin Message, General Tools including Transfer & End Call)
    if (llmId) {
        try {
            console.log(`[Retell Service] Updating Retell LLM (${llmId}) with tools: transfer_call -> ${transferNumber}, end_call`);
            const llmRes = await axios.patch(
                `${RETELL_API_BASE}/update-retell-llm/${llmId}`,
                {
                    general_prompt: compiledPrompt,
                    begin_message: welcomeMsg,
                    general_tools: generalTools,
                    start_speaker: 'agent'
                },
                {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            responseData.llm = llmRes.data;
            console.log(`✅ [Retell Service] Successfully updated Retell LLM (${llmId})`);
        } catch (llmErr) {
            syncError = llmErr.response?.data?.message || llmErr.message;
            console.error('[Retell Service] LLM Update error:', syncError);
        }
    }

    // 3. Update Retell Agent (Agent Name, Voice ID, Speech Tuning & Pronunciation Dictionary)
    try {
        const selectedVoiceId = kb.voiceId || '11labs-Lily';
        const agentUpdatePayload = {
            agent_name: kb.agentName ? `YAU Support Agent (${kb.agentName})` : 'YAU Support Agent',
            voice_id: selectedVoiceId,
            voice_temperature: 1.0,
            voice_speed: 1.0,
            responsiveness: 1.0,
            interruption_sensitivity: 0.8,
            enable_backchannel: true,
            backchannel_frequency: 0.8,
            backchannel_words: ['yeah', 'uh-huh', 'got it', 'okay', 'sure'],
            pronunciation_dictionary: [
                {
                    word: 'YAU',
                    alphabet: 'ipa',
                    phoneme: 'waɪ eɪ juː'
                },
                {
                    word: 'yau',
                    alphabet: 'ipa',
                    phoneme: 'waɪ eɪ juː'
                },
                {
                    word: 'Yau',
                    alphabet: 'ipa',
                    phoneme: 'waɪ eɪ juː'
                },
                {
                    word: 'Y.A.U.',
                    alphabet: 'ipa',
                    phoneme: 'waɪ eɪ juː'
                },
                {
                    word: 'Y-A-U',
                    alphabet: 'ipa',
                    phoneme: 'waɪ eɪ juː'
                }
            ]
        };

        // Resolve active Webhook URL based on environment setting
        let resolvedWebhookUrl = 'https://api.yauapp.com/api/retell/webhook';
        if (process.env.NODE_ENV === 'production' || kb.webhookEnvironment === 'production') {
            resolvedWebhookUrl = process.env.RETELL_WEBHOOK_URL || 'https://api.yauapp.com/api/retell/webhook';
        } else if (kb.webhookEnvironment === 'development' || kb.webhookEnvironment === 'custom') {
            resolvedWebhookUrl = kb.customWebhookUrl || kb.webhookUrl || resolvedWebhookUrl;
        } else {
            resolvedWebhookUrl = process.env.RETELL_WEBHOOK_URL || 'https://api.yauapp.com/api/retell/webhook';
        }

        if (resolvedWebhookUrl) {
            agentUpdatePayload.webhook_url = resolvedWebhookUrl.trim();
        }

        console.log(`[Retell Service] Updating Agent settings: Voice ID=${selectedVoiceId}, Webhook=${agentUpdatePayload.webhook_url || 'Default'}`);
        const agentRes = await axios.patch(
            `${RETELL_API_BASE}/update-agent/${agentId}`,
            agentUpdatePayload,
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        responseData.agent = agentRes?.data;
    } catch (agentErr) {
        if (!syncError) {
            syncError = agentErr.response?.data?.message || agentErr.message;
        }
        console.error('[Retell Service] Agent Update error:', agentErr.response?.data || agentErr.message);
    }

    // 4. Publish Agent Version so live phone calls use the latest prompt and tools
    let publishedVersion = targetVersion;
    try {
        console.log(`[Retell Service] Publishing agent version ${targetVersion}...`);
        const pubRes = await axios.post(
            `${RETELL_API_BASE}/publish-agent-version/${agentId}`,
            { 
                version: targetVersion,
                version_description: `Updated from YAU-CRM Knowledge Base at ${new Date().toISOString()}`
            },
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        publishedVersion = pubRes?.data?.version || targetVersion;
        console.log(`✅ [Retell Service] Successfully published agent version ${publishedVersion}`);
    } catch (pubErr) {
        console.warn('[Retell Service] Note on publish-agent-version:', pubErr.response?.data?.message || pubErr.message);
    }

    // 5. Update Phone Number to bind to the latest agent / version
    const phoneNumber = kb.phoneNumber || process.env.RETELL_PHONE_NUMBER || '+18886879139';
    if (phoneNumber) {
        try {
            const cleanPhone = encodeURIComponent(phoneNumber.trim());
            console.log(`[Retell Service] Binding phone number ${phoneNumber} to agent ${agentId} (version: ${publishedVersion})...`);
            
            const agentEntry = {
                agent_id: agentId,
                weight: 1
            };
            if (publishedVersion) {
                agentEntry.agent_version = publishedVersion;
            }

            const phonePayload = {
                inbound_agents: [agentEntry]
            };
            if (transferNumber) {
                phonePayload.fallback_destination_number = transferNumber;
            }

            await axios.patch(
                `${RETELL_API_BASE}/update-phone-number/${cleanPhone}`,
                phonePayload,
                {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            ).catch(async () => {
                // Fallback to unencoded path if needed
                return axios.patch(
                    `${RETELL_API_BASE}/phone-numbers/${cleanPhone}`,
                    phonePayload,
                    {
                        headers: {
                            Authorization: `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
            });
            console.log(`✅ [Retell Service] Successfully bound phone number ${phoneNumber} to agent version ${publishedVersion || 'latest'}`);
        } catch (phoneErr) {
            console.warn('[Retell Service] Warning: Failed to update phone number binding:', phoneErr.response?.data?.message || phoneErr.message);
        }
    }

    if (syncError) {
        kb.lastSyncStatus = 'failed';
        kb.lastSyncMessage = syncError;
        await kb.save();
        throw new Error(syncError);
    }

    kb.lastSyncedAt = new Date();
    kb.lastSyncStatus = 'success';
    kb.lastSyncMessage = `Successfully synced & published prompt v${publishedVersion || ''} (Transfer: ${transferNumber})`;
    await kb.save();

    return {
        success: true,
        agentId,
        llmId,
        publishedVersion,
        transferNumber,
        lastSyncedAt: kb.lastSyncedAt,
        data: responseData
    };
}

/**
 * Fetches call details directly from Retell AI REST API
 * @param {string} callId - Retell call ID
 */
export async function getRetellCallDetails(callId) {
    const apiKey = getRetellApiKey();
    if (!apiKey || !callId) return null;

    try {
        const res = await axios.get(`${RETELL_API_BASE}/get-call/${callId}`, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        }).catch(async () => {
            return axios.get(`${RETELL_API_BASE}/v2/get-call/${callId}`, {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
        });

        return res.data || null;
    } catch (err) {
        console.warn(`[Retell Service] Could not fetch call ${callId} details:`, err.response?.data?.message || err.message);
        return null;
    }
}

export default {
    buildPromptFromKnowledgeBase,
    getRetellAgentDetails,
    syncKnowledgeBaseToRetell,
    getRetellCallDetails
};
