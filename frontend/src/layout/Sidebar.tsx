import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  ChevronDown,
  Plus,
  CalendarDays,
  UserCheck,
  UserPlus,
  History,
  Building2,
  Sparkles,
  Phone,
  Voicemail,
  PhoneCall,
  Video
} from "lucide-react";
import { useSidebar } from "./SidebarContext";
import { useFollowUp } from "../context/FollowUpContext";
import { useAuth } from "../context/AuthContext";
import { can } from "../utils/permissions";

const topNavItems = [
  { to: "/dashboard",       label: "Dashboard",       icon: LayoutDashboard },
  { to: "/campaigns",       label: "Campaigns",       icon: Megaphone },
  { to: "/calendar",        label: "Calendar",        icon: CalendarDays },
  { to: "/followups",       label: "Follow Ups",      icon: Clock },
  { to: "/tasks",           label: "Tasks",           icon: CheckSquare },
  { 
    label: "Meetings", 
    icon: Users,
    children: [
      { to: "/meetings/school", label: "School Meetings", icon: School },
      { to: "/meetings/hr",     label: "HR Meetings",     icon: Building2 },
    ]
  },
  { to: "/reports",         label: "Reports",         icon: BarChart3 },
  { to: "/lead-scheduler",  label: "Lead Scheduler",  icon: UserCheck },
  { to: "/ea-leads",        label: "EA Leads",        icon: Sparkles },
  { to: "/candidates",      label: "HC Candidates",      icon: UserPlus },
  // { to: "/history",      label: "History",         icon: History },
  { to: "/team",            label: "Team",            icon: Users },
];

const bottomNavItems = [
  {
    label: "System Settings",
    icon: Settings,
    children: [
      { to: "/phone-system",    label: "Phone System",    icon: Phone, adminOnly: true },
      { to: "/call-history",    label: "Call History",    icon: PhoneCall, roles: ['admin'] },
      { to: "/voicemail-inbox", label: "Voicemail Inbox", icon: Voicemail, adminOnly: true },
      { to: "/settings",        label: "General Settings", icon: Settings, viewSettingsOnly: true },
    ]
  },
  { to: "/help",            label: "Help & Support",   icon: HelpCircle },
];


const quickActions: any[] = [];

export default function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { collapsed, mobileOpen, toggleCollapsed, closeMobile } = useSidebar();
  const { dueTodayCount, dueTodayNames, schoolMeetingCount, hrMeetingCount } = useFollowUp();
  const { currentUser } = useAuth();
  const permissions = can(currentUser?.role);
  const [settingsExpanded, setSettingsExpanded] = useState(false);

  // Filter nav items based on the current user's role
  const visibleTopNavItems = topNavItems.map(item => {
    if (item.children) {
      const visibleChildren = item.children.filter(child => {
        if (child.to === '/meetings/hr') return true;
        return true;
      });
      return { ...item, children: visibleChildren };
    }
    return item;
  }).filter(item => {
    if (item.children) return item.children.length > 0;
    
    if (item.to === '/team') return permissions.viewTeam;
    if (item.to === '/lead-scheduler') return permissions.assignToOthers;
    if (item.to === '/candidates') return permissions.assignToOthers; // admin + manager only
    if (item.to === '/ea-leads') return permissions.viewEALeads; // admin + manager only
    if (item.to === '/history') return permissions.assignToOthers;
    return true;
  });

  const visibleBottomNavItems = bottomNavItems.map(item => {
    if (item.children) {
      const visibleChildren = item.children.filter(child => {
        if (child.adminOnly) return currentUser?.role === 'admin';
        if (child.viewSettingsOnly) return permissions.viewSettings;
        if (child.roles) return child.roles.includes(currentUser?.role);
        return true;
      });
      return { ...item, children: visibleChildren };
    }
    return item;
  }).filter(item => {
    if (item.children) return item.children.length > 0;
    return true;
  });

  const renderNavItems = (items: any[], isMobile = false) => {
    return items.map((item) => {
      const { to, label, icon: Icon, children } = item;

      if (children) {
        const isChildActive = children.some((child: any) => pathname === child.to || pathname.startsWith(child.to + "/"));
        
        // Calculate parent badges
        let parentBadgeCount = 0;
        children.forEach((child: any) => {
           if (child.to === "/meetings/school" && schoolMeetingCount > 0) parentBadgeCount += schoolMeetingCount;
           if (child.to === "/meetings/hr" && hrMeetingCount > 0) parentBadgeCount += hrMeetingCount;
        });
        const showParentBadge = parentBadgeCount > 0;

        return (
          <DropdownMenu key={label}>
            <DropdownMenuTrigger asChild>
              <button
                className={`sidebar-item w-full relative ${isChildActive ? "sidebar-item-active" : "sidebar-item-inactive"} ${collapsed && !isMobile ? "justify-center px-0" : ""}`}
                title={collapsed && !isMobile ? label : undefined}
              >
                <div className="relative">
                  <Icon size={18} className="flex-shrink-0" />
                  {showParentBadge && collapsed && !isMobile && (
                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
                    </span>
                  )}
                </div>
                {(!collapsed || isMobile) && (
                  <div className="flex items-center justify-between flex-1">
                    <span>{label}</span>
                    <div className="flex items-center gap-2">
                      {showParentBadge && (
                        <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {parentBadgeCount}
                        </span>
                      )}
                      <ChevronRight size={16} className="text-sidebar-muted" />
                    </div>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              side={isMobile ? "bottom" : "right"} 
              align={isMobile ? "center" : "end"} 
              sideOffset={15}
              className="w-56 bg-popover border-border shadow-xl p-2 rounded-xl text-popover-foreground"
            >
              <div className="px-2 py-1.5 mb-1 border-b border-border/50">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
              </div>
              {children.map((child: any) => {
                const childActive = pathname === child.to || pathname.startsWith(child.to + "/");
                return (
                  <DropdownMenuItem key={child.to} asChild className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
                    <Link
                      to={child.to}
                      onClick={isMobile ? closeMobile : undefined}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                        childActive ? "bg-primary/10 text-primary font-semibold" : "text-popover-foreground"
                      }`}
                    >
                      <child.icon size={16} />
                      <span className="flex-1">{child.label}</span>
                      {child.to === "/meetings/school" && schoolMeetingCount > 0 && (
                        <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {schoolMeetingCount}
                        </span>
                      )}
                      {child.to === "/meetings/hr" && hrMeetingCount > 0 && (
                        <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {hrMeetingCount}
                        </span>
                      )}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }

      const active = pathname === to || pathname.startsWith(to + "/");
      const isFollowUps = to === "/followups" && dueTodayCount > 0;
      const isSchoolMeetings = to === "/meetings/school" && schoolMeetingCount > 0;
      const isHRMeetings = to === "/meetings/hr" && hrMeetingCount > 0;
      const showBadge = isFollowUps || isSchoolMeetings || isHRMeetings;
      const badgeCount = isFollowUps ? dueTodayCount : isSchoolMeetings ? schoolMeetingCount : hrMeetingCount;
      
      let tooltipContent = label;
      if (isFollowUps) {
        tooltipContent = `${label} (${dueTodayCount} due today: ${dueTodayNames.join(", ")})`;
      } else if (isSchoolMeetings) {
        tooltipContent = `${label} (${schoolMeetingCount} upcoming)`;
      } else if (isHRMeetings) {
        tooltipContent = `${label} (${hrMeetingCount} upcoming)`;
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
                  {badgeCount}
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
