import { create } from 'zustand';

interface Campaign {
    _id: string;
    name: string;
}

interface CampaignState {
    selectedCampaign: Campaign | null;
    setSelectedCampaign: (campaign: Campaign | null) => void;
}

export const useCampaignStore = create<CampaignState>((set) => ({
    selectedCampaign: null,
    setSelectedCampaign: (campaign) => set({ selectedCampaign: campaign }),
}));
