import { useEffect, useRef, useState, useCallback } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import {
    CheckSquare, Plus, Trash2, CheckCircle2, Clock, Calendar,
    AlertCircle, Edit2, X, Search, User as UserIcon, ChevronDown,
    Flag, ArrowUpCircle, Minus, Loader2, History, RotateCcw
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "../context/AuthContext";
import { can } from "../utils/permissions";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DateTimePicker } from "@/components/ui/datetime-picker";
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssignedUser {
    _id: string;
    name: string;
    email: string;
    role: string;
}

interface Task {
    _id: string;
    title: string;
    description?: string;
    status: "pending" | "completed";
    priority: "high" | "medium" | "low";
    dueDate?: string;
    assignedTo?: AssignedUser | null;
    createdBy?: {
        name: string;
        email: string;
    } | null;
    createdAt: string;
    completedAt?: string;
    isDeleted?: boolean;
    deletedBy?: {
        name: string;
        email: string;
    } | null;
    deletedAt?: string;
}

interface TeamMember {
    _id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
}

interface CurrentUser {
    _id: string;
    name: string;
    email: string;
    role: string;
}

interface TaskHistoryItem {
    _id: string;
    task_id: string;
    task_title: string;
    action: 'create' | 'update' | 'complete' | 'delete' | 'restore';
    performed_by: {
        _id: string;
        name: string;
        email: string;
        role: string;
    };
    changes: any;
    createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
    high: {
        label: "High",
        icon: ArrowUpCircle,
        color: "text-red-500",
        bg: "bg-red-500/10",
        border: "border-red-500/20",
        dot: "bg-red-500",
    },
    medium: {
        label: "Medium",
        icon: Minus,
        color: "text-orange-400",
        bg: "bg-orange-400/10",
        border: "border-orange-400/20",
        dot: "bg-orange-400",
    },
    low: {
        label: "Low",
        icon: ChevronDown,
        color: "text-blue-400",
        bg: "bg-blue-400/10",
        border: "border-blue-400/20",
        dot: "bg-blue-400",
    },
};

const formatDate = (date?: string) => {
    if (!date) return null;
    return new Date(date).toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    });
};

const formatDateTime = (date?: string) => {
    if (!date) return null;
    return new Date(date).toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    });
};

const isDueSoon = (dueDate?: string) => {
    if (!dueDate) return false;
    const diff = new Date(dueDate).getTime() - Date.now();
    return diff > 0 && diff < 48 * 60 * 60 * 1000; // within 48 hours
};

const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate).getTime() < Date.now();
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: "high" | "medium" | "low" }) {
    const cfg = PRIORITY_CONFIG[priority];
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
            <Icon size={10} />
            {cfg.label}
        </span>
    );
}

function StatusBadge({ status }: { status: "pending" | "completed" }) {
    if (status === "completed") {
        return (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-green-500/10 text-green-500 border-green-500/20">
                <CheckCircle2 size={10} />
                Completed
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-orange-400/10 text-orange-400 border-orange-400/20">
            <Clock size={10} />
            Pending
        </span>
    );
}

function UserAvatar({ user, size = "sm" }: { user: AssignedUser; size?: "sm" | "xs" }) {
    const initials = user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    const sizeClass = size === "sm" ? "w-6 h-6 text-[10px]" : "w-5 h-5 text-[9px]";
    return (
        <span
            className={`${sizeClass} rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center shrink-0 ring-1 ring-primary/30`}
            title={user.name}
        >
            {initials}
        </span>
    );
}

// ─── User Search Dropdown ──────────────────────────────────────────────────────

interface UserSearchDropdownProps {
    teamMembers: TeamMember[];
    value: TeamMember | null;
    onChange: (user: TeamMember | null) => void;
    disabled?: boolean;
}

function UserSearchDropdown({ teamMembers, value, onChange, disabled }: UserSearchDropdownProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const filtered = teamMembers.filter(
        (m) =>
            m.isActive &&
            (m.name.toLowerCase().includes(query.toLowerCase()) ||
                m.email.toLowerCase().includes(query.toLowerCase()))
    );

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false);
                setQuery("");
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const handleOpen = () => {
        if (disabled) return;
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const handleSelect = (member: TeamMember | null) => {
        onChange(member);
        setOpen(false);
        setQuery("");
    };

    return (
        <div ref={wrapperRef} className="relative">
            <button
                type="button"
                onClick={handleOpen}
                disabled={disabled}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm transition-all duration-150
                    ${open ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50"}
                    bg-background text-foreground disabled:opacity-60 disabled:cursor-not-allowed`}
            >
                {value ? (
                    <>
                        <UserAvatar
                            user={{ _id: value._id, name: value.name, email: value.email, role: value.role }}
                        />
                        <div className="flex-1 min-w-0 flex flex-col text-left">
                            <span className="font-semibold text-xs text-foreground truncate leading-normal">{value.name}</span>
                            <span className="text-[10px] text-muted-foreground truncate leading-none mt-0.5">{value.email}</span>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleSelect(null); }}
                            className="ml-1 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        >
                            <X size={12} />
                        </button>
                    </>
                ) : (
                    <>
                        <UserIcon size={14} className="text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground flex-1 text-left">Assign to team member...</span>
                        <ChevronDown size={14} className="text-muted-foreground" />
                    </>
                )}
            </button>

            {open && (
                <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-xl shadow-xl overflow-hidden">
                    <div className="p-2 border-b border-border">
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/60">
                            <Search size={13} className="text-muted-foreground shrink-0" />
                            <input
                                ref={inputRef}
                                id="task-assignee-search"
                                name="task-assignee-search"
                                type="text"
                                placeholder="Search team members..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
                            />
                        </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                        <button
                            type="button"
                            onClick={() => handleSelect(null)}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent/50 transition-colors text-left"
                        >
                            <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                                <UserIcon size={12} />
                            </span>
                            Unassigned
                        </button>
                        {filtered.length === 0 ? (
                            <div className="px-3 py-4 text-center text-sm text-muted-foreground">No members found</div>
                        ) : (
                            filtered.map((member) => (
                                <button
                                    key={member._id}
                                    type="button"
                                    onClick={() => handleSelect(member)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-accent/50 transition-colors text-left
                                        ${value?._id === member._id ? "bg-primary/10 text-primary" : "text-foreground"}`}
                                >
                                    <UserAvatar
                                        user={{ _id: member._id, name: member.name, email: member.email, role: member.role }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate">{member.name}</div>
                                        <div className="text-[11px] text-muted-foreground truncate">{member.email}</div>
                                    </div>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground capitalize shrink-0">
                                        {member.role}
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Task Form ────────────────────────────────────────────────────────────────

interface TaskFormProps {
    teamMembers: TeamMember[];
    currentUser: CurrentUser | null;
    editingTask?: Task | null;
    onSuccess: (task: Task) => void;
    onCancelEdit?: () => void;
}

function TaskForm({ teamMembers, currentUser, editingTask, onSuccess, onCancelEdit }: TaskFormProps) {
    const [title, setTitle] = useState(editingTask?.title ?? "");
    const [description, setDescription] = useState(editingTask?.description ?? "");
    const [dueDate, setDueDate] = useState(
        editingTask?.dueDate ? new Date(editingTask.dueDate).toISOString().slice(0, 16) : ""
    );
    const [assignedTo, setAssignedTo] = useState<TeamMember | null>(
        editingTask?.assignedTo
            ? teamMembers.find((m) => m._id === (editingTask.assignedTo as AssignedUser)._id) ?? null
            : null
    );
    const [priority, setPriority] = useState<"high" | "medium" | "low">(editingTask?.priority ?? "medium");
    const [status, setStatus] = useState<"pending" | "completed">(editingTask?.status ?? "pending");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isEditing = !!editingTask;
    const canChangeStatus =
        currentUser?.role === "admin" || currentUser?.role === "manager";

    useEffect(() => {
        setTitle(editingTask?.title ?? "");
        setDescription(editingTask?.description ?? "");
        setDueDate(editingTask?.dueDate ? new Date(editingTask.dueDate).toISOString().slice(0, 16) : "");
        setAssignedTo(
            editingTask?.assignedTo
                ? teamMembers.find((m) => m._id === (editingTask.assignedTo as AssignedUser)?._id) ?? null
                : null
        );
        setPriority(editingTask?.priority ?? "medium");
        setStatus(editingTask?.status ?? "pending");
    }, [editingTask, teamMembers]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;
        setIsSubmitting(true);
        try {
            const payload = {
                title: title.trim(),
                description: description.trim(),
                dueDate: dueDate || null,
                assignedTo: assignedTo?._id ?? null,
                priority,
                ...(isEditing && canChangeStatus ? { status } : {}),
            };

            const res = isEditing
                ? await api.put(`/tasks/${editingTask!._id}`, payload)
                : await api.post("/tasks", payload);

            onSuccess(res.data);
            if (!isEditing) {
                setTitle("");
                setDescription("");
                setDueDate("");
                setAssignedTo(null);
                setPriority("medium");
            }
            toast.success(isEditing ? "Task updated" : "Task created");
        } catch {
            toast.error(isEditing ? "Failed to update task" : "Failed to create task");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div className="space-y-1.5">
                <label htmlFor="task-title" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Title <span className="text-destructive">*</span>
                </label>
                <input
                    id="task-title"
                    name="task-title"
                    type="text"
                    placeholder="Task title..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="input-field"
                />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
                <label htmlFor="task-description" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Description
                </label>
                <textarea
                    id="task-description"
                    name="task-description"
                    placeholder="Add a description..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="input-field resize-none"
                />
            </div>

            {/* Due Date */}
            <div className="space-y-1.5">
                <label htmlFor="task-due-date" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar size={11} />
                    Due Date
                </label>
                <DateTimePicker id="task-due-date" value={dueDate} onChange={setDueDate} layout="stacked" />
            </div>

            {/* Assigned User */}
            {currentUser?.role !== 'sales_rep' && (
                <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <UserIcon size={11} />
                        Assigned User
                    </span>
                    <UserSearchDropdown
                        teamMembers={teamMembers}
                        value={assignedTo}
                        onChange={setAssignedTo}
                    />
                </div>
            )}

            {/* Priority */}
            <div className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Flag size={11} />
                    Priority
                </span>
                <div className="grid grid-cols-3 gap-2">
                    {(["high", "medium", "low"] as const).map((p) => {
                        const cfg = PRIORITY_CONFIG[p];
                        const Icon = cfg.icon;
                        return (
                            <button
                                key={p}
                                type="button"
                                onClick={() => setPriority(p)}
                                className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg border text-xs font-semibold transition-all duration-150
                                    ${priority === p
                                        ? `${cfg.bg} ${cfg.color} ${cfg.border} shadow-sm`
                                        : "border-border text-muted-foreground hover:border-primary/40 hover:bg-accent/50"
                                    }`}
                            >
                                <Icon size={14} />
                                {cfg.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Status — only shown when editing AND user has permission */}
            {isEditing && canChangeStatus && (
                <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 size={11} />
                        Status
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                        {(["pending", "completed"] as const).map((s) => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => setStatus(s)}
                                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-xs font-semibold transition-all duration-150 capitalize
                                    ${status === s
                                        ? s === "completed"
                                            ? "bg-green-500/15 text-green-500 border-green-500/30 shadow-sm"
                                            : "bg-orange-400/15 text-orange-400 border-orange-400/30 shadow-sm"
                                        : "border-border text-muted-foreground hover:border-primary/40 hover:bg-accent/50"
                                    }`}
                            >
                                {s === "completed" ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className={`flex gap-2 pt-1 ${isEditing ? "flex-row" : "flex-col"}`}>
                <Button
                    type="submit"
                    id={isEditing ? "task-update-btn" : "task-create-btn"}
                    className="flex-1 gap-2 font-semibold"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <><Loader2 size={14} className="animate-spin" /> Saving...</>
                    ) : isEditing ? (
                        <><Edit2 size={14} /> Update Task</>
                    ) : (
                        <><Plus size={14} /> Add Task</>
                    )}
                </Button>
                {isEditing && onCancelEdit && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onCancelEdit}
                        className="gap-1.5"
                    >
                        <X size={14} /> Cancel
                    </Button>
                )}
            </div>
        </form>
    );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

interface TaskCardProps {
    task: Task;
    onEdit: (task: Task) => void;
    onDelete: (id: string) => void;
    onComplete?: (id: string) => void;
    onRestore?: (id: string) => void;
    onViewDetails: (task: Task) => void;
    currentUser: CurrentUser | null;
}

function TaskCard({ task, onEdit, onDelete, onComplete, onRestore, onViewDetails, currentUser }: TaskCardProps) {
    const overdue = isOverdue(task.dueDate) && task.status === "pending";
    const dueSoon = isDueSoon(task.dueDate) && task.status === "pending";
    const permissions = can(currentUser?.role);
    const canChangeStatus = permissions.completeItems;
    const canViewHistory = currentUser?.role === 'admin' || currentUser?.role === 'manager';

    return (
        <div
            onClick={canViewHistory ? () => onViewDetails(task) : undefined}
            className={`group relative bg-card border border-l-4 rounded-xl p-3 sm:p-4 transition-all duration-200 
                ${canViewHistory ? "cursor-pointer hover:border-primary/40 hover:shadow-sm" : ""}
                ${task.isDeleted ? "border-l-destructive bg-destructive/5 opacity-80" : task.priority === "high" ? "border-l-red-500" : task.priority === "medium" ? "border-l-orange-400" : "border-l-blue-400"}
                ${task.status === "completed" ? "border-border/50 opacity-70" : "border-border"}
                ${overdue && !task.isDeleted ? "border-red-500/30 bg-red-500/5" : ""}`}
        >
            <div className="pl-1 sm:pl-1.5">
                <div className="flex items-start justify-between gap-2 sm:gap-3">
                    {/* Left content */}
                    <div className="flex-1 min-w-0">
                        <h3
                            className={`font-semibold text-sm leading-snug ${
                                task.status === "completed"
                                    ? "line-through text-muted-foreground decoration-muted-foreground/50"
                                    : "text-foreground"
                            }`}
                        >
                            {task.title}
                        </h3>

                        {task.description && (
                            <p
                                className={`text-xs mt-1 leading-relaxed line-clamp-2 ${
                                    task.status === "completed"
                                        ? "text-muted-foreground/60"
                                        : "text-muted-foreground"
                                }`}
                            >
                                {task.description}
                            </p>
                        )}

                        {/* Meta row ── */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                            {!task.isDeleted && <PriorityBadge priority={task.priority} />}
                            {!task.isDeleted && <StatusBadge status={task.status} />}

                            {task.isDeleted && task.deletedBy && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-destructive/10 text-destructive border-destructive/20">
                                    <Trash2 size={9} className="shrink-0" />
                                    Deleted by {task.deletedBy.name} on {formatDateTime(task.deletedAt)}
                                </span>
                            )}

                            {task.dueDate && !task.isDeleted && (
                                <span
                                    className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border max-w-full
                                        ${overdue
                                            ? "bg-red-500/10 text-red-500 border-red-500/20"
                                            : dueSoon
                                            ? "bg-orange-400/10 text-orange-400 border-orange-400/20"
                                            : "bg-muted text-muted-foreground border-transparent"
                                        }`}
                                >
                                    <Calendar size={9} className="shrink-0" />
                                    <span className="truncate">
                                        {overdue ? "Overdue · " : dueSoon ? "Due soon · " : ""}
                                        Due: {formatDate(task.dueDate)}
                                    </span>
                                </span>
                            )}
                            {task.assignedTo && currentUser?.role !== 'sales_rep' && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground max-w-[140px] sm:max-w-none cursor-help hover:text-foreground transition-colors" onClick={(e) => e.stopPropagation()}>
                                            <UserAvatar user={task.assignedTo} size="xs" />
                                            <span className="truncate">{task.assignedTo.name}</span>
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent className="p-3 max-w-[280px] bg-card text-foreground border shadow-lg rounded-xl flex flex-col gap-2">
                                        <div className="space-y-0.5">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Assigned To</p>
                                            <p className="text-xs font-semibold">{task.assignedTo.name}</p>
                                            <p className="text-[11px] text-muted-foreground font-medium">{task.assignedTo.email}</p>
                                        </div>
                                        {task.createdBy && (
                                            <div className="border-t border-border pt-1.5 mt-0.5 space-y-0.5">
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Assigned From</p>
                                                <p className="text-xs font-semibold">{task.createdBy.name}</p>
                                                <p className="text-[11px] text-muted-foreground font-medium">{task.createdBy.email}</p>
                                            </div>
                                        )}
                                    </TooltipContent>
                                </Tooltip>
                            )}

                            {task.status === "completed" && task.completedAt && !task.isDeleted && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-green-500">
                                    <CheckCircle2 size={9} className="shrink-0" />
                                    <span className="truncate hidden sm:inline">Completed On: {formatDateTime(task.completedAt)}</span>
                                    <span className="truncate sm:hidden">{new Date(task.completedAt).toLocaleDateString()}</span>
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:transition-opacity">
                        {task.isDeleted ? (
                            currentUser?.role === 'admin' && (
                                <>
                                    {onRestore && (
                                        <button
                                            id={`task-restore-${task._id}`}
                                            onClick={(e) => { e.stopPropagation(); onRestore(task._id); }}
                                            title="Restore task"
                                            className="w-7 h-7 flex items-center justify-center rounded-lg border border-green-500/20 text-green-500 hover:bg-green-500/15 active:scale-95 transition-all duration-150"
                                        >
                                            <RotateCcw size={12} />
                                        </button>
                                    )}
                                    <button
                                        id={`task-delete-permanent-${task._id}`}
                                        onClick={(e) => { e.stopPropagation(); onDelete(task._id); }}
                                        title="Delete permanently"
                                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-destructive/20 text-destructive hover:bg-destructive/15 active:scale-95 transition-all duration-150"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </>
                            )
                        ) : (
                            <>
                                {task.status === "pending" && canChangeStatus && onComplete && (
                                    <button
                                        id={`task-complete-${task._id}`}
                                        onClick={(e) => { e.stopPropagation(); onComplete(task._id); }}
                                        title="Mark complete"
                                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-green-500/20 text-green-500 hover:bg-green-500/15 active:scale-95 transition-all duration-150"
                                    >
                                        <CheckCircle2 size={13} />
                                    </button>
                                )}
                                {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                                <button
                                    id={`task-edit-${task._id}`}
                                    onClick={(e) => { e.stopPropagation(); onEdit(task); }}
                                    title="Edit task"
                                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/10 active:scale-95 transition-all duration-150"
                                >
                                    <Edit2 size={12} />
                                </button>
                                )}
                                {permissions.deleteRecords && (
                                <button
                                    id={`task-delete-${task._id}`}
                                    onClick={(e) => { e.stopPropagation(); onDelete(task._id); }}
                                    title="Delete task"
                                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10 active:scale-95 transition-all duration-150"
                                >
                                    <Trash2 size={12} />
                                </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Tasks() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
    const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

    // Soft-deleted tasks states
    const [deletedTasks, setDeletedTasks] = useState<Task[]>([]);
    const [viewingDeletedTasks, setViewingDeletedTasks] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Global History states
    const [isGlobalHistoryOpen, setIsGlobalHistoryOpen] = useState(false);
    const [globalHistory, setGlobalHistory] = useState<TaskHistoryItem[]>([]);
    const [loadingGlobalHistory, setLoadingGlobalHistory] = useState(false);

    // Individual Task History states
    const [selectedTaskForHistory, setSelectedTaskForHistory] = useState<Task | null>(null);
    const [taskHistory, setTaskHistory] = useState<TaskHistoryItem[]>([]);
    const [loadingTaskHistory, setLoadingTaskHistory] = useState(false);

    const loadAll = useCallback(async () => {
        try {
            const hasTeamAccess = currentUser?.role === 'admin' || currentUser?.role === 'manager';
            const isAdmin = currentUser?.role === 'admin';
            const [tasksRes, teamRes, deletedRes] = await Promise.all([
                api.get("/tasks"),
                hasTeamAccess ? api.get("/team") : Promise.resolve({ data: [] }),
                isAdmin ? api.get("/tasks/deleted") : Promise.resolve({ data: [] }),
            ]);
            setTasks(tasksRes.data);
            setTeamMembers(teamRes.data);
            if (isAdmin) {
                setDeletedTasks(deletedRes.data);
            }
        } catch {
            toast.error("Failed to load tasks");
        } finally {
            setLoading(false);
        }
    }, [currentUser?.role]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    // Fetch Global Task History
    const fetchGlobalHistory = useCallback(async () => {
        setLoadingGlobalHistory(true);
        try {
            const res = await api.get("/tasks/history");
            setGlobalHistory(res.data);
        } catch {
            toast.error("Failed to load task history logs");
        } finally {
            setLoadingGlobalHistory(false);
        }
    }, []);

    useEffect(() => {
        if (isGlobalHistoryOpen) {
            fetchGlobalHistory();
        }
    }, [isGlobalHistoryOpen, fetchGlobalHistory]);

    // Fetch Individual Task History
    const fetchTaskHistory = useCallback(async (taskId: string) => {
        setLoadingTaskHistory(true);
        try {
            const res = await api.get(`/tasks/${taskId}/history`);
            setTaskHistory(res.data);
        } catch {
            toast.error("Failed to load task activity logs");
        } finally {
            setLoadingTaskHistory(false);
        }
    }, []);

    useEffect(() => {
        if (selectedTaskForHistory) {
            fetchTaskHistory(selectedTaskForHistory._id);
        }
    }, [selectedTaskForHistory, fetchTaskHistory]);

    const handleSuccess = (task: Task) => {
        setTasks((prev) => {
            const idx = prev.findIndex((t) => t._id === task._id);
            if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = task;
                return updated;
            }
            return [task, ...prev];
        });
        setEditingTask(null);
    };

    const handleComplete = async (id: string) => {
        try {
            const res = await api.put(`/tasks/${id}/complete`);
            setTasks((prev) => prev.map((t) => (t._id === id ? res.data : t)));
            toast.success("Task marked as completed");
            // If the currently viewed task is the completed one, refresh its details/history
            if (selectedTaskForHistory && selectedTaskForHistory._id === id) {
                setSelectedTaskForHistory(res.data);
                fetchTaskHistory(id);
            }
        } catch {
            toast.error("Failed to update task");
        }
    };

    const handleCompleteClick = (id: string) => {
        setCompletingTaskId(id);
    };

    const handleDelete = (id: string) => {
        setDeletingTaskId(id);
    };

    const executeDelete = async (id: string) => {
        const isDeletedTask = deletedTasks.some((t) => t._id === id);
        try {
            await api.delete(`/tasks/${id}`);
            
            if (isDeletedTask) {
                setDeletedTasks((prev) => prev.filter((t) => t._id !== id));
                toast.success("Task permanently deleted");
            } else {
                setTasks((prev) => prev.filter((t) => t._id !== id));
                if (currentUser?.role === 'admin') {
                    // Refetch deleted tasks to keep count/list accurate (for manager deletes)
                    api.get("/tasks/deleted").then((res) => {
                        setDeletedTasks(res.data);
                    });
                }
                toast.success("Task deleted");
            }

            if (editingTask?._id === id) setEditingTask(null);
            if (selectedTaskForHistory?._id === id) setSelectedTaskForHistory(null);
        } catch {
            toast.error("Failed to delete task");
        }
    };

    const handleRestore = async (id: string) => {
        try {
            const res = await api.put(`/tasks/${id}/restore`);
            setDeletedTasks((prev) => prev.filter((t) => t._id !== id));
            setTasks((prev) => [res.data, ...prev]);
            toast.success("Task restored successfully");
        } catch {
            toast.error("Failed to restore task");
        }
    };

    const filterBySearch = (taskList: Task[]) => {
        if (!searchQuery.trim()) return taskList;
        const query = searchQuery.toLowerCase();
        return taskList.filter((t) => {
            const titleMatch = t.title.toLowerCase().includes(query);
            const assignedUserMatch = t.assignedTo?.name.toLowerCase().includes(query) || false;
            return titleMatch || assignedUserMatch;
        });
    };

    const filteredActiveTasks = filterBySearch(tasks);
    const pendingTasks = filteredActiveTasks.filter((t) => t.status === "pending");
    const completedTasks = filteredActiveTasks.filter((t) => t.status === "completed");
    const filteredDeletedTasks = filterBySearch(deletedTasks);

    const renderChanges = (changes: any) => {
        if (!changes || Object.keys(changes).length === 0) return null;
        return (
            <div className="mt-1.5 text-[11px] text-muted-foreground space-y-1 bg-muted/40 p-2 rounded-lg border border-border/40">
                {Object.entries(changes).map(([field, value]: [string, any]) => {
                    if (field === 'assignedTo') {
                        const oldVal = value.old ? value.old.name : 'Unassigned';
                        const newVal = value.new ? value.new.name : 'Unassigned';
                        return (
                            <p key={field} className="flex items-center gap-1 flex-wrap">
                                👥 <span className="font-semibold text-foreground/80">Assignment:</span> 
                                <span>{oldVal}</span> ➔ <span className="font-bold text-primary">{newVal}</span>
                            </p>
                        );
                    }
                    if (field === 'dueDate') {
                        const oldVal = value.old ? new Date(value.old).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) : 'None';
                        const newVal = value.new ? new Date(value.new).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) : 'None';
                        return (
                            <p key={field} className="flex items-center gap-1 flex-wrap">
                                📅 <span className="font-semibold text-foreground/80">Due Date:</span> 
                                <span>{oldVal}</span> ➔ <span className="font-bold text-primary">{newVal}</span>
                            </p>
                        );
                    }
                    const fieldLabel = field.charAt(0).toUpperCase() + field.slice(1);
                    const oldVal = String(value.old || 'None');
                    const newVal = String(value.new || 'None');
                    return (
                        <p key={field} className="flex items-center gap-1 flex-wrap">
                            ✏️ <span className="font-semibold text-foreground/80">{fieldLabel}:</span> 
                            <span className="line-through">{oldVal}</span> ➔ <span className="font-bold text-primary">{newVal}</span>
                        </p>
                    );
                })}
            </div>
        );
    };

    const getActionLabel = (item: TaskHistoryItem) => {
        const actor = item.performed_by?.name || "System";
        const dateStr = new Date(item.createdAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true
        });

        if (item.action === 'create') {
            const assignedToName = item.changes?.assignedTo?.name || (item.changes?.assignedTo ? item.changes.assignedTo : 'Unassigned');
            return (
                <div className="flex gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
                    <div>
                        <p className="font-semibold text-foreground text-xs">Task Created</p>
                        <p className="text-muted-foreground text-[11px] leading-relaxed">
                            Created by <span className="font-bold text-foreground/80">{actor}</span> and assigned to <span className="font-bold text-foreground/80">{assignedToName}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">{dateStr}</p>
                    </div>
                </div>
            );
        }

        if (item.action === 'complete') {
            return (
                <div className="flex gap-2 w-full">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    <div className="w-full">
                        <p className="font-semibold text-foreground text-xs">Task Completed</p>
                        <p className="text-muted-foreground text-[11px] leading-relaxed">
                            Completed by <span className="font-bold text-foreground/80">{actor}</span>
                        </p>
                        {renderChanges(item.changes)}
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">{dateStr}</p>
                    </div>
                </div>
            );
        }

        if (item.action === 'delete') {
            return (
                <div className="flex gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                    <div>
                        <p className="font-semibold text-foreground text-xs">Task Deleted</p>
                        <p className="text-muted-foreground text-[11px] leading-relaxed">
                            Deleted by <span className="font-bold text-foreground/80">{actor}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">{dateStr}</p>
                    </div>
                </div>
            );
        }

        if (item.action === 'restore') {
            return (
                <div className="flex gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
                    <div>
                        <p className="font-semibold text-foreground text-xs">Task Restored</p>
                        <p className="text-muted-foreground text-[11px] leading-relaxed">
                            Restored by <span className="font-bold text-foreground/80">{actor}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">{dateStr}</p>
                    </div>
                </div>
            );
        }

        return (
            <div className="flex gap-2 w-full">
                <span className="w-2 h-2 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                <div className="w-full">
                    <p className="font-semibold text-foreground text-xs">Task Updated</p>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                        Updated by <span className="font-bold text-foreground/80">{actor}</span>
                    </p>
                    {renderChanges(item.changes)}
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">{dateStr}</p>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <AppLayout>
                <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
                    <Loader2 size={18} className="animate-spin" /> Loading tasks...
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="space-y-6 max-w-6xl mx-auto pb-12">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b pb-5">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5">
                            <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                                <CheckSquare size={16} className="text-primary" />
                            </span>
                            Internal Tasks
                        </h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            Manage and track your team's tasks and reminders.
                        </p>
                    </div>
                    {/* Stats & History pills */}
                    <div className="flex items-center gap-2 sm:gap-3 sm:pt-1 shrink-0">
                        <button
                            onClick={() => {
                                setViewingDeletedTasks(false);
                                setTimeout(() => {
                                    document.getElementById("pending-tasks-section")?.scrollIntoView({ behavior: "smooth" });
                                }, 50);
                            }}
                            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-full bg-orange-400/10 text-orange-400 border border-orange-400/20 hover:bg-orange-400/20 active:scale-95 transition-all duration-150 cursor-pointer"
                        >
                            <Clock size={11} />
                            {pendingTasks.length} Pending
                        </button>
                        <button
                            onClick={() => {
                                setViewingDeletedTasks(false);
                                setTimeout(() => {
                                    document.getElementById("completed-tasks-section")?.scrollIntoView({ behavior: "smooth" });
                                }, 50);
                            }}
                            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500/20 active:scale-95 transition-all duration-150 cursor-pointer"
                        >
                            <CheckCircle2 size={11} />
                            {completedTasks.length} Done
                        </button>
                        {currentUser?.role === 'admin' && (
                            <Button
                                variant={viewingDeletedTasks ? "destructive" : "outline"}
                                size="sm"
                                className={`h-8 text-xs font-bold gap-1.5 border-dashed active:scale-95 transition-all duration-150 ${
                                    viewingDeletedTasks 
                                        ? "bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/25 hover:text-destructive" 
                                        : "bg-card hover:bg-accent/40 text-muted-foreground hover:text-foreground"
                                }`}
                                onClick={() => {
                                    setViewingDeletedTasks(!viewingDeletedTasks);
                                    setEditingTask(null);
                                }}
                            >
                                <Trash2 size={12} />
                                Trash Bin ({deletedTasks.length})
                            </Button>
                        )}
                        {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs font-bold gap-1.5 border-dashed bg-card hover:bg-accent/40"
                                onClick={() => setIsGlobalHistoryOpen(true)}
                            >
                                <History size={12} />
                                History Logs
                            </Button>
                        )}
                    </div>
                </div>

                <div className={`grid grid-cols-1 gap-6 lg:gap-8 items-start ${
                    (currentUser?.role === 'admin' || currentUser?.role === 'manager')
                        ? 'lg:grid-cols-[340px_1fr]'
                        : ''
                }`}>
                    {/* ── Sidebar: Form ── */}
                    {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                    <div className="lg:sticky lg:top-6">
                        <div className="bg-card border rounded-2xl shadow-sm">
                            <div className={`px-4 sm:px-5 py-4 border-b ${editingTask ? "bg-primary/5" : ""}`}>
                                <h2 className="text-sm font-bold flex items-center gap-2">
                                    {editingTask ? (
                                        <>
                                            <Edit2 size={15} className="text-primary" />
                                            Edit Task
                                        </>
                                    ) : (
                                        <>
                                            <Plus size={15} className="text-primary" />
                                            New Task
                                        </>
                                    )}
                                </h2>
                                {editingTask && (
                                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                                        Editing: {editingTask.title}
                                    </p>
                                )}
                            </div>
                            <div className="p-4 sm:p-5">
                                <TaskForm
                                    teamMembers={teamMembers}
                                    currentUser={currentUser}
                                    editingTask={editingTask}
                                    onSuccess={handleSuccess}
                                    onCancelEdit={() => setEditingTask(null)}
                                />
                            </div>
                        </div>
                    </div>
                    )}

                    {/* ── Main: Task Lists ── */}
                    <div className="space-y-8">
                        {/* Search Bar */}
                        <div className="relative w-full">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                                <Search size={14} />
                            </span>
                            <input
                                id="tasks-search"
                                name="tasks-search"
                                type="text"
                                placeholder="Search tasks by title or assigned team member..."
                                className="input-field pl-9 pr-10 py-2 text-sm dark:bg-card w-full shadow-sm rounded-xl"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {viewingDeletedTasks ? (
                            <section className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Trash2 size={16} className="text-destructive" />
                                    <h2 className="text-sm font-bold text-destructive">Trash Bin (Soft-Deleted Tasks)</h2>
                                    <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full border border-destructive/20 font-semibold">
                                        {filteredDeletedTasks.length}
                                    </span>
                                </div>

                                {filteredDeletedTasks.length === 0 ? (
                                    <div className="p-10 text-center border-2 border-dashed rounded-xl bg-muted/20 text-muted-foreground text-sm">
                                        <Trash2 size={28} className="mx-auto mb-2 text-muted-foreground/30" />
                                        {searchQuery ? "No matching deleted tasks found." : "No deleted tasks in the Trash Bin."}
                                    </div>
                                ) : (
                                    <div className="space-y-2.5">
                                        {filteredDeletedTasks.map((task) => (
                                            <TaskCard
                                                key={task._id}
                                                task={task}
                                                onEdit={() => {}}
                                                onDelete={handleDelete}
                                                onRestore={handleRestore}
                                                onViewDetails={setSelectedTaskForHistory}
                                                currentUser={currentUser}
                                            />
                                        ))}
                                    </div>
                                )}
                            </section>
                        ) : (
                            <>
                                {/* Pending */}
                                <section id="pending-tasks-section" className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Clock size={16} className="text-orange-400" />
                                        <h2 className="text-sm font-bold">Pending Tasks</h2>
                                        <span className="text-xs bg-orange-400/10 text-orange-400 px-2 py-0.5 rounded-full border border-orange-400/20 font-semibold">
                                            {pendingTasks.length}
                                        </span>
                                    </div>

                                    {pendingTasks.length === 0 ? (
                                        <div className="p-10 text-center border-2 border-dashed rounded-xl bg-muted/20 text-muted-foreground text-sm">
                                            <CheckCircle2 size={28} className="mx-auto mb-2 text-green-500/40" />
                                            {searchQuery ? "No matching pending tasks found." : "No pending tasks. Great job!"}
                                        </div>
                                    ) : (
                                        <div className="space-y-2.5">
                                            {pendingTasks.map((task) => (
                                                <TaskCard
                                                    key={task._id}
                                                    task={task}
                                                    onEdit={(t) => {
                                                        setEditingTask(t);
                                                        window.scrollTo({ top: 0, behavior: "smooth" });
                                                    }}
                                                    onDelete={handleDelete}
                                                    onComplete={handleCompleteClick}
                                                    onViewDetails={setSelectedTaskForHistory}
                                                    currentUser={currentUser}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </section>

                                {/* Completed */}
                                {completedTasks.length > 0 && (
                                    <section id="completed-tasks-section" className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 size={16} className="text-green-500" />
                                            <h2 className="text-sm font-bold text-muted-foreground">Completed</h2>
                                            <span className="text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full border border-green-500/20 font-semibold">
                                                {completedTasks.length}
                                            </span>
                                        </div>
                                        <div className="space-y-2.5">
                                            {completedTasks.map((task) => (
                                                <TaskCard
                                                    key={task._id}
                                                    task={task}
                                                    onEdit={(t) => {
                                                        setEditingTask(t);
                                                        window.scrollTo({ top: 0, behavior: "smooth" });
                                                    }}
                                                    onDelete={handleDelete}
                                                    onViewDetails={setSelectedTaskForHistory}
                                                    currentUser={currentUser}
                                                />
                                            ))}
                                        </div>
                                    </section>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Task Completion Confirmation for Sales Rep ── */}
            <AlertDialog open={!!completingTaskId} onOpenChange={(open) => !open && setCompletingTaskId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-green-500">
                            <CheckCircle2 size={16} />
                            Complete Task?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to mark this task as completed? You cannot undo this action.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>No</AlertDialogCancel>
                        <AlertDialogAction
                            id="btn-confirm-complete"
                            onClick={() => {
                                if (completingTaskId) {
                                    handleComplete(completingTaskId);
                                    setCompletingTaskId(null);
                                }
                            }}
                            className="bg-green-600 hover:bg-green-700 text-white"
                        >
                            Yes
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Task Deletion Confirmation ── */}
            <AlertDialog open={!!deletingTaskId} onOpenChange={(open) => !open && setDeletingTaskId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <Trash2 size={16} />
                            {deletedTasks.some((t) => t._id === deletingTaskId) ? "Permanently Delete Task?" : "Delete Task?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {deletedTasks.some((t) => t._id === deletingTaskId) 
                                ? "Are you sure you want to permanently delete this task? This will also delete all of its activity history logs and cannot be undone."
                                : "Are you sure you want to delete this task? "}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            id="btn-confirm-delete"
                            onClick={() => {
                                if (deletingTaskId) {
                                    executeDelete(deletingTaskId);
                                    setDeletingTaskId(null);
                                }
                            }}
                            className="bg-destructive hover:bg-destructive/90 text-white"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Global Task History Sheet ── */}
            <Sheet open={isGlobalHistoryOpen} onOpenChange={setIsGlobalHistoryOpen}>
                <SheetContent side="right" className="w-[450px] sm:max-w-[500px] bg-card border-l overflow-y-auto">
                    <SheetHeader className="pb-4 border-b">
                        <SheetTitle className="flex items-center gap-2 text-base font-bold">
                            <History className="text-primary" size={18} />
                            Task Activity History
                        </SheetTitle>
                        <SheetDescription className="text-xs">
                            Recent task activity and updates across the organization.
                        </SheetDescription>
                    </SheetHeader>
                    <div className="py-6 space-y-4">
                        {loadingGlobalHistory ? (
                            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                                <Loader2 size={16} className="animate-spin text-primary" />
                                Loading activity logs...
                            </div>
                        ) : globalHistory.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground text-sm">
                                No activity logs recorded yet.
                            </div>
                        ) : (
                            <div className="space-y-4 divide-y divide-border/40">
                                {globalHistory.map((item) => (
                                    <div key={item._id} className="pt-3 first:pt-0">
                                        <div className="mb-2">
                                            <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full inline-block truncate max-w-[280px]" title={item.task_title}>
                                                📋 {item.task_title}
                                            </span>
                                        </div>
                                        <div className="text-xs">
                                            {getActionLabel(item)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            {/* ── Specific Task Details & History Sheet ── */}
            <Sheet open={!!selectedTaskForHistory} onOpenChange={(open) => !open && setSelectedTaskForHistory(null)}>
                <SheetContent side="right" className="w-[450px] sm:max-w-[500px] bg-card border-l overflow-y-auto">
                    <SheetHeader className="pb-4 border-b">
                        <SheetTitle className="flex items-center gap-2 truncate text-base font-bold text-foreground">
                            📋 {selectedTaskForHistory?.title}
                        </SheetTitle>
                        <SheetDescription className="text-xs">
                            Task details and activity history.
                        </SheetDescription>
                    </SheetHeader>
                    {selectedTaskForHistory && (
                        <div className="py-6 space-y-6">
                            {/* Task Details Section */}
                            <div className="space-y-3 bg-muted/20 p-4 rounded-xl border border-border/50">
                                {selectedTaskForHistory.isDeleted && selectedTaskForHistory.deletedBy && (
                                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive space-y-1">
                                        <p className="font-bold flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                                            <AlertCircle size={12} />
                                            Task Soft-Deleted
                                        </p>
                                        <p className="font-medium text-[11px]">
                                            Deleted by <span className="font-bold">{selectedTaskForHistory.deletedBy.name}</span> ({selectedTaskForHistory.deletedBy.email})
                                        </p>
                                        {selectedTaskForHistory.deletedAt && (
                                            <p className="text-[10px] text-destructive/70">
                                                On {formatDateTime(selectedTaskForHistory.deletedAt)}
                                            </p>
                                        )}
                                    </div>
                                )}
                                <div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Description</p>
                                    <p className="text-xs mt-1 text-foreground leading-relaxed whitespace-pre-wrap">
                                        {selectedTaskForHistory.description || <span className="italic text-muted-foreground">No description provided</span>}
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/40">
                                    <div>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Priority</p>
                                        <div className="mt-1">
                                            <PriorityBadge priority={selectedTaskForHistory.priority} />
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status</p>
                                        <div className="mt-1">
                                            <StatusBadge status={selectedTaskForHistory.status} />
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/40">
                                    <div>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Due Date</p>
                                        <p className="text-xs font-semibold text-foreground mt-0.5">
                                            {selectedTaskForHistory.dueDate ? formatDate(selectedTaskForHistory.dueDate) : "No due date"}
                                        </p>
                                    </div>
                                    {selectedTaskForHistory.assignedTo && (
                                        <div>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Assigned To</p>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <UserAvatar user={selectedTaskForHistory.assignedTo} size="xs" />
                                                <span className="text-xs font-semibold truncate">{selectedTaskForHistory.assignedTo.name}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Task Timeline / History Logs Section */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                    <History size={12} />
                                    Activity Timeline
                                </h3>
                                {loadingTaskHistory ? (
                                    <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                                        <Loader2 size={16} className="animate-spin text-primary" />
                                        Loading history...
                                    </div>
                                ) : taskHistory.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-xl">
                                        No updates recorded for this task.
                                    </div>
                                ) : (
                                    <div className="relative border-l border-border/80 pl-4 ml-2 space-y-5">
                                        {taskHistory.map((item) => (
                                            <div key={item._id} className="relative">
                                                {/* Visual indicator dot */}
                                                <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-card border-2 border-primary ring-4 ring-card" />
                                                <div className="text-xs">
                                                    {getActionLabel(item)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </AppLayout>
    );
}
