import api from './api';

export interface SportsProgram {
    name: string;
    emoji: string;
    grades: string;
    description: string;
}

export interface LocationItem {
    name: string;
    school: string;
    practiceDays: string;
    practiceTime: string;
}

export interface FAQItem {
    question: string;
    answer: string;
}

export interface ObjectionItem {
    trigger: string;
    response: string;
}

export interface PricingPlanItem {
    name: string;
    price: number;
    interval: string;
    isRecommended: boolean;
    includes: string;
}

export interface TransferDepartmentItem {
    departmentName: string;
    phoneNumber: string;
    triggers: string;
    transferType?: 'cold_transfer' | 'warm_transfer';
}

export interface RetellKnowledgeBaseData {
    agentName: string;
    phoneNumber: string;
    welcomeMessage: string;

    personalityTraits: string[];
    toneRules: string[];
    goldenRule: string;

    organizationName: string;
    motto: string;
    mission: string;
    differentiators: string[];
    contactPhone: string;
    contactEmail: string;
    contactWebsite: string;

    sportsPrograms: SportsProgram[];
    locations: LocationItem[];
    gameSchedule: string;
    outOfAreaScript: string;

    pricingPlans?: PricingPlanItem[];
    monthlyPrice?: number;
    seasonalPrice?: number;
    monthlyIncludes?: string;
    seasonalIncludes?: string;
    refundPolicy: string;
    refundHandlingScript?: string;

    inboundOpeningScript: string;
    hesitantCallerScript: string;
    positiveCloseScript: string;
    thinkAboutItCloseScript: string;
    voicemailScript: string;
    warmTransferScript: string;
    cancellationHandlingScript?: string;
    afterSchoolScript?: string;

    faqs: FAQItem[];
    objections: ObjectionItem[];

    humanTransferPhone: string;
    humanTransferTriggers: string[];
    transferDepartments?: TransferDepartmentItem[];

    lastSyncedAt?: string;
    lastSyncStatus?: 'success' | 'failed' | 'never';
    lastSyncMessage?: string;
}

export interface AgentStatusResponse {
    success: boolean;
    agentId: string;
    phoneNumber: string;
    lastSyncedAt: string | null;
    lastSyncStatus: string;
    lastSyncMessage: string | null;
    hasApiKey: boolean;
    isConnected: boolean;
    liveAgent?: any;
}

export const getKnowledgeBase = async () => {
    const res = await api.get<{ success: boolean; knowledgeBase: RetellKnowledgeBaseData; compiledPrompt: string }>('/retell/knowledge-base');
    return res.data;
};

export const updateKnowledgeBase = async (data: Partial<RetellKnowledgeBaseData>) => {
    const res = await api.put<{ success: boolean; message: string; knowledgeBase: RetellKnowledgeBaseData; compiledPrompt: string }>('/retell/knowledge-base', data);
    return res.data;
};

export const syncToRetell = async () => {
    const res = await api.post<{ success: boolean; message: string; lastSyncedAt: string }>('/retell/sync');
    return res.data;
};

export const getRetellAgentStatus = async () => {
    const res = await api.get<AgentStatusResponse>('/retell/agent-status');
    return res.data;
};

export default {
    getKnowledgeBase,
    updateKnowledgeBase,
    syncToRetell,
    getRetellAgentStatus
};
