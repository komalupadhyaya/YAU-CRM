import { create } from 'zustand';

interface School {
    _id: string;
    name: string;
    type?: string;
    grades?: string;
    principal_name?: string;
    principal_email?: string;
    telephone?: string;
    start_time?: string;
    end_time?: string;
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

interface SchoolState {
    selectedSchool: School | null;
    setSelectedSchool: (school: School | null) => void;
}

export const useSchoolStore = create<SchoolState>((set) => ({
    selectedSchool: null,
    setSelectedSchool: (school) => set({ selectedSchool: school }),
}));
