import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import LeadDetail from "./pages/LeadDetail";
import CreateLead from "./pages/CreateLead";
import Campaigns from "./pages/Campaigns";
import FollowUps from "./pages/FollowUps";
import Reports from "./pages/Reports";
import Team from "./pages/Team";
import Candidates from "./pages/Candidates";
import Settings from "./pages/Settings";
import Tasks from "./pages/Tasks";
import Help from "./pages/Help";
import Calendar from "./pages/Calendar";
import LeadScheduler from "./pages/LeadScheduler";
import HistoryPage from "./pages/History";
import EALeads from "@/pages/EALeads";
import SchoolMeetings from "./pages/SchoolMeetings";
import HRMeetings from "./pages/HRMeetings";
import PhoneSystem from "./pages/PhoneSystem";
import VoicemailInbox from "./pages/VoicemailInbox";
import CallHistoryPage from "@/pages/CallHistory";
import SMSMessages from "@/pages/SMSMessages";
import { SMSProvider } from "./context/SMSContext";
import { PresenceProvider } from "./context/PresenceContext";
import { SocketProvider } from "./context/SocketContext";

import RequireAuth from "./components/RequireAuth";
import RequireRole from "./components/RequireRole";
import NotFound from "./pages/NotFound";
import { useThemeStore } from "./store/themeStore";
import { useEffect } from "react";
import { AuthProvider } from "./context/AuthContext";
import Dialer from "./components/Dialer";

const queryClient = new QueryClient();

const App = () => {
  const { theme } = useThemeStore();

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, [theme]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SocketProvider>
          <PresenceProvider>
            <SMSProvider>
              <TooltipProvider>
              <Toaster />
              <Sonner position="top-right" closeButton richColors expand={true} />
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
                <Route path="/lead/:id" element={<RequireAuth><LeadDetail /></RequireAuth>} />
                <Route path="/leads/create" element={<RequireAuth><CreateLead /></RequireAuth>} />
                <Route path="/campaigns" element={<RequireAuth><Campaigns /></RequireAuth>} />
                <Route path="/followups" element={<RequireAuth><FollowUps /></RequireAuth>} />
                <Route path="/reports" element={<RequireAuth><Reports /></RequireAuth>} />
                <Route path="/team" element={<RequireAuth><RequireRole roles={['admin', 'manager']}><Team /></RequireRole></RequireAuth>} />
                <Route path="/candidates" element={<RequireAuth><RequireRole roles={['admin', 'manager']}><Candidates /></RequireRole></RequireAuth>} />
                <Route path="/lead-scheduler" element={<RequireAuth><RequireRole roles={['admin', 'manager']}><LeadScheduler /></RequireRole></RequireAuth>} />
                <Route path="/ea-leads" element={<RequireAuth><EALeads /></RequireAuth>} />
                <Route path="/sms" element={<RequireAuth><RequireRole roles={['admin', 'manager', 'sales_rep']}><SMSMessages /></RequireRole></RequireAuth>} />
                <Route path="/history" element={<RequireAuth><RequireRole roles={['admin', 'manager']}><HistoryPage /></RequireRole></RequireAuth>} />
                <Route path="/settings" element={<RequireAuth><RequireRole roles={['admin']}><Settings /></RequireRole></RequireAuth>} />
                <Route path="/phone-system" element={<RequireAuth><RequireRole roles={['admin']}><PhoneSystem /></RequireRole></RequireAuth>} />
                <Route path="/call-history" element={<RequireAuth><RequireRole roles={['admin']}><CallHistoryPage /></RequireRole></RequireAuth>} />
                <Route path="/voicemail-inbox" element={<RequireAuth><RequireRole roles={['admin']}><VoicemailInbox /></RequireRole></RequireAuth>} />
                <Route path="/tasks" element={<RequireAuth><Tasks /></RequireAuth>} />
                <Route path="/calendar" element={<RequireAuth><Calendar /></RequireAuth>} />
                <Route path="/help" element={<RequireAuth><Help /></RequireAuth>} />
                <Route path="/meetings/school" element={<RequireAuth><SchoolMeetings /></RequireAuth>} />
                <Route path="/meetings/hr" element={<RequireAuth><HRMeetings /></RequireAuth>} />
                <Route path="/" element={<Login />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
              <Dialer />
            </BrowserRouter>
          </TooltipProvider>
        </SMSProvider>
      </PresenceProvider>
    </SocketProvider>
  </AuthProvider>
</QueryClientProvider>
  );
};

export default App;
