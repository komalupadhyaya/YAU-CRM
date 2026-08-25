import axios from 'axios';
import RetellKnowledgeBase from '../../models/retellKnowledgeBase.model.js';

const RETELL_API_BASE = 'https://api.retellai.com';

/**
 * Builds the complete Markdown Universal Prompt from the database Knowledge Base model.
 *
 * @param {Object} kb - RetellKnowledgeBase document
 * @returns {string} - Full Markdown prompt
 */
export function buildPromptFromKnowledgeBase(kb) {
    const personalityTraitsStr = (kb.personalityTraits || [])
        .map(t => `- **${t}**`)
        .join('\n');

    const toneRulesStr = (kb.toneRules || [])
        .map(r => `- ${r}`)
        .join('\n');

    const differentiatorsStr = (kb.differentiators || [])
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

    return `# YOUTH ATHLETE UNIVERSITY (YAU) — VOICE AGENT OPERATING INSTRUCTIONS

## 1. IDENTITY, ROLE & PERSONALITY
You are a warm, enthusiastic, and knowledgeable team member representing Youth Athlete University (YAU). You speak directly with parents and families over the phone.
${personalityTraitsStr}

## 2. CONVERSATIONAL TONE RULES
${toneRulesStr}
- **GOLDEN RULE**: ${kb.goldenRule || 'Every caller is a potential family for life.'}

---

## 3. ABOUT YAU — STORY, MISSION & DIFFERENTIATORS
- **Who We Are**: ${kb.organizationName || 'Youth Athlete University'} is a 501(c)(3) nonprofit organization located in Fort Washington, Maryland.
- **Motto**: "${kb.motto || 'Where Parents Trust Us. Kids Have Fun and Athletic Skills Improve.'}"
- **Core Belief**: ${kb.mission || 'Every child deserves access to quality sports that build character, confidence, and discipline.'}
- **What Sets YAU Apart**:
${differentiatorsStr}
- **Contact Info**: Phone: ${kb.contactPhone || '1-800-293-0354'} | Email: ${kb.contactEmail || 'team@yausports.com'} | Web: ${kb.contactWebsite || 'youthathleteuniversity.org'}

---

## 4. SPORTS PROGRAMS & GRADE LEVEL RULES
YAU offers programs for children in **Kindergarten through 8th Grade**.
**CRITICAL RULE**: Teams are organized strictly by **GRADE LEVEL**, not age. If a parent mentions age, ask: *"Great! And what grade is your child in? We organize all our teams by grade level so kids are with their peers."*

${sportsStr}

---

## 5. PRACTICE LOCATIONS, SCHEDULES & EXPANSION
All evening practices run from **6:00 PM to 7:30 PM** across our DC metro locations:

| Location | Facility / School | Practice Days | Time |
| :--- | :--- | :--- | :--- |
${locationsTable}

- **Games & Weekends**: ${kb.gameSchedule || 'Games are held on Saturdays, with some Sunday afternoon games starting around 1:00 PM to respect church schedules.'}
- **If Caller is Outside These Areas**: Say: *"${kb.outOfAreaScript || 'We are actively growing! Let me take down your contact info so we can notify you when we open in your community.'}"*

---

## 6. PRICING & MEMBERSHIP OPTIONS
Always present the **Monthly Membership** first as the best value:

1. **Monthly Membership — $${kb.monthlyPrice || 50} / month (Recommended)**:
   - ${kb.monthlyIncludes || 'All 4 sports — rotate anytime. No re-registration fees.'}
   - Uniforms are purchased separately.
   - *Key Talking Point*: "For just $${kb.monthlyPrice || 50} a month, your child can try soccer, switch over to basketball, and do flag football — all without paying registration fees again."

2. **Seasonal Fee — $${kb.seasonalPrice || 200} / season**:
   - ${kb.seasonalIncludes || 'Covers one specific sport for 3–4 months. Uniform included.'}

### STRICT REFUND POLICY
- ${kb.refundPolicy || 'YAU has a strict NO REFUND policy. NEVER promise a refund. Always connect to a human team member for special circumstance reviews.'}
- Refund Script: *"${kb.refundHandlingScript || 'Our standard policy is non-refundable, but let me connect you with one of our team members who can personally review your situation.'}"*

---

## 7. CALL FLOW SCRIPTS & CONVERSATION GUIDANCE
- **Opening**: *"${kb.inboundOpeningScript || 'Thank you for calling Youth Athlete University! This is Cimo — how can I help you and your athlete today?'}"*
- **Hesitant / Exploring**: *"${kb.hesitantCallerScript || 'No worries at all, take your time! I am happy to walk you through everything.'}"*
- **Positive Close**: *"${kb.positiveCloseScript || 'It was so wonderful speaking with you! We can not wait to welcome your athlete into the YAU family.'}"*
- **Think About It Close**: *"${kb.thinkAboutItCloseScript || 'Take all the time you need! I can send our complete info packet to your email.'}"*
- **Voicemail Script**: *"${kb.voicemailScript || 'Hi, this message is from Youth Athlete University! Feel free to give us a call back at 1-800-293-0354.'}"*

---

## 8. FREQUENTLY ASKED QUESTIONS
${faqsStr}

---

## 9. OBJECTION HANDLING GUIDELINES
${objectionsStr}

---

## 10. SPECIAL SITUATIONS & ESCALATION RULES
- **Cancellation Requests**: *"${kb.cancellationHandlingScript || 'I am sorry to hear you are thinking of cancelling. Let me connect you with a team member who can help.'}"*
- **After-School Programs**: *"${kb.afterSchoolScript || 'After-school programs vary by school. Please check directly with your school front office or I can have our coordinator reach out.'}"*

### Immediate Human Transfer Triggers:
Politly initiate a transfer to a human team member for:
${triggersStr}

**Warm Transfer Script**:
*"${kb.warmTransferScript || 'That is a great question and I want to make sure you get the exact right answer. Let me connect you with one of our team members right now — one moment please!'}"*

---

## 11. CALL CONTROL & TOOL EXECUTION RULES (CRITICAL)
- **Transfer to Human Representative (transfer_to_human)**:
  - Whenever the caller explicitly asks to speak to a real person, human representative, live agent, or coach, OR if any of the Immediate Human Transfer Triggers occur:
  - Say your warm transfer script politely: *"${kb.warmTransferScript || 'That is a great question and I want to make sure you get the exact right answer. Let me connect you with one of our team members right now — one moment please!'}"*
  - **IMMEDIATELY invoke the transfer_to_human tool** to transfer the live phone call to our team member.
- **Ending & Cancelling Calls (end_call)**:
  - Whenever the caller says goodbye, asks to hang up, says *"please cancel the call"*, *"hang up"*, *"cut the call"*, *"that is all"*, or indicates the conversation has finished:
  - Respond with a brief, friendly goodbye: *"${kb.positiveCloseScript || 'Thank you for calling Youth Athlete University! Have a wonderful day!'}"*
  - **IMMEDIATELY invoke the end_call tool** to terminate the phone call.
`;
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
export async function syncKnowledgeBaseToRetell(kb) {
    const apiKey = getRetellApiKey();
    const agentId = getRetellAgentId();

    if (!apiKey) {
        throw new Error('RETELL_API_KEY is not configured in environment variables.');
    }

    if (!agentId) {
        throw new Error('Retell Agent ID is not configured.');
    }

    const compiledPrompt = buildPromptFromKnowledgeBase(kb);
    const welcomeMsg = kb.welcomeMessage || 'Thank you for calling Youth Athlete University! This is Cimo — how can I help you and your athlete today?';
    const transferNumber = kb.humanTransferPhone || process.env.RETELL_TRANSFER_NUMBER || '+919896233745';

    // Built-in tools for call forwarding and hangup
    const generalTools = [
        {
            type: 'transfer_call',
            name: 'transfer_to_human',
            description: 'Transfer the call to a live human representative or staff member when requested by the caller, or for refund requests, cancellations, complaints, or questions beyond AI scope.',
            transfer_destination: {
                type: 'predefined',
                number: transferNumber
            },
            transfer_option: {
                type: 'cold_transfer'
            }
        },
        {
            type: 'end_call',
            name: 'end_call',
            description: 'End or hang up the call when the user says goodbye, asks to hang up, cancel the call, or when the conversation is finished.'
        }
    ];

    let llmId = process.env.RETELL_LLM_ID || null;
    let agentDetails = null;

    try {
        agentDetails = await getRetellAgentDetails(agentId);
        if (agentDetails?.response_engine?.llm_id) {
            llmId = agentDetails.response_engine.llm_id;
        }
    } catch (agentFetchErr) {
        console.warn('[Retell Service] Warning: Could not fetch agent details:', agentFetchErr.message);
    }

    let responseData = {};
    let syncError = null;

    // 1. Update Retell LLM (Prompt, Begin Message, General Tools including Transfer & End Call)
    if (llmId) {
        try {
            console.log(`[Retell Service] Updating Retell LLM (${llmId}) with tools: transfer_call -> ${transferNumber}, end_call`);
            const llmRes = await axios.patch(
                `${RETELL_API_BASE}/update-retell-llm/${llmId}`,
                {
                    general_prompt: compiledPrompt,
                    begin_message: welcomeMsg,
                    general_tools: generalTools
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

    // 2. Update Retell Agent (Agent Name & Metadata)
    try {
        const agentUpdatePayload = {
            agent_name: kb.agentName ? `YAU Support Agent (${kb.agentName})` : 'YAU Support Agent'
        };

        const agentRes = await axios.patch(
            `${RETELL_API_BASE}/update-agent/${agentId}`,
            agentUpdatePayload,
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        ).catch(() => {
            return axios.patch(
                `${RETELL_API_BASE}/agents/${agentId}`,
                agentUpdatePayload,
                {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
        });

        responseData.agent = agentRes?.data;
    } catch (agentErr) {
        if (!syncError) {
            syncError = agentErr.response?.data?.message || agentErr.message;
        }
        console.error('[Retell Service] Agent Update error:', agentErr.response?.data || agentErr.message);
    }

    // 3. Publish Agent Version so live phone calls use the latest prompt and tools
    let publishedVersion = null;
    try {
        const latestAgent = await getRetellAgentDetails(agentId);
        const currentVersion = latestAgent?.version || 1;
        console.log(`[Retell Service] Publishing agent version ${currentVersion}...`);
        await axios.post(
            `${RETELL_API_BASE}/publish-agent-version/${agentId}`,
            { version: currentVersion },
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        publishedVersion = currentVersion;
        console.log(`✅ [Retell Service] Successfully published agent version ${publishedVersion}`);
    } catch (pubErr) {
        console.warn('[Retell Service] Warning: Failed to publish agent version:', pubErr.response?.data || pubErr.message);
    }

    // 4. Update Phone Number to bind to the latest published agent version
    const phoneNumber = kb.phoneNumber || process.env.RETELL_PHONE_NUMBER || '+18886879139';
    if (phoneNumber && publishedVersion) {
        try {
            const cleanPhone = encodeURIComponent(phoneNumber.trim());
            console.log(`[Retell Service] Binding phone number ${phoneNumber} to agent ${agentId} v${publishedVersion}...`);
            await axios.patch(
                `${RETELL_API_BASE}/update-phone-number/${cleanPhone}`,
                {
                    inbound_agents: [
                        {
                            agent_id: agentId,
                            agent_version: publishedVersion,
                            weight: 1
                        }
                    ]
                },
                {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log(`✅ [Retell Service] Successfully bound phone number to agent version ${publishedVersion}`);
        } catch (phoneErr) {
            console.warn('[Retell Service] Warning: Failed to update phone number binding:', phoneErr.response?.data || phoneErr.message);
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

export default {
    buildPromptFromKnowledgeBase,
    getRetellAgentDetails,
    syncKnowledgeBaseToRetell
};
