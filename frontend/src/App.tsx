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
            <Route path="/import" element={<RequireAuth><Import /></RequireAuth>} />

            <Route path="/campaigns" element={<RequireAuth><Campaigns /></RequireAuth>} />
            <Route path="/" element={<Login />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
