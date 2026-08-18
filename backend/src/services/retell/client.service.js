import Retell from 'retell-sdk';

let retellClient = null;

export function getRetellClient() {
    if (!retellClient) {
        const apiKey = process.env.RETELL_API_KEY;
        if (!apiKey) {
            console.error('⚠️ RETELL_API_KEY is not configured in the environment.');
            return null;
        }
        retellClient = new Retell({ apiKey });
    }
    return retellClient;
}

/**
 * Updates the prompt/knowledge base of the Retell LLM/Agent.
 * We fetch the LLM configuration and update its system prompt.
 * 
 * @param {string} agentId The Retell Agent ID
 * @param {string} systemPrompt The fully formatted system prompt including YAU context and rules
 * @returns {Promise<any>}
 */
export async function updateAgentPrompt(agentId, systemPrompt) {
    const client = getRetellClient();
    if (!client) throw new Error('Retell client is not initialized.');

    // Fetch the agent details to locate its LLM ID
    const agent = await client.agent.retrieve(agentId);
    if (!agent || !agent.response_engine) {
        throw new Error(`Failed to retrieve agent configuration for Agent ID: ${agentId}`);
    }

    const responseEngine = agent.response_engine;
    
    // In Retell API V2, custom LLM or LLM updates are done via the response engine.
    // If it's a retell-llm type, we can update the LLM prompt.
    if (responseEngine.type === 'retell-llm' && responseEngine.llm_id) {
        console.log(`📡 Updating Retell LLM: ${responseEngine.llm_id} with new system prompt...`);
        
        // Retell Node SDK updates LLM via client.llm.update
        // Standard endpoint: PATCH /update-retell-llm/{llm_id}
        await client.llm.update(responseEngine.llm_id, {
            general_prompt: systemPrompt
        });
        
        console.log('✅ Retell LLM system prompt successfully updated.');
        return { success: true, llmId: responseEngine.llm_id };
    } else {
        throw new Error(`Agent response engine type is "${responseEngine.type}" and cannot be updated programmatically. Retell LLM is required.`);
    }
}

/**
 * Fetches the transcript and summary details of a specific Retell call.
 * 
 * @param {string} retellCallId The call ID from Retell
 * @returns {Promise<any>}
 */
export async function getCallDetails(retellCallId) {
    const client = getRetellClient();
    if (!client) return null;
    
    try {
        const call = await client.call.retrieve(retellCallId);
        return call;
    } catch (err) {
        console.error(`⚠️ Failed to fetch Retell call details for ${retellCallId}:`, err.message);
        return null;
    }
}

export default {
    getRetellClient,
    updateAgentPrompt,
    getCallDetails
};
