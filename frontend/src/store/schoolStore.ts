import { create } from 'zustand';

export interface Contact {
    _id?: string;
    name: string;
    title?: string;
    department?: string;
    direct_phone?: string;
    extension?: string;
    email?: string;
    best_time?: string;
    preferred_method?: string;
    is_primary?: boolean;
}

export interface Lead {
    _id: string;
    name: string;
    type?: string;
    category_group?: string;
    department?: string;
    telephone?: string;
    telephone_extension?: string;
    start_time?: string;
    end_time?: string;
    address_number?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    website?: string;
    status: string;
    last_contacted: string | null;
    createdAt: string;
    updatedAt: string;
    contacts?: Contact[];
    isConsent?: boolean;
    campaign_id?: { _id: string, name: string };
    assigned_to?: { _id: string, name: string, email?: string, role?: string } | null;
    callHistory?: Array<{
        callSid: string;
        parentCallSid?: string;
        direction: 'inbound' | 'outbound';
        duration: number;
        recordingUrl?: string;
        status: string;
        timestamp: string;
        source?: string;
        retellCallId?: string;
        aiSummary?: string;
        callerSentiment?: string;
        transcript?: string;
    }>;
}

interface LeadState {
    selectedLead: Lead | null;
    setSelectedLead: (lead: Lead | null | ((prev: Lead | null) => Lead | null)) => void;
}

export const useLeadStore = create<LeadState>((set) => ({
    selectedLead: null,
    setSelectedLead: (lead) => set((state) => ({ 
        selectedLead: typeof lead === 'function' ? lead(state.selectedLead) : lead 
    })),
}));
