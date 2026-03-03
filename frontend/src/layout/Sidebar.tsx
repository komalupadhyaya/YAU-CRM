import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Megaphone,
  School,
  Clock,
  CheckSquare,
  BarChart3,
  Users,
  Settings,
  HelpCircle,
  Menu,
  X,
  ChevronRight,
  Plus
} from "lucide-react";
import { useSidebar } from "./SidebarContext";

const topNavItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/schools", label: "Schools / Leads", icon: School },
  { to: "/followups", label: "Follow Ups", icon: Clock },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/team", label: "Team", icon: Users },
];

const bottomNavItems = [
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/help", label: "Help & Support", icon: HelpCircle },
];


const quickActions: any[] = [];

export default function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { collapsed, mobileOpen, toggleCollapsed, closeMobile } = useSidebar();

  const renderNavItems = (items: typeof topNavItems, isMobile = false) => {
    return items.map(({ to, label, icon: Icon }) => {
      const active = pathname === to || pathname.startsWith(to + "/");
      return (
        <Link
          key={to}
          to={to}
          title={collapsed && !isMobile ? label : undefined}
          onClick={isMobile ? closeMobile : undefined}
          className={`sidebar-item ${active ? "sidebar-item-active" : "sidebar-item-inactive"} ${collapsed && !isMobile ? "justify-center px-0" : ""}`}
        >
          <Icon size={18} className="flex-shrink-0" />
          {(!collapsed || isMobile) && <span>{label}</span>}
        </Link>
      );
    });
  };

  // On mobile: sidebar is a fixed overlay slide-in panel
  // On desktop: sidebar collapses to icon-only
  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`
          hidden md:flex flex-col h-screen
          bg-sidebar border-r border-sidebar-border
          transition-all duration-300 ease-in-out flex-shrink-0
          ${collapsed ? "w-16" : "w-64"}
        `}
      >
        {/* Logo + collapse toggle */}
        <div className={`flex items-center h-14 border-b border-sidebar-border px-3 flex-shrink-0 ${collapsed ? "justify-center" : "justify-between"}`}>
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                <span className="text-primary-foreground font-extrabold text-xs">YAU</span>
              </div>
              <span className="text-lg font-bold whitespace-nowrap" style={{ color: "hsl(var(--sidebar-heading))" }}>
                CRM
              </span>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-primary-foreground font-extrabold text-xs">YAU</span>
            </div>
          )}
          <button
            onClick={toggleCollapsed}
            className="text-sidebar-muted hover:text-sidebar-foreground rounded-lg hover:bg-sidebar-accent/40 transition-colors flex-shrink-0"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="dark:text-sidebar-foreground" size={20} /> : <Menu size={20} className="dark:text-sidebar-foreground" />}
          </button>
        </div>

        {/* Top Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto overflow-x-hidden">
          {!collapsed && (
            <p className="text-[10px] uppercase tracking-widest text-sidebar-muted font-semibold px-3 mb-2">Menu</p>
          )}
          {renderNavItems(topNavItems)}
        </nav>

        {/* Bottom Nav */}
        <nav className="pb-4 px-2 pt-4 border-t border-sidebar-border/40 space-y-1 flex-shrink-0">
          {renderNavItems(bottomNavItems)}
          {!collapsed && (
            <div className="text-[11px] text-sidebar-muted px-4 pt-4 border-t border-sidebar-border/10 mt-2">© 2025 YAU CRM</div>
          )}
        </nav>
      </aside>

      {/* Mobile sidebar (slide-in overlay) */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64
          md:hidden flex flex-col
          bg-sidebar border-r border-sidebar-border
          transition-transform duration-300 ease-in-out shadow-2xl
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex items-center justify-between h-14 border-b border-sidebar-border px-4 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-extrabold text-xs">YAU</span>
            </div>
            <span className="text-lg font-bold" style={{ color: "hsl(var(--sidebar-heading))" }}>YAU CRM</span>
          </div>
          <button onClick={closeMobile} className="p-1.5 text-sidebar-muted hover:text-sidebar-foreground" aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        {/* Mobile Top Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          <p className="text-[10px] uppercase tracking-widest text-sidebar-muted font-semibold px-3 mb-2">Menu</p>
          {renderNavItems(topNavItems, true)}
        </nav>

        {/* Mobile Bottom Nav */}
        <nav className="pb-4 px-2 pt-4 border-t border-sidebar-border/40 space-y-1 flex-shrink-0">
          {renderNavItems(bottomNavItems, true)}
          <div className="text-[11px] text-sidebar-muted px-4 pt-4 border-t border-sidebar-border/10 mt-2">© 2025 YAU CRM</div>
        </nav>
      </aside>
    </>
  );
}
