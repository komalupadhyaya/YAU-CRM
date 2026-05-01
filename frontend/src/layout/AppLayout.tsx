import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { SidebarProvider, useSidebar } from "./SidebarContext";
import { FollowUpProvider } from "../context/FollowUpContext";
import { useEffect } from "react";
import { useCampaignStore } from "../store/campaignStore";
import api from "../api/api";

function Inner({ children }: { children: ReactNode }) {
  const { mobileOpen, closeMobile } = useSidebar();
  const { campaigns, statusLabels, setCampaigns, setStatusLabels } = useCampaignStore();

  useEffect(() => {
    // Fetch global data if not already present
    if (campaigns.length === 0) {
      api.get("/campaigns")
        .then(res => setCampaigns(res.data))
        .catch(() => {});
    }
    if (statusLabels.length === 0) {
      api.get("/settings")
        .then(res => setStatusLabels(res.data.statusLabels || []))
        .catch(() => {});
    }
  }, [campaigns.length, statusLabels.length, setCampaigns, setStatusLabels]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={closeMobile}
        />
      )}
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar />
        <div className="flex-1 overflow-auto p-4 md:p-6 bg-background">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <FollowUpProvider>
        <Inner>{children}</Inner>
      </FollowUpProvider>
    </SidebarProvider>
  );
}
