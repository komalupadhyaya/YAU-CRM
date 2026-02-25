import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, School, Upload, ChevronLeft, ChevronRight, X, Megaphone, Menu, Clock, Plus } from "lucide-react";
import { useSidebar } from "./SidebarContext";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/schools", label: "Schools", icon: School },
  { to: "/import", label: "Import", icon: Upload },
];

const quickActions = [
  { label: "New Follow-up", icon: Clock, onClick: (navigate: any) => navigate("/dashboard?action=new-followup") },
];

export default function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { collapsed, mobileOpen, toggleCollapsed, closeMobile } = useSidebar();

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
            {collapsed ? <ChevronRight className="text-white" size={20} /> : <Menu size={20} className="text-white" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {!collapsed && (
            <p className="text-[10px] uppercase tracking-widest text-sidebar-muted font-semibold px-3 mb-2">Menu</p>
          )}
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || pathname.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className={`sidebar-item ${active ? "sidebar-item-active" : "sidebar-item-inactive"} ${collapsed ? "justify-center px-0" : ""}`}
              >
                <Icon size={18} className="flex-shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}

          <div className="pt-4 mt-4 border-t border-sidebar-border/50">
            {!collapsed && (
              <p className="text-[10px] uppercase tracking-widest text-sidebar-muted font-semibold px-3 mb-2">Actions</p>
            )}
            {quickActions.map(({ label, icon: Icon, onClick }) => (
              <button
                key={label}
                onClick={() => { onClick(navigate); closeMobile(); }}
                title={collapsed ? label : undefined}
                className={`sidebar-item sidebar-item-inactive w-full ${collapsed ? "justify-center px-0" : ""}`}
              >
                <div className="relative">
                  <Icon size={18} className="flex-shrink-0" />
                  <Plus size={8} className="absolute -top-1 -right-1 bg-primary text-white rounded-full" />
                </div>
                {!collapsed && <span>{label}</span>}
              </button>
            ))}
          </div>
        </nav>

        {!collapsed && (
          <div className="text-[11px] text-sidebar-muted px-4 py-3">© 2025 YAU CRM</div>
        )}
      </aside>

      {/* Mobile sidebar (slide-in overlay) */}
      <aside
        className={`
          fixed top-0 left-0 z-30 h-full w-64
          md:hidden flex flex-col
          bg-sidebar border-r border-sidebar-border
          transition-transform duration-300 ease-in-out
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

        <nav className="flex-1 py-4 px-2 space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-sidebar-muted font-semibold px-3 mb-2">Menu</p>
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || pathname.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                onClick={closeMobile}
                className={`sidebar-item ${active ? "sidebar-item-active" : "sidebar-item-inactive"}`}
              >
                <Icon size={18} className="flex-shrink-0" />
                <span>{label}</span>
              </Link>
            );
          })}

          <div className="pt-4 mt-4 border-t border-sidebar-border/50">
            <p className="text-[10px] uppercase tracking-widest text-sidebar-muted font-semibold px-3 mb-2">Actions</p>
            {quickActions.map(({ label, icon: Icon, onClick }) => (
              <button
                key={label}
                onClick={() => { onClick(navigate); closeMobile(); }}
                className="sidebar-item sidebar-item-inactive w-full"
              >
                <div className="relative">
                  <Icon size={18} className="flex-shrink-0" />
                  <Plus size={8} className="absolute -top-1 -right-1 bg-primary text-white rounded-full" />
                </div>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="text-[11px] text-sidebar-muted px-4 py-3">© 2025 YAU CRM</div>
      </aside>
    </>
  );
}
