import { LogOut, Menu, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { useSidebar } from "./SidebarContext";
import { useThemeStore } from "../store/themeStore";

export default function Topbar() {
  const { toggleMobile } = useSidebar();
  const { theme, toggleTheme } = useThemeStore();

  const handleLogout = () => {
    localStorage.removeItem("token");
    toast.success("Signed out successfully");
    window.location.href = "/login";
  };

  return (
    <div className="h-14 bg-card border-b border-border flex items-center justify-between px-4 md:px-6 flex-shrink-0 transition-colors duration-200">

      {/* Left side — Hamburger */}
      <div className="flex items-center">
        <button
          onClick={toggleMobile}
          className="md:hidden p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-accent transition-colors"
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-accent transition-all duration-200"
          title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
        >
          {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
        </button>

        <button
          onClick={handleLogout}
          className="btn-secondary flex items-center gap-2 text-sm h-10 px-4"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </div>
  );
}