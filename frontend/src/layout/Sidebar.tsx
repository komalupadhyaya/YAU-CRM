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
  Plus,
  CalendarDays,
  UserCheck,
  History
} from "lucide-react";
import { useSidebar } from "./SidebarContext";
import { useFollowUp } from "../context/FollowUpContext";
import { useAuth } from "../context/AuthContext";
import { can } from "../utils/permissions";

const topNavItems = [
  { to: "/dashboard",  label: "Dashboard",  icon: LayoutDashboard },
  { to: "/campaigns",  label: "Campaigns",  icon: Megaphone },
  // { to: "/calendar",   label: "Calendar",   icon: CalendarDays },
  { to: "/followups",  label: "Follow Ups", icon: Clock },
  { to: "/tasks",      label: "Tasks",      icon: CheckSquare },
  { to: "/reports",    label: "Reports",    icon: BarChart3 },
  // { to: "/lead-scheduler", label: "Lead Scheduler", icon: UserCheck },
  // { to: "/history",    label: "History",    icon: History },
  { to: "/team",       label: "Team",       icon: Users },
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
  const { dueTodayCount, dueTodayNames } = useFollowUp();
  const { currentUser } = useAuth();
  const permissions = can(currentUser?.role);

  // Filter nav items based on the current user's role
  const visibleTopNavItems = topNavItems.filter(item => {
    if (item.to === '/team') return permissions.viewTeam;
    if (item.to === '/lead-scheduler') return permissions.assignToOthers;
    if (item.to === '/history') return permissions.assignToOthers;
    return true;
  });

  const visibleBottomNavItems = bottomNavItems.filter(item => {
    if (item.to === '/settings') return permissions.viewSettings;
    return true;
  });

  const renderNavItems = (items: typeof topNavItems, isMobile = false) => {
    return items.map(({ to, label, icon: Icon }) => {
      const active = pathname === to || pathname.startsWith(to + "/");
      const showBadge = to === "/followups" && dueTodayCount > 0;
      
      let tooltipContent = label;
      if (to === "/followups" && dueTodayCount > 0) {
        tooltipContent = `${label} (${dueTodayCount} due today: ${dueTodayNames.join(", ")})`;
      }

      return (
        <Link
          key={to}
          to={to}
          title={isMobile ? undefined : tooltipContent}
          onClick={isMobile ? closeMobile : undefined}
          className={`sidebar-item relative ${active ? "sidebar-item-active" : "sidebar-item-inactive"} ${collapsed && !isMobile ? "justify-center px-0" : ""}`}
        >
          <div className="relative">
            <Icon size={18} className="flex-shrink-0" />
            {showBadge && collapsed && !isMobile && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
              </span>
            )}
          </div>
          {(!collapsed || isMobile) && (
            <div className="flex items-center justify-between flex-1">
              <span>{label}</span>
              {showBadge && (
                <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {dueTodayCount}
                </span>
              )}
            </div>
          )}
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
          {renderNavItems(visibleTopNavItems)}
        </nav>

        {/* Bottom Nav */}
        <nav className="pb-4 px-2 pt-4 border-t border-sidebar-border/40 space-y-1 flex-shrink-0">
          {renderNavItems(visibleBottomNavItems)}
          {!collapsed && (
            <div className="text-[11px] text-sidebar-muted px-4 pt-4 border-t border-sidebar-border/10 mt-2">© {new Date().getFullYear()} YAU CRM</div>
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
          {renderNavItems(visibleTopNavItems, true)}
        </nav>

        {/* Mobile Bottom Nav */}
        <nav className="pb-4 px-2 pt-4 border-t border-sidebar-border/40 space-y-1 flex-shrink-0">
          {renderNavItems(visibleBottomNavItems, true)}
          <div className="text-[11px] text-sidebar-muted px-4 pt-4 border-t border-sidebar-border/10 mt-2">© {new Date().getFullYear()} YAU CRM</div>
        </nav>
      </aside>
    </>
  );
}
