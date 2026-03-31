import { create } from 'zustand';

interface Lead {
    _id: string;
    name: string;
    type?: string;
    category_group?: string;
    main_contact_name?: string;
    main_contact_email?: string;
    telephone?: string;
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
}

interface LeadState {
    selectedLead: Lead | null;
    setSelectedLead: (lead: Lead | null) => void;
}

export const useLeadStore = create<LeadState>((set) => ({
    selectedLead: null,
    setSelectedLead: (lead) => set({ selectedLead: lead }),
}));
