import { useEffect, useState, useCallback } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import {
    Users,
    Shield,
    Mail,
    Phone,
    Calendar,
    Plus,
    Pencil,
    Trash2,
    UserCheck,
    UserX,
    KeyRound,
    ChevronDown,
    Search,
    Clock,
    CalendarDays,
    Video,
    Check,
    Loader2,
    X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { can } from "../utils/permissions";
import AvailabilityModal from "../components/AvailabilityModal";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { usePresence, PresenceStatus } from "../context/PresenceContext";

interface TeamUser {
    _id: string;
    username: string;
    name?: string;
    email?: string;
    role: string;
    phone?: string;
    isActive: boolean;
    createdAt: string;
    presenceStatus?: PresenceStatus;
    lastActiveAt?: string;
}

const formatLastSeen = (timestamp?: string | null) => {
    if (!timestamp) return "Offline";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return "Active just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};


const ROLES = [
    { value: "admin",     label: "Admin",     color: "bg-violet-500/15 text-violet-500 border-violet-500/30" },
    { value: "manager",   label: "Manager",   color: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
    { value: "sales_rep", label: "Sales Rep", color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
    { value: "view_only", label: "View Only", color: "bg-sky-500/15 text-sky-500 border-sky-500/30" },
];

const getRoleStyle = (role: string) =>
    ROLES.find((r) => r.value === role)?.color ??
    "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";

const getRoleLabel = (role: string) =>
    ROLES.find((r) => r.value === role)?.label ?? role;

const defaultForm = {
    name: "",
    email: "",
    password: "",
    role: "sales_rep",
    phone: "",
};

export default function Team() {
    const [users, setUsers] = useState<TeamUser[]>([]);
    const { currentUser } = useAuth();
    const { getPresence } = usePresence();
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    // Helper to determine active live status for a user
    const getUserLivePresence = useCallback((user: TeamUser) => {
        const live = getPresence(user._id);
        if (live && live.status) {
            return {
                status: live.status,
                lastActiveAt: live.lastActiveAt || user.lastActiveAt,
            };
        }
        return {
            status: user.presenceStatus || 'offline',
            lastActiveAt: user.lastActiveAt,
        };
    }, [getPresence]);

    // Modal state for user
    const [modalOpen, setModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<TeamUser | null>(null);
    const [form, setForm] = useState(defaultForm);
    const [submitting, setSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Availability modal state
    const [availabilityTarget, setAvailabilityTarget] = useState<TeamUser | null>(null);

    // Delete state for user
    const [deleteTarget, setDeleteTarget] = useState<TeamUser | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Toggle loading states per user
    const [toggling, setToggling] = useState<Record<string, boolean>>({});

    // Zoom invite loading, added & registered in Zoom state maps
    const [invitingZoom, setInvitingZoom] = useState<Record<string, boolean>>({});
    const [zoomInvited, setZoomInvited] = useState<Record<string, boolean>>({});
    const [inZoomEmails, setInZoomEmails] = useState<Set<string>>(new Set());

    // Role-based permissions
    const permissions = can(currentUser?.role);
    const isDefaultAdmin = permissions.manageTeam; // admin only

    const loadUsers = async () => {
        try {
            const res = await api.get("/team");
            setUsers(res.data);

            // Fetch active Zoom users to detect members already present in Zoom User Management
            try {
                const zoomRes = await api.get("/meetings/zoom-users");
                const rawList = Array.isArray(zoomRes.data)
                    ? zoomRes.data
                    : Array.isArray(zoomRes.data?.users)
                    ? zoomRes.data.users
                    : [];
                const emails = new Set<string>();
                rawList.forEach((z: any) => {
                    const email = (z.email || z.username || "").toLowerCase();
                    if (email) emails.add(email);
                });
                setInZoomEmails(emails);
            } catch {
                // non-critical fallback
            }
        } catch {
            toast.error("Failed to load team members");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, [currentUser?.role]);

    const openCreate = () => {
        if (!isDefaultAdmin) return;
        setEditingUser(null);
        setForm(defaultForm);
        setShowPassword(false);
        setModalOpen(true);
    };

    const openEdit = (user: TeamUser) => {
        if (!isDefaultAdmin) return;
        setEditingUser(user);
        setForm({
            name: user.name ?? "",
            email: user.email ?? user.username,
            password: "",
            role: user.role,
            phone: user.phone ?? "",
        });
        setShowPassword(false);
        setModalOpen(true);
    };

    const handleSubmit = async () => {
        if (!form.email.trim()) {
            toast.error("Email is required");
            return;
        }
        if (!editingUser && !form.password.trim()) {
            toast.error("Password is required for new users");
            return;
        }
        setSubmitting(true);
        try {
            if (editingUser) {
                const payload: Record<string, string> = {
                    name: form.name,
                    email: form.email,
                    role: form.role,
                    phone: form.phone,
                };
                if (form.password.trim()) payload.password = form.password;
                const res = await api.put(`/team/${editingUser._id}`, payload);
                setUsers((prev) =>
                    prev.map((u) => (u._id === editingUser._id ? { ...u, ...res.data } : u))
                );
                toast.success("Team member updated");
            } else {
                const res = await api.post("/team", form);
                setUsers((prev) => [res.data, ...prev]);
                toast.success("Team member created — they can now log in with their email and password");
            }
            setModalOpen(false);
        } catch {
            // handled by api interceptor
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggle = async (user: TeamUser) => {
        setToggling((prev) => ({ ...prev, [user._id]: true }));
        try {
            const res = await api.patch(`/team/${user._id}/toggle`);
            setUsers((prev) =>
                prev.map((u) => (u._id === user._id ? { ...u, isActive: res.data.isActive } : u))
            );
            toast.success(
                res.data.isActive
                    ? `${user.name || user.username} has been activated`
                    : `${user.name || user.username} has been deactivated`
            );
        } catch {
            // handled
        } finally {
            setToggling((prev) => ({ ...prev, [user._id]: false }));
        }
    };

    const handleZoomInvite = async (user: TeamUser) => {
        setInvitingZoom((prev) => ({ ...prev, [user._id]: true }));
        try {
            const res = await api.post(`/team/${user._id}/zoom-invite`);
            const emailLower = (user.email || user.username || "").toLowerCase();

            if (res.data.exists || res.data.success) {
                // Show green checkmark temporarily for 3 seconds
                setZoomInvited((prev) => ({ ...prev, [user._id]: true }));
                setTimeout(() => {
                    setZoomInvited((prev) => ({ ...prev, [user._id]: false }));
                    // Only permanently hide button if user is fully active in Zoom User Management (not pending)
                    if (!res.data.pending) {
                        setInZoomEmails((prev) => {
                            const next = new Set(prev);
                            next.add(emailLower);
                            return next;
                        });
                    }
                }, 3000);

                if (res.data.exists) {
                    toast.info(res.data.message || `User ${user.email || user.username} is already present in Zoom User Management.`);
                } else {
                    toast.success(res.data.message || `Invitation email sent to ${user.email || user.username} to join Zoom User Management (Basic Plan)!`);
                }
            } else {
                toast.info(res.data.message);
            }
        } catch (err: any) {
            const errorMsg = err.response?.data?.message || err.message || "Failed to send Zoom invitation";
            toast.error(errorMsg);
        } finally {
            setInvitingZoom((prev) => ({ ...prev, [user._id]: false }));
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await api.delete(`/team/${deleteTarget._id}`);
            setUsers((prev) => prev.filter((u) => u._id !== deleteTarget._id));
            toast.success("Team member removed");
            setDeleteTarget(null);
        } catch {
            // handled
        } finally {
            setDeleting(false);
        }
    };

    const filtered = users.filter((u) => {
        const q = search.toLowerCase();
        return (
            (u.name ?? "").toLowerCase().includes(q) ||
            (u.email ?? "").toLowerCase().includes(q) ||
            (u.username ?? "").toLowerCase().includes(q) ||
            (u.role ?? "").toLowerCase().includes(q)
        );
    });

    const totalActive = users.filter((u) => u.isActive).length;
    const totalOnlineNow = users.filter((u) => u.isActive && getUserLivePresence(u).status === 'online').length;
    const totalAwayNow = users.filter((u) => u.isActive && getUserLivePresence(u).status === 'away').length;
    const totalAdmins = users.filter((u) => u.role === "admin").length;
    const totalZoomActive = users.filter((u) => inZoomEmails.has((u.email || u.username || "").toLowerCase())).length;

    return (
        <AppLayout>
            <div className="space-y-6 max-w-6xl mx-auto pb-12">
                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                          {permissions.manageTeam ? 'Team Management' : 'Team'}
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            {permissions.manageTeam
                              ? 'Create and manage internal CRM users with separate logins, live online presence, and role-based access.'
                              : 'View your team members, live online status, and roles.'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            id="btn-invite-member"
                            className={`gap-2 shrink-0 transition-all ${!isDefaultAdmin ? "blur-[0.5px] opacity-40 cursor-not-allowed pointer-events-none" : ""}`}
                            onClick={openCreate}
                            disabled={!isDefaultAdmin}
                        >
                            <Plus size={16} />
                            Invite Team Member
                        </Button>
                    </div>
                </div>

                {/* ── Stats strip ── */}
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-card border rounded-xl p-4 flex items-center gap-3 shadow-sm">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Users size={18} className="text-primary" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{users.length}</p>
                            <p className="text-xs text-muted-foreground">Total Members</p>
                        </div>
                    </div>
                    <div className="bg-card border rounded-xl p-4 flex items-center gap-3 shadow-sm relative overflow-hidden">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </span>
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalOnlineNow}</p>
                                {totalAwayNow > 0 && (
                                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                                        +{totalAwayNow} Away
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">Online Now (Live)</p>
                        </div>
                    </div>
                    <div className="bg-card border rounded-xl p-4 flex items-center gap-3 shadow-sm">
                        <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                            <Shield size={18} className="text-violet-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{totalAdmins}</p>
                            <p className="text-xs text-muted-foreground">Admins</p>
                        </div>
                    </div>
                    <div className="bg-card border rounded-xl p-4 flex items-center gap-3 shadow-sm">
                        <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
                            <Video size={18} className="text-sky-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{totalZoomActive}</p>
                            <p className="text-xs text-muted-foreground">Zoom Active</p>
                        </div>
                    </div>
                </div>

                {/* ── Search bar ── */}
                <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        id="team-search"
                        placeholder="Search by name, email or role…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>

                {/* ── Desktop Tabular View (hidden on mobile/tablet/iPad) ── */}
                    <div className="hidden lg:block bg-card border rounded-xl overflow-hidden shadow-sm">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>Member</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Live Status</TableHead>
                                    <TableHead>Account</TableHead>
                                    <TableHead>Joined</TableHead>
                                    <TableHead className="text-center">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    Array.from({ length: 3 }).map((_, i) => (
                                        <TableRow key={i}>
                                            {Array.from({ length: 7 }).map((_, j) => (
                                                <TableCell key={j}>
                                                    <div className="h-4 bg-muted animate-pulse rounded" />
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                                ) : filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-40 text-center text-muted-foreground">
                                            <div className="flex flex-col items-center gap-2">
                                                <Users size={32} className="text-muted-foreground/30" />
                                                <span>
                                                    {search ? "No results match your search." : "No team members yet. Invite someone to get started."}
                                                </span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filtered.map((user) => {
                                        const livePresence = getUserLivePresence(user);
                                        return (
                                        <TableRow key={user._id} className={!user.isActive ? "bg-muted/10 border-dashed" : ""}>
                                            {/* Avatar + Name */}
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="relative shrink-0">
                                                        <div
                                                            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0
                                                                ${user.isActive
                                                                    ? "bg-primary/20 text-primary"
                                                                    : "bg-muted text-muted-foreground"
                                                                }`}
                                                        >
                                                            {(user.name || user.username || "").charAt(0).toUpperCase() || "?"}
                                                        </div>
                                                        {user.isActive && (
                                                            <span
                                                                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${
                                                                    livePresence.status === 'online'
                                                                        ? 'bg-emerald-500 ring-2 ring-emerald-500/20'
                                                                        : livePresence.status === 'away'
                                                                        ? 'bg-amber-500 ring-2 ring-amber-500/20'
                                                                        : 'bg-zinc-400 dark:bg-zinc-600'
                                                                }`}
                                                                title={livePresence.status === 'online' ? 'Online' : livePresence.status === 'away' ? 'Away / Sleep' : 'Offline'}
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-sm truncate">
                                                            {user.name || "—"}
                                                        </p>
                                                        {user.phone && (
                                                            <p className="text-[11px] text-muted-foreground font-mono truncate">
                                                                {user.phone}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>

                                            {/* Email */}
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Mail size={13} />
                                                    <span className="truncate max-w-[200px]">
                                                        {user.email || user.username || "—"}
                                                    </span>
                                                </div>
                                            </TableCell>

                                            {/* Role Badge */}
                                            <TableCell>
                                                <span
                                                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${getRoleStyle(user.role)}`}
                                                >
                                                    <Shield size={10} />
                                                    {getRoleLabel(user.role)}
                                                </span>
                                            </TableCell>

                                            {/* Live Status */}
                                            <TableCell>
                                                {!user.isActive ? (
                                                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 border border-border/40 px-2 py-0.5 rounded-full">
                                                        Deactivated
                                                    </span>
                                                ) : livePresence.status === 'online' ? (
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                                                        <span className="relative flex h-2 w-2">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                        </span>
                                                        Online
                                                    </span>
                                                ) : livePresence.status === 'away' ? (
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                                                        <span className="inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                                        Away (Idle)
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/60 border border-border/70 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                                                        <span className="inline-flex rounded-full h-2 w-2 bg-zinc-400 dark:bg-zinc-600"></span>
                                                        {formatLastSeen(livePresence.lastActiveAt)}
                                                    </span>
                                                )}
                                            </TableCell>

                                            {/* Active Toggle */}
                                            <TableCell>
                                                <div className={`flex items-center gap-2 transition-all ${!isDefaultAdmin ? "blur-[0.5px] opacity-40 cursor-not-allowed pointer-events-none" : ""}`}>
                                                    <Switch
                                                        id={`toggle-${user._id}`}
                                                        checked={user.isActive}
                                                        onCheckedChange={() => handleToggle(user)}
                                                        disabled={toggling[user._id] || !isDefaultAdmin}
                                                        aria-label={user.isActive ? "Deactivate user" : "Activate user"}
                                                    />
                                                    <span className={`text-xs ${user.isActive ? "text-emerald-500" : "text-muted-foreground"}`}>
                                                        {user.isActive ? "Active" : "Inactive"}
                                                    </span>
                                                </div>
                                            </TableCell>

                                            {/* Joined date */}
                                            <TableCell>
                                                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                                    <Calendar size={13} />
                                                    {new Date(user.createdAt).toLocaleDateString()}
                                                </div>
                                            </TableCell>

                                            {/* Actions */}
                                            <TableCell className="text-center">
                                                <div className={`flex items-center justify-center gap-1 transition-all ${!isDefaultAdmin ? "blur-[0.5px] opacity-40 cursor-not-allowed pointer-events-none" : ""}`}>
                                                    {(!inZoomEmails.has((user.email || user.username || "").toLowerCase()) || zoomInvited[user._id]) && (
                                                        <Button
                                                            id={`zoom-user-${user._id}`}
                                                            variant="ghost"
                                                            size="icon"
                                                            className={`h-8 w-8 transition-all ${
                                                                zoomInvited[user._id]
                                                                    ? "text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20"
                                                                    : "text-muted-foreground hover:text-sky-500 hover:bg-sky-500/10"
                                                            }`}
                                                            onClick={() => handleZoomInvite(user)}
                                                            disabled={invitingZoom[user._id] || !isDefaultAdmin}
                                                            title={zoomInvited[user._id] ? "In Zoom User Management" : "Invite to Zoom User Management (Basic Plan)"}
                                                        >
                                                            {invitingZoom[user._id] ? (
                                                                <Loader2 size={14} className="animate-spin text-sky-500" />
                                                            ) : zoomInvited[user._id] ? (
                                                                <Check size={14} className="text-emerald-500 font-bold" />
                                                            ) : (
                                                                <Video size={14} />
                                                            )}
                                                        </Button>
                                                    )}
                                                    <Button
                                                        id={`availability-user-${user._id}`}
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                                        onClick={() => setAvailabilityTarget(user)}
                                                        title="Set availability"
                                                    >
                                                        <CalendarDays size={14} />
                                                    </Button>
                                                    <Button
                                                        id={`edit-user-${user._id}`}
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                        onClick={() => openEdit(user)}
                                                        disabled={!isDefaultAdmin}
                                                        aria-label="Edit user"
                                                    >
                                                        <Pencil size={14} />
                                                    </Button>
                                                    <Button
                                                        id={`delete-user-${user._id}`}
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => setDeleteTarget(user)}
                                                        disabled={!isDefaultAdmin}
                                                        aria-label="Delete user"
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                {/* ── Mobile/Tablet/iPad Grid View ── */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:hidden">
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="bg-card border rounded-xl p-5 space-y-4 shadow-sm animate-pulse">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-muted" />
                                        <div className="space-y-2 flex-1">
                                            <div className="h-4 bg-muted rounded w-1/2" />
                                            <div className="h-3 bg-muted rounded w-3/4" />
                                        </div>
                                    </div>
                                    <div className="h-4 bg-muted rounded w-1/3" />
                                    <div className="h-8 bg-muted rounded" />
                                </div>
                            ))
                        ) : filtered.length === 0 ? (
                            <div className="col-span-full bg-card border rounded-xl p-8 text-center text-muted-foreground shadow-sm">
                                <div className="flex flex-col items-center gap-2">
                                    <Users size={32} className="text-muted-foreground/30" />
                                    <span>
                                        {search ? "No results match your search." : "No team members yet. Invite someone to get started."}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            filtered.map((user) => {
                                const livePresence = getUserLivePresence(user);
                                return (
                                <div 
                                    key={user._id} 
                                    className={`bg-card border rounded-xl p-5 space-y-4 shadow-sm relative transition-all duration-200 ${!user.isActive ? "bg-muted/10 border-dashed" : ""}`}
                                >
                                    {/* Header: Avatar, Name, Email, and Role Badge */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="relative shrink-0">
                                                <div
                                                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 select-none
                                                        ${user.isActive
                                                            ? "bg-primary/20 text-primary"
                                                            : "bg-muted text-muted-foreground"
                                                        }`}
                                                >
                                                    {(user.name || user.username).charAt(0).toUpperCase()}
                                                </div>
                                                {user.isActive && (
                                                    <span
                                                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${
                                                            livePresence.status === 'online'
                                                                ? 'bg-emerald-500'
                                                                : livePresence.status === 'away'
                                                                ? 'bg-amber-500'
                                                                : 'bg-zinc-400 dark:bg-zinc-600'
                                                        }`}
                                                    />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-sm text-foreground truncate">
                                                    {user.name || "—"}
                                                </p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {user.username}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Role & Live Status Badge */}
                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                            <span
                                                className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border shrink-0 ${getRoleStyle(user.role)}`}
                                            >
                                                <Shield size={10} />
                                                {getRoleLabel(user.role)}
                                            </span>
                                            {user.isActive && (
                                                livePresence.status === 'online' ? (
                                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.2 rounded-full">
                                                        ● Online
                                                    </span>
                                                ) : livePresence.status === 'away' ? (
                                                    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.2 rounded-full">
                                                        ● Away
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {formatLastSeen(livePresence.lastActiveAt)}
                                                    </span>
                                                )
                                            )}
                                        </div>
                                    </div>

                                    {/* Body: Phone, Status & Joined Date */}
                                    <div className="grid grid-cols-3 gap-4 py-2 border-y border-border/50 text-xs">
                                        <div>
                                            <p className="text-muted-foreground mb-1">Phone</p>
                                            <div className="flex items-center gap-1.5 text-muted-foreground font-mono font-medium mt-1">
                                                <Phone size={12} />
                                                <span className="truncate">{user.phone || "—"}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground mb-1">Status</p>
                                            <div className={`flex items-center gap-2 transition-all ${!isDefaultAdmin ? "blur-[0.5px] opacity-40 cursor-not-allowed pointer-events-none" : ""}`}>
                                                <Switch
                                                    id={`toggle-mobile-${user._id}`}
                                                    checked={user.isActive}
                                                    onCheckedChange={() => handleToggle(user)}
                                                    disabled={toggling[user._id] || !isDefaultAdmin}
                                                    aria-label={user.isActive ? "Deactivate user" : "Activate user"}
                                                />
                                                <span className={`font-semibold ${user.isActive ? "text-emerald-500" : "text-muted-foreground"}`}>
                                                    {user.isActive ? "Active" : "Inactive"}
                                                </span>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground mb-1">Joined</p>
                                            <div className="flex items-center gap-1.5 text-muted-foreground font-medium mt-1">
                                                <Calendar size={13} />
                                                {new Date(user.createdAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer Actions */}
                                    {(() => {
                                        const showZoom = !inZoomEmails.has((user.email || user.username || "").toLowerCase()) || zoomInvited[user._id];
                                        return (
                                            <div className={`grid ${showZoom ? "grid-cols-2" : "grid-cols-3"} gap-2 w-full pt-2`}>
                                                {showZoom && (
                                                    <Button
                                                        id={`zoom-user-mobile-${user._id}`}
                                                        variant="outline"
                                                        size="sm"
                                                        className={`w-full h-9 px-3 rounded-lg justify-center gap-1.5 text-xs font-semibold transition-all ${
                                                            zoomInvited[user._id]
                                                                ? "text-emerald-600 border-emerald-500/30 bg-emerald-500/10 dark:text-emerald-400"
                                                                : "text-muted-foreground border-border/80 hover:text-sky-500 hover:bg-sky-500/10"
                                                        }`}
                                                        onClick={() => handleZoomInvite(user)}
                                                        disabled={invitingZoom[user._id] || !isDefaultAdmin}
                                                    >
                                                        {invitingZoom[user._id] ? (
                                                            <Loader2 size={13} className="animate-spin" />
                                                        ) : zoomInvited[user._id] ? (
                                                            <Check size={13} className="text-emerald-500 font-bold" />
                                                        ) : (
                                                            <Video size={13} />
                                                        )}
                                                        {zoomInvited[user._id] ? "Zoom Added" : "Zoom Invite"}
                                                    </Button>
                                                )}
                                                <Button
                                                    id={`availability-mobile-${user._id}`}
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full h-9 px-3 rounded-lg justify-center gap-1.5 text-xs font-semibold text-primary border-primary/20 hover:bg-primary/10"
                                                    onClick={() => setAvailabilityTarget(user)}
                                                >
                                                    <CalendarDays size={13} />
                                                    Availability
                                                </Button>
                                                <Button
                                                    id={`edit-user-mobile-${user._id}`}
                                                    variant="outline"
                                                    size="sm"
                                                    className={`w-full h-9 px-3 rounded-lg justify-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground border-border/80 ${!isDefaultAdmin ? "blur-[0.5px] opacity-40 cursor-not-allowed pointer-events-none" : ""}`}
                                                    onClick={() => openEdit(user)}
                                                    disabled={!isDefaultAdmin}
                                                >
                                                    <Pencil size={13} />
                                                    Edit
                                                </Button>
                                                <Button
                                                    id={`delete-user-mobile-${user._id}`}
                                                    variant="outline"
                                                    size="sm"
                                                    className={`w-full h-9 px-3 rounded-lg justify-center gap-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 border-destructive/20 hover:border-destructive/30 ${!isDefaultAdmin ? "blur-[0.5px] opacity-40 cursor-not-allowed pointer-events-none" : ""}`}
                                                    onClick={() => setDeleteTarget(user)}
                                                    disabled={!isDefaultAdmin}
                                                >
                                                    <Trash2 size={13} />
                                                    Delete
                                                </Button>
                                            </div>
                                        );
                                    })()}
                                </div>
                                );
                            })
                        )}
                    </div>

                {/* ── How it works callout ── */}
                <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 flex gap-3 items-start">
                    <KeyRound size={18} className="text-primary mt-0.5 shrink-0" />
                    <div className="text-sm">
                        <p className="font-semibold text-foreground mb-1">How multi-user access works</p>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                            Each team member logs in with their <strong>email address</strong> as the username and the
                            password you set. Deactivating a user immediately blocks their login without deleting their
                            account. Roles control what they see —{" "}
                            <strong>Admin</strong> has full access,{" "}
                            <strong>Manager</strong> can update task statuses and has elevated access,{" "}
                            <strong>Sales Rep</strong> has standard CRM access for day-to-day operations,{" "}
                            <strong>View Only</strong> can read all data but cannot make any changes, calls, or create follow-ups.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Add / Edit Team Member Modal ── */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent aria-describedby={undefined} className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {editingUser ? (
                                <>
                                    <Pencil size={16} className="text-primary" />
                                    Edit Team Member
                                </>
                            ) : (
                                <>
                                    <Plus size={16} className="text-primary" />
                                    Invite Team Member
                                </>
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {editingUser
                                ? "Update this user's details. Leave password blank to keep it unchanged."
                                : "Create a new CRM account. The user can log in immediately with their email and password."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Name */}
                        <div className="space-y-1.5">
                            <Label htmlFor="form-name">Full Name</Label>
                            <Input
                                id="form-name"
                                placeholder="Jane Smith"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                            />
                        </div>

                        {/* Email */}
                        <div className="space-y-1.5">
                            <Label htmlFor="form-email">
                                Email Address <span className="text-destructive">*</span>
                            </Label>
                            <div className="relative">
                                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    id="form-email"
                                    type="email"
                                    placeholder="jane@company.com"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    className="pl-9"
                                    disabled={!!editingUser}
                                />
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                This becomes their login username.
                            </p>
                        </div>

                        {/* Phone Number */}
                        <div className="space-y-1.5">
                            <Label htmlFor="form-phone">Phone Number</Label>
                            <div className="relative">
                                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    id="form-phone"
                                    type="text"
                                    placeholder="+1 (555) 000-0000"
                                    value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                    className="pl-9"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <Label htmlFor="form-password">
                                {editingUser ? "New Password" : "Temporary Password"}
                                {!editingUser && <span className="text-destructive"> *</span>}
                            </Label>
                            <div className="relative">
                                <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    id="form-password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder={editingUser ? "Leave blank to keep current" : "Min. 6 characters"}
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    className="pl-9 pr-20"
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showPassword ? "Hide" : "Show"}
                                </button>
                            </div>
                        </div>

                        {/* Role */}
                        <div className="space-y-1.5">
                            <Label htmlFor="form-role">Role / Permission Level</Label>
                            <Select
                                value={form.role}
                                onValueChange={(val) => setForm({ ...form, role: val })}
                            >
                                <SelectTrigger id="form-role">
                                    <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                    {ROLES.map((r) => (
                                        <SelectItem key={r.value} value={r.value}>
                                            <div className="flex items-center gap-2">
                                                <Shield size={12} />
                                                {r.label}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[11px] text-muted-foreground">
                                Admin = full access · Manager = elevated access · Sales Rep = standard CRM access . View Only = Read Only Access
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setModalOpen(false)}
                            disabled={submitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            id="btn-submit-member"
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="gap-2"
                        >
                            {submitting ? (
                                "Saving…"
                            ) : editingUser ? (
                                <>
                                    <Pencil size={14} /> Save Changes
                                </>
                            ) : (
                                <>
                                    <UserCheck size={14} /> Create Account
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>


            {/* ── Team Member Delete Confirmation ── */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Trash2 size={16} className="text-destructive" />
                            Remove Team Member?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete{" "}
                            <strong>{deleteTarget?.name || deleteTarget?.username}</strong>'s account.
                            They will lose all access immediately. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            id="btn-confirm-delete"
                            onClick={handleDelete}
                            disabled={deleting}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                            {deleting ? "Removing…" : "Yes, Remove"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>



            {/* ── Availability Modal ── */}
            <AvailabilityModal
                user={availabilityTarget}
                open={!!availabilityTarget}
                onClose={() => setAvailabilityTarget(null)}
            />
        </AppLayout>
    );
}
