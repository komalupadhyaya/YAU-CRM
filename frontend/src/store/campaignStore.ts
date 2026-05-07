import { create } from 'zustand';

export interface Campaign {
    _id: string;
    name: string;
    createdAt?: string;
}

interface CampaignState {
    campaigns: Campaign[];
    statusLabels: string[];
    selectedCampaign: Campaign | null;
    setCampaigns: (campaigns: Campaign[]) => void;
    setStatusLabels: (labels: string[]) => void;
    setSelectedCampaign: (campaign: Campaign | null | ((prev: Campaign | null) => Campaign | null)) => void;
}

export const useCampaignStore = create<CampaignState>((set) => ({
    campaigns: [],
    statusLabels: [],
    selectedCampaign: null,
    setCampaigns: (campaigns) => set({ campaigns }),
    setStatusLabels: (statusLabels) => set({ statusLabels }),
    setSelectedCampaign: (campaign) => set((state) => ({ 
        selectedCampaign: typeof campaign === 'function' ? campaign(state.selectedCampaign) : campaign 
    })),
}));
