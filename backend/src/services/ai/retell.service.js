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
                departmentName: 'Executive Management / Escalations',
                phoneNumber: kb.humanTransferPhone || '+18002930354',
                triggers: 'Director requests, serious complaints, special circumstance reviews',
                transferType: 'cold_transfer'
            }
        ];

    const departmentRoutingLines = departments.map((dept, i) => {
        const toolName = getSanitizedToolName(dept.departmentName, i);
        return `- **${dept.departmentName}** (Tool: \`${toolName}\` | Phone: ${dept.phoneNumber || kb.humanTransferPhone || '+18002930354'}):\n  - **Topic / Triggers**: ${dept.triggers || 'General department requests'}\n  - **Action**: Speak warm transfer script and invoke tool \`${toolName}\`.`;
    }).join('\n\n');

    return `# YOUTH ATHLETE UNIVERSITY (YAU) — VOICE AGENT OPERATING INSTRUCTIONS

## 1. IDENTITY, ROLE & MANDATORY PRONUNCIATION
You are a warm, enthusiastic, and knowledgeable team member representing Youth Athlete University (Y-A-U). You speak directly with parents and families over the phone.
- **CRITICAL PRONUNCIATION INSTRUCTION**: Whenever you mention or speak the acronym "YAU", ALWAYS pronounce it as three distinct, separate letters: **"Y - A - U"** (Why-Ay-You) or say the full name **"Youth Athlete University"**. NEVER pronounce "YAU" as a single blended word like "YOWL" or "Yaw". In your text output, format it as **Y-A-U** so the speech synthesizer articulates each individual letter clearly.
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
Always present recommended membership plans first as the best value for families:

${pricingStr}

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

## 10. SPECIAL SITUATIONS & DEPARTMENT ROUTING RULES
- **Cancellation Requests**: *"${kb.cancellationHandlingScript || 'I am sorry to hear you are thinking of cancelling. Let me connect you with a team member who can help.'}"*
- **After-School Programs**: *"${kb.afterSchoolScript || 'After-school programs vary by school. Please check directly with your school front office or I can have our coordinator reach out.'}"*

### Department-Specific Transfer Routing:
Whenever a caller inquires about a specific topic, route to the corresponding department:

${departmentRoutingLines}

### Immediate Human Transfer Triggers:
Politely initiate a transfer to a human team member for:
${triggersStr}

**Warm Transfer Script**:
*"${kb.warmTransferScript || 'That is a great question and I want to make sure you get the exact right answer. Let me connect you with one of our team members right now — one moment please!'}"*

---

## 11. CALL CONTROL & TOOL EXECUTION RULES (CRITICAL)
- **Topic-Based Call Transfers**:
  - When the caller's request matches a specific department topic above, speak the warm transfer script and **immediately invoke the matching transfer tool** (e.g. \`transfer_to_...\`).
  - If the caller explicitly asks for a live human agent without a specific department, invoke \`transfer_to_human\`.
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
    const transferNumber = kb.humanTransferPhone || process.env.RETELL_TRANSFER_NUMBER || '+18002930354';

    // Build dynamic transfer_call tools for each department
    const departments = (kb.transferDepartments && kb.transferDepartments.length > 0)
        ? kb.transferDepartments
        : [
            {
                departmentName: 'Executive Management / Escalations',
                phoneNumber: transferNumber,
                triggers: 'Director requests, serious complaints, special circumstance reviews',
                transferType: 'cold_transfer'
            }
        ];

    const transferTools = departments.map((dept, idx) => {
        const toolName = getSanitizedToolName(dept.departmentName, idx);
        const isWarm = dept.transferType === 'warm_transfer';
        const transferOption = isWarm
            ? {
                type: 'warm_transfer',
                on_hold_music: dept.onHoldMusic || 'relaxing_sound',
                enable_bridge_audio_cue: true
            }
            : {
                type: 'cold_transfer'
            };

        return {
            type: 'transfer_call',
            name: toolName,
            description: `Transfer call to ${dept.departmentName} when caller discusses: ${dept.triggers || 'department requests'}.`,
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
            description: 'Transfer the call to a live human representative or staff member when requested by the caller.',
            transfer_destination: {
                type: 'predefined',
                number: transferNumber
            },
            transfer_option: {
                type: 'warm_transfer',
                on_hold_music: 'relaxing_sound',
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

    // 3. Update Retell Agent (Agent Name, Metadata & Pronunciation Dictionary)
    try {
        const agentUpdatePayload = {
            agent_name: kb.agentName ? `YAU Support Agent (${kb.agentName})` : 'YAU Support Agent',
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
                }
            ]
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

export default {
    buildPromptFromKnowledgeBase,
    getRetellAgentDetails,
    syncKnowledgeBaseToRetell
};
