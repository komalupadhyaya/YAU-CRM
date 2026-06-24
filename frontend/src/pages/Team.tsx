import { useEffect, useState, useCallback } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import {
    Users,
    Shield,
    Mail,
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

interface TeamUser {
    _id: string;
    username: string;
    name?: string;
    email?: string;
    role: string;
    isActive: boolean;
    createdAt: string;
}


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
};

export default function Team() {
    const [users, setUsers] = useState<TeamUser[]>([]);
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

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

    // Role-based permissions
    const permissions = can(currentUser?.role);
    const isDefaultAdmin = permissions.manageTeam; // admin only

    const loadUsers = async () => {
        try {
            const res = await api.get("/team");
            setUsers(res.data);
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
            u.username.toLowerCase().includes(q) ||
            u.role.toLowerCase().includes(q)
        );
    });

    const totalActive = users.filter((u) => u.isActive).length;
    const totalAdmins = users.filter((u) => u.role === "admin").length;

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
                              ? 'Create and manage internal CRM users with separate logins and role-based access.'
                              : 'View your team members and their roles.'}
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-card border rounded-xl p-4 flex items-center gap-3 shadow-sm">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Users size={18} className="text-primary" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{users.length}</p>
                            <p className="text-xs text-muted-foreground">Total Members</p>
                        </div>
                    </div>
                    <div className="bg-card border rounded-xl p-4 flex items-center gap-3 shadow-sm">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <UserCheck size={18} className="text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{totalActive}</p>
                            <p className="text-xs text-muted-foreground">Active</p>
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
                                    <TableHead className="w-[260px]">Member</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Joined</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    Array.from({ length: 3 }).map((_, i) => (
                                        <TableRow key={i}>
                                            {Array.from({ length: 6 }).map((_, j) => (
                                                <TableCell key={j}>
                                                    <div className="h-4 bg-muted animate-pulse rounded" />
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                                ) : filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-40 text-center text-muted-foreground">
                                            <div className="flex flex-col items-center gap-2">
                                                <Users size={32} className="text-muted-foreground/30" />
                                                <span>
                                                    {search ? "No results match your search." : "No team members yet. Invite someone to get started."}
                                                </span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filtered.map((user) => (
                                        <TableRow key={user._id} className={!user.isActive ? "bg-muted/10 border-dashed" : ""}>
                                            {/* Avatar + Name */}
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0
                                                            ${user.isActive
                                                                ? "bg-primary/20 text-primary"
                                                                : "bg-muted text-muted-foreground"
                                                            }`}
                                                    >
                                                        {(user.name || user.username).charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-sm truncate">
                                                            {user.name || "—"}
                                                        </p>
                                                        <p className="text-[11px] text-muted-foreground truncate">
                                                            {user.username}
                                                        </p>
                                                    </div>
                                                </div>
                                            </TableCell>

                                            {/* Email */}
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Mail size={13} />
                                                    <span className="truncate max-w-[200px]">
                                                        {user.email || user.username}
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
                                            <TableCell className="text-right">
                                                <div className={`flex items-center justify-end gap-1 transition-all ${!isDefaultAdmin ? "blur-[0.5px] opacity-40 cursor-not-allowed pointer-events-none" : ""}`}>
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
                                    ))
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
                            filtered.map((user) => (
                                <div 
                                    key={user._id} 
                                    className={`bg-card border rounded-xl p-5 space-y-4 shadow-sm relative transition-all duration-200 ${!user.isActive ? "bg-muted/10 border-dashed" : ""}`}
                                >
                                    {/* Header: Avatar, Name, Email, and Role Badge */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div
                                                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 select-none
                                                    ${user.isActive
                                                        ? "bg-primary/20 text-primary"
                                                        : "bg-muted text-muted-foreground"
                                                    }`}
                                            >
                                                {(user.name || user.username).charAt(0).toUpperCase()}
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

                                        {/* Role Badge */}
                                        <span
                                            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border shrink-0 ${getRoleStyle(user.role)}`}
                                        >
                                            <Shield size={10} />
                                            {getRoleLabel(user.role)}
                                        </span>
                                    </div>

                                    {/* Body: Status & Joined Date */}
                                    <div className="grid grid-cols-2 gap-4 py-2 border-y border-border/50 text-xs">
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
                                    <div className="flex items-center justify-end gap-2 pt-1">
                                        <Button
                                            id={`availability-mobile-${user._id}`}
                                            variant="outline"
                                            size="sm"
                                            className="h-8 gap-1.5 text-xs text-primary border-primary/20 hover:bg-primary/10"
                                            onClick={() => setAvailabilityTarget(user)}
                                        >
                                            <CalendarDays size={12} />
                                            Availability
                                        </Button>
                                        <div className={`flex items-center gap-2 transition-all ${!isDefaultAdmin ? "blur-[0.5px] opacity-40 cursor-not-allowed pointer-events-none" : ""}`}>
                                            <Button
                                                id={`edit-user-mobile-${user._id}`}
                                                variant="outline"
                                                size="sm"
                                                className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                                                onClick={() => openEdit(user)}
                                                disabled={!isDefaultAdmin}
                                            >
                                                <Pencil size={12} />
                                                Edit
                                            </Button>
                                            <Button
                                                id={`delete-user-mobile-${user._id}`}
                                                variant="outline"
                                                size="sm"
                                                className="h-8 gap-1.5 text-xs text-destructive hover:bg-destructive/10 border-destructive/20 hover:border-destructive/30"
                                                onClick={() => setDeleteTarget(user)}
                                                disabled={!isDefaultAdmin}
                                            >
                                                <Trash2 size={12} />
                                                Delete
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))
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
