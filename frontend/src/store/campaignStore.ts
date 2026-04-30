import { create } from 'zustand';

interface Campaign {
    _id: string;
    name: string;
}

interface CampaignState {
    selectedCampaign: Campaign | null;
    setSelectedCampaign: (campaign: Campaign | null | ((prev: Campaign | null) => Campaign | null)) => void;
}

export const useCampaignStore = create<CampaignState>((set) => ({
    selectedCampaign: null,
    setSelectedCampaign: (campaign) => set((state) => ({ 
        selectedCampaign: typeof campaign === 'function' ? campaign(state.selectedCampaign) : campaign 
    })),
}));
