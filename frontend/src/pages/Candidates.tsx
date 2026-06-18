import { useEffect, useState, useCallback } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import {
    Users,
    Mail,
    Calendar,
    Plus,
    Pencil,
    Trash2,
    Search,
    UserPlus,
    UserCheck,
    Clock,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
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

interface Candidate {
    _id: string;
    name: string;
    email?: string;
    phone?: string;
    applying_for?: string;
    status: string;
    notes?: string;
    createdAt: string;
}

const CANDIDATE_STATUS_CONFIG = {
    applied:       { label: "Applied",       color: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20" },
    interviewing:  { label: "Interviewing",  color: "bg-blue-500/15 text-blue-500 border-blue-500/20" },
    offered:       { label: "Offered",       color: "bg-violet-500/15 text-violet-500 border-violet-500/20" },
    hired:         { label: "Hired",         color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20" },
    rejected:      { label: "Rejected",      color: "bg-red-500/15 text-red-500 border-red-500/20" },
};

const defaultCandidateForm = {
    name: "",
    email: "",
    phone: "",
    applying_for: "",
    status: "applied",
    notes: ""
};

export default function Candidates() {
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
    const [form, setForm] = useState(defaultCandidateForm);
    const [submitting, setSubmitting] = useState(false);

    // Delete state
    const [deleteTarget, setDeleteTarget] = useState<Candidate | null>(null);
    const [deleting, setDeleting] = useState(false);

    const isAuthorized = currentUser?.role === 'admin' || currentUser?.role === 'manager';

    const loadCandidates = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get("/meetings/candidates");
            setCandidates(res.data);
        } catch {
            toast.error("Failed to load candidates");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isAuthorized) {
            loadCandidates();
        }
    }, [isAuthorized, loadCandidates]);

    const openCreate = () => {
        setEditingCandidate(null);
        setForm(defaultCandidateForm);
        setModalOpen(true);
    };

    const openEdit = (c: Candidate) => {
        setEditingCandidate(c);
        setForm({
            name: c.name,
            email: c.email ?? "",
            phone: c.phone ?? "",
            applying_for: c.applying_for ?? "",
            status: c.status ?? "applied",
            notes: c.notes ?? ""
        });
        setModalOpen(true);
    };

    const handleSubmit = async () => {
        if (!form.name.trim()) {
            toast.error("Name is required");
            return;
        }
        setSubmitting(true);
        try {
            if (editingCandidate) {
                const res = await api.put(`/meetings/candidates/${editingCandidate._id}`, form);
                setCandidates((prev) =>
                    prev.map((c) => (c._id === editingCandidate._id ? res.data : c))
                );
                toast.success("Candidate updated successfully");
            } else {
                const res = await api.post("/meetings/candidates", form);
                setCandidates((prev) => [res.data, ...prev]);
                toast.success("Candidate created successfully");
            }
            setModalOpen(false);
        } catch {
            // handled
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await api.delete(`/meetings/candidates/${deleteTarget._id}`);
            setCandidates((prev) => prev.filter((c) => c._id !== deleteTarget._id));
            toast.success("Candidate deleted successfully");
            setDeleteTarget(null);
        } catch {
            // handled
        } finally {
            setDeleting(false);
        }
    };

    const filtered = candidates.filter((c) => {
        const q = search.toLowerCase();
        return (
            c.name.toLowerCase().includes(q) ||
            (c.email ?? "").toLowerCase().includes(q) ||
            (c.applying_for ?? "").toLowerCase().includes(q) ||
            (c.status ?? "").toLowerCase().includes(q)
        );
    });

    // Stats
    const totalCandidates = candidates.length;
    const interviewingCount = candidates.filter((c) => c.status === "interviewing").length;
    const hiredCount = candidates.filter((c) => c.status === "hired").length;

    if (!isAuthorized) {
        return (
            <AppLayout>
                <div className="flex items-center justify-center h-[60vh]">
                    <p className="text-muted-foreground text-sm">
                        You do not have permission to view candidate management.
                    </p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="space-y-6 max-w-6xl mx-auto pb-12">
                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Candidate Management</h1>
                        <p className="text-muted-foreground mt-1">
                            Create and manage internal candidates and job applicants for role hiring.
                        </p>
                    </div>
                    <div className="shrink-0">
                        <Button
                            id="btn-add-candidate"
                            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white shadow-sm transition-all"
                            onClick={openCreate}
                        >
                            <Plus size={16} />
                            Add Candidate
                        </Button>
                    </div>
                </div>

                {/* ── Stats Strip ── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-card border rounded-xl p-4 flex items-center gap-3 shadow-sm">
                        <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                            <UserPlus size={18} className="text-violet-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{totalCandidates}</p>
                            <p className="text-xs text-muted-foreground">Total Applicants</p>
                        </div>
                    </div>
                    <div className="bg-card border rounded-xl p-4 flex items-center gap-3 shadow-sm">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <Clock size={18} className="text-blue-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{interviewingCount}</p>
                            <p className="text-xs text-muted-foreground">Interviewing</p>
                        </div>
                    </div>
                    <div className="bg-card border rounded-xl p-4 flex items-center gap-3 shadow-sm">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <UserCheck size={18} className="text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{hiredCount}</p>
                            <p className="text-xs text-muted-foreground">Hired</p>
                        </div>
                    </div>
                </div>

                {/* ── Search Bar ── */}
                <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        id="candidate-search"
                        placeholder="Search by name, email, position or status…"
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
                                <TableHead className="w-[260px]">Candidate</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Role / Position</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Created</TableHead>
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
                                                {search ? "No results match your search." : "No candidates yet. Add one to get started."}
                                            </span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filtered.map((cand) => (
                                    <TableRow key={cand._id}>
                                        {/* Avatar + Name */}
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center font-bold text-sm shrink-0">
                                                    {cand.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-sm truncate">{cand.name}</p>
                                                    {cand.phone && (
                                                        <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                                                            <svg 
                                                                className="w-3.5 h-3.5 text-emerald-500 shrink-0" 
                                                                viewBox="0 0 16 16" 
                                                                fill="currentColor"
                                                            >
                                                                <mask id="candidate-phone-cutout">
                                                                    <rect width="16" height="16" fill="white" />
                                                                    <line x1="0" y1="3" x2="4.5" y2="-0.5" stroke="black" strokeWidth="1" />
                                                                    <line x1="11.5" y1="16.5" x2="16" y2="13" stroke="black" strokeWidth="1" />
                                                                </mask>
                                                                <path 
                                                                    d="M1.885.511a1.745 1.745 0 0 1 2.61.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.68.68 0 0 0 .178.643l2.457 2.457a.68.68 0 0 0 .644.178l2.189-.547a1.75 1.75 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.6 18.6 0 0 1-7.01-4.42 18.6 18.6 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877z"
                                                                    mask="url(#candidate-phone-cutout)"
                                                                />
                                                            </svg>
                                                            <span>{cand.phone}</span>
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
                                                    {cand.email || "—"}
                                                </span>
                                            </div>
                                        </TableCell>

                                        {/* Role / Position */}
                                        <TableCell>
                                            <span className="text-sm font-medium text-foreground">
                                                {cand.applying_for || "—"}
                                            </span>
                                        </TableCell>

                                        {/* Status Badge */}
                                        <TableCell>
                                            {(() => {
                                                const cfg = CANDIDATE_STATUS_CONFIG[cand.status as keyof typeof CANDIDATE_STATUS_CONFIG] || CANDIDATE_STATUS_CONFIG.applied;
                                                return (
                                                    <span className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${cfg.color}`}>
                                                        {cfg.label}
                                                    </span>
                                                );
                                            })()}
                                        </TableCell>

                                        {/* Created date */}
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                                <Calendar size={13} />
                                                {new Date(cand.createdAt).toLocaleDateString()}
                                            </div>
                                        </TableCell>

                                        {/* Actions */}
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    id={`edit-candidate-${cand._id}`}
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                    onClick={() => openEdit(cand)}
                                                    aria-label="Edit candidate"
                                                >
                                                    <Pencil size={14} />
                                                </Button>
                                                <Button
                                                    id={`delete-candidate-${cand._id}`}
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => setDeleteTarget(cand)}
                                                    aria-label="Delete candidate"
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
                                    {search ? "No results match your search." : "No candidates yet. Add one to get started."}
                                </span>
                            </div>
                        </div>
                    ) : (
                        filtered.map((cand) => (
                            <div key={cand._id} className="bg-card border rounded-xl p-5 space-y-4 shadow-sm relative transition-all duration-200">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center font-bold text-sm shrink-0 select-none">
                                            {cand.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-sm text-foreground truncate">{cand.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">{cand.email || "No email"}</p>
                                        </div>
                                    </div>
                                    {(() => {
                                        const cfg = CANDIDATE_STATUS_CONFIG[cand.status as keyof typeof CANDIDATE_STATUS_CONFIG] || CANDIDATE_STATUS_CONFIG.applied;
                                        return (
                                            <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${cfg.color}`}>
                                                {cfg.label}
                                            </span>
                                        );
                                    })()}
                                </div>
                                <div className="grid grid-cols-2 gap-4 py-2 border-y border-border/50 text-xs">
                                    <div>
                                        <p className="text-muted-foreground mb-1">Role / Position</p>
                                        <span className="font-semibold text-foreground">
                                            {cand.applying_for || "—"}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground mb-1">Created</p>
                                        <div className="flex items-center gap-1.5 text-muted-foreground font-medium mt-1">
                                            <Calendar size={13} />
                                            {new Date(cand.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-end gap-2 pt-1">
                                    <Button
                                        id={`edit-candidate-mobile-${cand._id}`}
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                                        onClick={() => openEdit(cand)}
                                    >
                                        <Pencil size={12} />
                                        Edit
                                    </Button>
                                    <Button
                                        id={`delete-candidate-mobile-${cand._id}`}
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-1.5 text-xs text-destructive hover:bg-destructive/10 border-destructive/20 hover:border-destructive/30"
                                        onClick={() => setDeleteTarget(cand)}
                                    >
                                        <Trash2 size={12} />
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* ── Add / Edit Candidate Modal ── */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {editingCandidate ? (
                                <>
                                    <Pencil size={16} className="text-violet-500" />
                                    Edit Candidate
                                </>
                            ) : (
                                <>
                                    <Plus size={16} className="text-violet-500" />
                                    Add Candidate
                                </>
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {editingCandidate ? "Update the candidate's details." : "Add a new candidate."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Name */}
                        <div className="space-y-1.5">
                            <Label htmlFor="cand-name">Full Name <span className="text-destructive">*</span></Label>
                            <Input
                                id="cand-name"
                                placeholder="John Smith"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                            />
                        </div>

                        {/* Email */}
                        <div className="space-y-1.5">
                            <Label htmlFor="cand-email">Email Address</Label>
                            <div className="relative">
                                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    id="cand-email"
                                    type="email"
                                    placeholder="john@example.com"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    className="pl-9"
                                />
                            </div>
                        </div>

                        {/* Phone */}
                        <div className="space-y-1.5">
                            <Label htmlFor="cand-phone">Phone Number</Label>
                            <Input
                                id="cand-phone"
                                placeholder="+1 (555) 019-2834"
                                value={form.phone}
                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                            />
                        </div>

                        {/* Role / Position */}
                        <div className="space-y-1.5">
                            <Label htmlFor="cand-role">Role (Position they are applying for)</Label>
                            <Input
                                id="cand-role"
                                placeholder="e.g. Coach, Volunteer, Manager"
                                value={form.applying_for}
                                onChange={(e) => setForm({ ...form, applying_for: e.target.value })}
                            />
                        </div>

                        {/* Status */}
                        <div className="space-y-1.5">
                            <Label htmlFor="cand-status">Status</Label>
                            <Select
                                value={form.status}
                                onValueChange={(val) => setForm({ ...form, status: val })}
                            >
                                <SelectTrigger id="cand-status">
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(CANDIDATE_STATUS_CONFIG).map(([k, v]) => (
                                        <SelectItem key={k} value={k}>
                                            {v.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Notes */}
                        <div className="space-y-1.5">
                            <Label htmlFor="cand-notes">Notes</Label>
                            <Input
                                id="cand-notes"
                                placeholder="Interview performance, references, etc."
                                value={form.notes}
                                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            />
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
                            id="btn-submit-candidate"
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
                        >
                            {submitting ? (
                                "Saving…"
                            ) : editingCandidate ? (
                                <>
                                    <Pencil size={14} /> Save Changes
                                </>
                            ) : (
                                <>
                                    <Plus size={14} /> Add Candidate
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Candidate Delete Confirmation ── */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Trash2 size={16} className="text-destructive" />
                            Remove Candidate?
                        </AlertDialogTitle>
                        <DialogDescription>
                            This will permanently delete candidate{" "}
                            <strong>{deleteTarget?.name}</strong> from the database.
                            This action cannot be undone.
                        </DialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            id="btn-confirm-delete-candidate"
                            onClick={handleDelete}
                            disabled={deleting}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                            {deleting ? "Removing…" : "Yes, Remove"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}
