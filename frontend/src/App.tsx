import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Schools from "./pages/Schools";
import SchoolDetail from "./pages/SchoolDetail";
import Import from "./pages/Import";
import CreateSchool from "./pages/CreateSchool";
import Campaigns from "./pages/Campaigns";
import FollowUps from "./pages/FollowUps"
import Reports from "./pages/Reports";
import Team from "./pages/Team";
import Settings from "./pages/Settings";
import Tasks from "./pages/Tasks";
import Help from "./pages/Help";

import RequireAuth from "./components/RequireAuth";
import NotFound from "./pages/NotFound";
import { useThemeStore } from "./store/themeStore";
import { useEffect } from "react";

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
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="/schools" element={<RequireAuth><Schools /></RequireAuth>} />
            <Route path="/school/:id" element={<RequireAuth><SchoolDetail /></RequireAuth>} />
            <Route path="/schools/create" element={<RequireAuth><CreateSchool /></RequireAuth>} />
            <Route path="/campaigns" element={<RequireAuth><Campaigns /></RequireAuth>} />
            <Route path="/followups" element={<RequireAuth><FollowUps /></RequireAuth>} />
            <Route path="/reports" element={<RequireAuth><Reports /></RequireAuth>} />
            <Route path="/team" element={<RequireAuth><Team /></RequireAuth>} />
            <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
            <Route path="/tasks" element={<RequireAuth><Tasks /></RequireAuth>} />
            <Route path="/help" element={<RequireAuth><Help /></RequireAuth>} />
            <Route path="/" element={<Login />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
