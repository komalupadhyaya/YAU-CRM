import api from './api';

export interface RetellConfig {
    enabled: boolean;
    agentId: string;
    llmId: string;
    knowledgeBase: string;
    transferNumber: string;
    retellPhoneNumber: string;
}

export interface RetellCallItem {
    _id: string;
    callSid: string;
    retellCallId: string;
    direction: 'inbound' | 'outbound';
    fromNumber: string;
    toNumber: string;
    duration: number;
    recordingUrl?: string;
    status: string;
    timestamp: string;
    aiHandled: boolean;
    transcript?: string;
    callSummary?: string;
    userSentiment?: 'positive' | 'neutral' | 'negative' | null;
    lead_id?: { _id: string; name: string } | null;
}

/**
 * Fetch Retell Configuration
 */
export async function getRetellConfig(): Promise<RetellConfig> {
    const response = await api.get('/retell/config');
    return response.data.config;
}

/**
 * Update Retell Configuration and LLM system prompt
 */
export async function updateRetellConfig(data: Partial<RetellConfig>): Promise<{ success: boolean; config: RetellConfig; warning?: string }> {
    const response = await api.put('/retell/config', data);
    return response.data;
}

/**
 * Fetch list of AI Handled calls
 */
export async function getRetellCalls(): Promise<RetellCallItem[]> {
    const response = await api.get('/retell/calls');
    return response.data.calls;
}

export default {
    getRetellConfig,
    updateRetellConfig,
    getRetellCalls
};
