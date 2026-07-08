import { create } from 'zustand';

interface DialerState {
    isOpen: boolean;
    phoneNumber: string;
    leadId: string;
    contactName: string;
    activeCallSid: string;
    openDialer: (phone: string, leadId?: string, contactName?: string) => void;
    closeDialer: () => void;
    setPhoneNumber: (phone: string) => void;
}

export const useDialerStore = create<DialerState>((set) => ({
    isOpen: false,
    phoneNumber: '',
    leadId: '',
    contactName: '',
    activeCallSid: '',
    openDialer: (phone, leadId = '', contactName = '') => set({
        isOpen: true,
        phoneNumber: phone,
        leadId,
        contactName,
        activeCallSid: ''
    }),
    closeDialer: () => set({ isOpen: false }),
    setPhoneNumber: (phoneNumber) => set({ phoneNumber })
}));
export default useDialerStore;
