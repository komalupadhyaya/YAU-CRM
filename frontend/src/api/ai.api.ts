import api from './api';

export interface AiScore {
    score: 'Hot' | 'Warm' | 'Cold';
    reason: string;
    scoreUpdated?: string;
    isManualOverride?: boolean;
}

export interface StalledInfo {
    isStalled: boolean;
    daysStalled: number;
    flaggedAt?: string;
    draftFollowup?: string;
}

export interface AiReplyDraft {
    text: string;
    category: string;
    confidenceScore?: number;
    generatedAt?: string;
    status: 'pending' | 'approved' | 'auto_sent' | 'dismissed' | 'flagged_complaint';
}

export interface AiNextAction {
    actionText: string;
    taskType: string;
    suggestedDate?: string;
    rationale: string;
    createdAt?: string;
}

export interface WeeklyReportData {
    _id: string;
    startDate: string;
    endDate: string;
    metrics: {
        totalNewLeads: number;
        contactedCount: number;
        uncontactedCount: number;
        followupsCompleted: number;
        followupsOverdue: number;
        meetingsBooked: number;
        eaConversions: number;
        topCounties: { county: string; count: number }[];
    };
    aiRecommendations: string[];
    executiveSummary: string;
}

export const overrideLeadScore = async (id: string, score: 'Hot' | 'Warm' | 'Cold', reason?: string, leadType: string = 'ea_lead') => {
    const res = await api.post(`/ai/leads/${id}/score-override`, { score, reason, leadType });
    return res.data;
};

export const rescoreLead = async (id: string, leadType: string = 'ea_lead') => {
    const res = await api.post(`/ai/leads/${id}/rescore?leadType=${leadType}`);
    return res.data;
};

export const approveReplyDraft = async (id: string, leadType: string = 'ea_lead', customText?: string) => {
    const res = await api.post(`/ai/reply-draft/${id}/approve`, { leadType, customText });
    return res.data;
};

export const dismissReplyDraft = async (id: string, leadType: string = 'ea_lead') => {
    const res = await api.post(`/ai/reply-draft/${id}/dismiss`, { leadType });
    return res.data;
};

export const getStalledLeads = async () => {
    const res = await api.get('/ai/stalled-leads');
    return res.data;
};

export const sendStalledFollowup = async (id: string, leadType: string = 'ea_lead', customMessage?: string) => {
    const res = await api.post(`/ai/stalled/${id}/send`, { leadType, customMessage });
    return res.data;
};

export const acceptNextAction = async (id: string, leadType: string = 'ea_lead') => {
    const res = await api.post(`/ai/next-action/${id}/accept`, { leadType });
    return res.data;
};

export const dismissNextAction = async (id: string, leadType: string = 'ea_lead') => {
    const res = await api.post(`/ai/next-action/${id}/dismiss`, { leadType });
    return res.data;
};

export const getLatestWeeklyReport = async () => {
    const res = await api.get('/ai/weekly-reports/latest');
    return res.data;
};

export const triggerWeeklyReport = async () => {
    const res = await api.post('/ai/weekly-reports/generate');
    return res.data;
};

export const getAiSettings = async () => {
    const res = await api.get('/ai/settings');
    return res.data;
};

export const updateAiSettings = async (settings: any) => {
    const res = await api.put('/ai/settings', settings);
    return res.data;
};
