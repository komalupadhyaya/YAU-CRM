import { useState, useEffect, useRef, useCallback } from "react";
import { LogOut, Menu, Moon, Sun, Bell, CheckCheck, Clock, CalendarClock, Trash2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useSidebar } from "./SidebarContext";
import { useThemeStore } from "../store/themeStore";
import { useAuth } from "../context/AuthContext";
import { useSMS } from "../context/SMSContext";
import CalendarPopover from "../components/CalendarPopover";
import api from "../api/api";
import AvailabilityModal from "../components/AvailabilityModal";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AppNotification {
  _id: string;
  type: "task_reminder" | "followup_reminder";
  title: string;
  message: string;
  link: string;
  isRead: boolean;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Notification Bell Component ───────────────────────────────────────────────

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get("/notifications");
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch {
      // Silently ignore — non-critical background poll
    }
  }, []);

  // Initial fetch + poll every 60 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api.put("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark notifications as read");
    }
  };

  const handleDeleteAll = async () => {
    try {
      await api.delete("/notifications/delete-all");
      setNotifications([]);
      setUnreadCount(0);
      toast.success("All notifications deleted");
    } catch {
      toast.error("Failed to delete notifications");
    }
  };

  const handleDeleteOne = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      const deleted = notifications.find((n) => n._id === id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      if (deleted && !deleted.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      toast.success("Notification deleted");
    } catch {
      toast.error("Failed to delete notification");
    }
  };

  const handleClickNotification = async (notif: AppNotification) => {
    // Mark as read
    if (!notif.isRead) {
      try {
        await api.put(`/notifications/${notif._id}/read`);
        setNotifications((prev) =>
          prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // ignore
      }
    }
    setOpen(false);
    navigate(notif.link);
  };

  return (
    <div ref={panelRef} className="relative">
      {/* Bell button */}
      <button
        id="notification-bell-btn"
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-accent transition-all duration-200"
        title="Notifications"
        aria-label="Open notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none shadow-sm animate-in zoom-in-50 duration-200">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="fixed left-4 right-4 sm:absolute sm:left-auto sm:right-0 sm:w-96 top-14 sm:top-11 bg-card border border-border shadow-2xl rounded-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-primary" />
              <span className="text-sm font-bold">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-500 border border-red-500/20">
                  {unreadCount} new
                </span>
              )}
            </div>
            {notifications.length > 0 && (
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-primary transition-colors font-semibold"
                    title="Mark all as read"
                  >
                    <CheckCheck size={12} />
                    Mark read
                  </button>
                )}
                <button
                  onClick={handleDeleteAll}
                  className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-destructive transition-colors font-semibold"
                  title="Delete all notifications"
                >
                  <Trash2 size={12} />
                  Delete all
                </button>
              </div>
            )}
          </div>

          {/* Notifications list */}
          <div className="max-h-[360px] overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Bell size={28} className="mb-3 opacity-20" />
                <p className="text-sm font-medium">You're all caught up!</p>
                <p className="text-xs mt-1 opacity-60">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif._id}
                  onClick={() => handleClickNotification(notif)}
                  className={`w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-accent/60 transition-colors border-b border-border/50 last:border-b-0 cursor-pointer relative group/notif ${
                    !notif.isRead ? "bg-primary/5" : ""
                  }`}
                >
                  {/* Icon */}
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      notif.type === "task_reminder"
                        ? "bg-orange-500/15 text-orange-500"
                        : "bg-blue-500/15 text-blue-500"
                    }`}
                  >
                    {notif.type === "task_reminder" ? (
                      <Clock size={14} />
                    ) : (
                      <CalendarClock size={14} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-foreground truncate">
                        {notif.title}
                      </p>
                      {!notif.isRead && (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                      {notif.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1 font-medium">
                      {timeAgo(notif.createdAt)}
                    </p>
                  </div>

                  {/* Individual Delete Button */}
                  <button
                    onClick={(e) => handleDeleteOne(e, notif._id)}
                    className="p-1.5 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive opacity-0 group-hover/notif:opacity-100 transition-all shrink-0 mt-0.5"
                    title="Delete notification"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── SMS Navbar Popover Component ─────────────────────────────────────────────

function SMSNavbarPopover() {
  const [open, setOpen] = useState(false);
  const { unreadSMSCount, recentSMSList, markAsRead } = useSMS();
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpenInbox = () => {
    setOpen(false);
    navigate("/sms");
  };

  const handleSelectMessage = async (item: any) => {
    setOpen(false);
    await markAsRead(item.leadId, item.leadType);
    navigate(`/sms?leadId=${item.leadId}`);
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        id="sms-navbar-btn"
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-accent transition-all duration-200"
        title="SMS Messages"
        aria-label="Open SMS inbox"
      >
        <MessageSquare size={20} />
        {unreadSMSCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none shadow-sm animate-in zoom-in-50 duration-200">
            {unreadSMSCount > 9 ? "9+" : unreadSMSCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-4 right-4 sm:absolute sm:left-auto sm:right-0 sm:w-96 top-14 sm:top-11 bg-card border border-border shadow-2xl rounded-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <MessageSquare size={15} className="text-primary" />
              <span className="text-sm font-bold">SMS Messages</span>
              {unreadSMSCount > 0 && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-500 border border-red-500/20">
                  {unreadSMSCount} unread
                </span>
              )}
            </div>
            <button
              onClick={handleOpenInbox}
              className="text-xs text-primary hover:underline font-semibold"
            >
              Open Full Inbox
            </button>
          </div>

          <div className="max-h-[360px] overflow-y-auto custom-scrollbar">
            {recentSMSList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageSquare size={28} className="mb-3 opacity-20" />
                <p className="text-sm font-medium">No unread SMS messages</p>
                <button
                  onClick={handleOpenInbox}
                  className="text-xs text-primary mt-2 font-semibold hover:underline"
                >
                  View all conversations →
                </button>
              </div>
            ) : (
              recentSMSList.map((item) => (
                <div
                  key={`${item.leadId}-${item.timestamp}`}
                  onClick={() => handleSelectMessage(item)}
                  className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-accent/60 transition-colors border-b border-border/50 last:border-b-0 cursor-pointer bg-primary/5"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    {item.senderName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-bold text-foreground truncate">
                        {item.senderName}
                      </p>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-semibold">
                        {item.categoryTag}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1 font-medium">
                      {timeAgo(item.timestamp)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Topbar ───────────────────────────────────────────────────────────────

export default function Topbar() {
  const { toggleMobile } = useSidebar();
  const { theme, toggleTheme } = useThemeStore();
  const { currentUser, logout } = useAuth();
  const [isHovered, setIsHovered] = useState(false);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);

  const handleLogout = async () => {
    toast.success("Signed out successfully");
    await logout();
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
      <div className="flex items-center gap-3">
        {/* User Profile Avatar */}
        {currentUser && (
          <>
            <div
              className="relative flex items-center gap-2 cursor-pointer"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              <span className="hidden md:inline text-xs font-semibold text-muted-foreground mr-1 select-none">
                Hi, <span className="text-foreground">{currentUser.name || currentUser.username.split("@")[0]}</span>
              </span>
              <div className="w-8 h-8 rounded-full bg-primary hover:brightness-105 text-primary-foreground flex items-center justify-center font-bold text-sm shadow-sm border border-primary/20 transition-all duration-200 select-none">
                {(currentUser.name || currentUser.username).charAt(0).toUpperCase()}
              </div>

              {/* Hover details card */}
              {isHovered && (
                <div className="fixed left-4 right-4 sm:absolute sm:left-auto sm:right-0 sm:w-64 top-14 sm:top-9 bg-card border border-border shadow-xl rounded-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center gap-3 border-b border-border pb-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-base border border-primary/20 select-none">
                      {(currentUser.name || currentUser.username).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm text-foreground truncate">
                        {currentUser.name || "CRM User"}
                      </h4>
                      <p className="text-xs text-muted-foreground truncate">
                        {currentUser.email || currentUser.username}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Role:</span>
                      <span className={`inline-flex items-center gap-1 font-semibold px-2.5 py-0.5 rounded-full border text-[10px] uppercase tracking-wider
                        ${currentUser.role === "admin"     ? "bg-violet-500/15 text-violet-500 border-violet-500/30" :
                          currentUser.role === "manager"   ? "bg-blue-500/15 text-blue-500 border-blue-500/30" :
                          currentUser.role === "sales_rep" ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" :
                          "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"}`}
                      >
                        {currentUser.role === "sales_rep" ? "Sales Rep" : currentUser.role || "User"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Access level:</span>
                      <span className="text-foreground font-medium capitalize">
                        {currentUser.role === "admin" ? "Full Access" : currentUser.role === "manager" ? "Elevated" : currentUser.role === "sales_rep" ? "Standard" : "Basic"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Availability Icon Button */}
            <button
              onClick={() => setAvailabilityOpen(true)}
              className="p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-accent transition-all duration-200"
              title="My Availability"
              aria-label="Manage my availability"
            >
              <CalendarClock size={20} />
            </button>
          </>
        )}

        {/* Calendar Popover */}
        <CalendarPopover />

        {/* SMS Messages Navbar Button */}
        <SMSNavbarPopover />

        {/* Notification Bell */}
        <NotificationBell />

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
      <AvailabilityModal
        user={currentUser ? { _id: currentUser._id, name: currentUser.name, username: currentUser.username } : null}
        open={availabilityOpen}
        onClose={() => setAvailabilityOpen(false)}
      />
    </div>
  );
}