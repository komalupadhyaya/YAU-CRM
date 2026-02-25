import { LogOut, Menu } from "lucide-react";
import { toast } from "sonner";
import { useSidebar } from "./SidebarContext";

export default function Topbar() {
  const { toggleMobile } = useSidebar();

  const handleLogout = () => {
    localStorage.removeItem("token");
    toast.success("Signed out successfully");
    window.location.href = "/login";
  };

  return (
    <div className="h-14 bg-card border-b border-border flex items-center justify-between px-4 md:px-6 flex-shrink-0">
      {/* Hamburger — visible on mobile only */}
      <button
        onClick={toggleMobile}
        className="md:hidden p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-accent transition-colors"
        aria-label="Toggle menu"
      >
        <Menu size={20} />
      </button>

      {/* Spacer on desktop */}
      <div className="hidden md:block" />

      <button
        onClick={handleLogout}
        className="btn-secondary flex items-center gap-2 text-sm"
      >
        <LogOut size={16} />
        <span className="hidden sm:inline">Logout</span>
      </button>
    </div>
  );
}
