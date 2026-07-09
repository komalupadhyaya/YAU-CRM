import { create } from 'zustand';

interface DialerState {
    isOpen: boolean;
    phoneNumber: string;
    leadId: string;
    contactName: string;
    activeCallSid: string;
    isReadOnly: boolean;
    openDialer: (phone: string, leadId?: string, contactName?: string, isReadOnly?: boolean) => void;
    closeDialer: () => void;
    setPhoneNumber: (phone: string) => void;
}

export const useDialerStore = create<DialerState>((set) => ({
    isOpen: false,
    phoneNumber: '',
    leadId: '',
    contactName: '',
    activeCallSid: '',
    isReadOnly: false,
    openDialer: (phone, leadId = '', contactName = '', isReadOnly = false) => set({
        isOpen: true,
        phoneNumber: phone,
        leadId,
        contactName,
        activeCallSid: '',
        isReadOnly
    }),
    closeDialer: () => set({ isOpen: false, isReadOnly: false }),
    setPhoneNumber: (phoneNumber) => set((state) => {
        if (state.isReadOnly) return state;
        return { phoneNumber };
    })
}));
export default useDialerStore;
