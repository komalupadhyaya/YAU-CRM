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
    const [collapsed, setCollapsed] = useState(() => {
        const saved = localStorage.getItem("sidebar-collapsed");
        if (saved !== null) return saved === "true";
        const mq = window.matchMedia("(max-width: 767px)");
        return mq.matches;
    });
    const [mobileOpen, setMobileOpen] = useState(false);

    // Auto-collapse on small screens
    useEffect(() => {
        const mq = window.matchMedia("(max-width: 767px)");
        const handler = (e: MediaQueryListEvent) => {
            if (e.matches) {
                setCollapsed(true);
                setMobileOpen(false);
            }
        };
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

    const toggleCollapsed = () => {
        setCollapsed(c => {
            const next = !c;
            localStorage.setItem("sidebar-collapsed", String(next));
            return next;
        });
    };

    return (
        <SidebarContext.Provider value={{
            collapsed,
            mobileOpen,
            toggleCollapsed,
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
