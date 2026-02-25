import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface SidebarContextType {
    collapsed: boolean;
    mobileOpen: boolean;
    toggleCollapsed: () => void;
    toggleMobile: () => void;
    closeMobile: () => void;
}

const SidebarContext = createContext<SidebarContextType>({
    collapsed: false,
    mobileOpen: false,
    toggleCollapsed: () => { },
    toggleMobile: () => { },
    closeMobile: () => { },
});

export function SidebarProvider({ children }: { children: ReactNode }) {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    // Auto-collapse on small screens
    useEffect(() => {
        const mq = window.matchMedia("(max-width: 767px)");
        if (mq.matches) setCollapsed(true);
        const handler = (e: MediaQueryListEvent) => {
            if (e.matches) {
                setCollapsed(true);
                setMobileOpen(false);
            }
        };
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

    return (
        <SidebarContext.Provider value={{
            collapsed,
            mobileOpen,
            toggleCollapsed: () => setCollapsed(c => !c),
            toggleMobile: () => setMobileOpen(o => !o),
            closeMobile: () => setMobileOpen(false),
        }}>
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar() {
    return useContext(SidebarContext);
}
