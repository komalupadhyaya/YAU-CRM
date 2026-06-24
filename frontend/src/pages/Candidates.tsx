import { useEffect, useState, useCallback, Fragment } from "react";
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
    UserX,
    Award,
    MessageSquare,
    CheckCircle,
    AlertTriangle,
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
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { toESTDate, formatAsEST } from "../utils/timezoneHelper";

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

interface CandidateNote {
    text: string;
    author: string;
    date: string;
}

interface CandidateFollowUp {
    _id: string;
    title?: string;
    date_time: string;
    type: string;
    priority?: string;
    notes: string;
    status: string;
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

    // Note Delete state
    const [noteDeleteTarget, setNoteDeleteTarget] = useState<{ candidate: Candidate; index: number } | null>(null);
    const [deletingNote, setDeletingNote] = useState(false);

    // Notes & Follow-ups state
    const [expandedCandidateId, setExpandedCandidateId] = useState<string | null>(null);
    const [candidateFollowups, setCandidateFollowups] = useState<Record<string, CandidateFollowUp[]>>({});
    const [loadingFollowups, setLoadingFollowups] = useState<Record<string, boolean>>({});
    const [activeTabMap, setActiveTabMap] = useState<Record<string, "notes" | "followups">>({});
    const [newNoteText, setNewNoteText] = useState("");
    const [savingNote, setSavingNote] = useState(false);

    const [followUpDate, setFollowUpDate] = useState("");
    const [followUpType, setFollowUpType] = useState("Call");
    const [followUpPriority, setFollowUpPriority] = useState("");
    const [followUpNotes, setFollowUpNotes] = useState("");
    const [schedulingFollowup, setSchedulingFollowup] = useState(false);

    // Conflict dialog state
    const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
    const [conflictCandidateId, setConflictCandidateId] = useState<string | null>(null);

    // Edit follow-up state
    const [editingFollowup, setEditingFollowup] = useState<CandidateFollowUp | null>(null);
    const [editFollowupCandId, setEditFollowupCandId] = useState<string | null>(null);
    const [editFollowUpDate, setEditFollowUpDate] = useState("");
    const [editFollowUpType, setEditFollowUpType] = useState("Call");
    const [editFollowUpPriority, setEditFollowUpPriority] = useState("");
    const [editFollowUpNotes, setEditFollowUpNotes] = useState("");
    const [savingEditFollowup, setSavingEditFollowup] = useState(false);

    // Delete follow-up confirmation state
    const [followupDeleteTarget, setFollowupDeleteTarget] = useState<{ candId: string; fuId: string } | null>(null);
    const [deletingFollowup, setDeletingFollowup] = useState(false);

    // Conflict message from backend
    const [conflictMessage, setConflictMessage] = useState("");

    const isAuthorized = currentUser?.role === 'admin' || currentUser?.role === 'manager';

    const getActiveTab = (candId: string): "notes" | "followups" => {
        return activeTabMap[candId] || "notes";
    };

    const setActiveTab = (candId: string, tab: "notes" | "followups") => {
        setActiveTabMap(prev => ({ ...prev, [candId]: tab }));
    };

    const parseCandidateNotes = (notesStr?: string): CandidateNote[] => {
        if (!notesStr) return [];
        try {
            const parsed = JSON.parse(notesStr);
            if (Array.isArray(parsed)) {
                return parsed;
            }
        } catch (e) {
            if (notesStr.trim()) {
                return [{
                    text: notesStr,
                    author: "System / Legacy Note",
                    date: new Date().toISOString()
                }];
            }
        }
        return [];
    };

    const loadFollowupsForCandidate = async (candId: string) => {
        setLoadingFollowups(prev => ({ ...prev, [candId]: true }));
        try {
            const res = await api.get(`/followups/candidate/${candId}`);
            setCandidateFollowups(prev => ({ ...prev, [candId]: res.data }));
        } catch (e) {
            toast.error("Failed to load follow-ups for candidate");
        } finally {
            setLoadingFollowups(prev => ({ ...prev, [candId]: false }));
        }
    };

    const toggleExpand = (candId: string) => {
        if (expandedCandidateId === candId) {
            setExpandedCandidateId(null);
        } else {
            setExpandedCandidateId(candId);
            loadFollowupsForCandidate(candId);
        }
    };

    const handleAddNote = async (cand: Candidate) => {
        if (!newNoteText.trim()) return;
        setSavingNote(true);
        try {
            const currentNotes = parseCandidateNotes(cand.notes);
            const newNote: CandidateNote = {
                text: newNoteText.trim(),
                author: currentUser?.name || currentUser?.username || "Unknown User",
                date: new Date().toISOString()
            };
            const updatedNotes = [...currentNotes, newNote];
            const notesJson = JSON.stringify(updatedNotes);
            
            const res = await api.put(`/meetings/candidates/${cand._id}`, {
                name: cand.name,
                email: cand.email,
                phone: cand.phone,
                applying_for: cand.applying_for,
                status: cand.status,
                notes: notesJson
            });
            
            setCandidates(prev => prev.map(c => c._id === cand._id ? res.data : c));
            setNewNoteText("");
            toast.success("Note added successfully");
        } catch (e) {
            toast.error("Failed to add note");
        } finally {
            setSavingNote(false);
        }
    };

    const handleDeleteNote = (cand: Candidate, noteIndex: number) => {
        setNoteDeleteTarget({ candidate: cand, index: noteIndex });
    };

    const confirmDeleteNote = async () => {
        if (!noteDeleteTarget) return;
        const { candidate, index } = noteDeleteTarget;
        setDeletingNote(true);
        try {
            const currentNotes = parseCandidateNotes(candidate.notes);
            const updatedNotes = currentNotes.filter((_, i) => i !== index);
            const notesJson = JSON.stringify(updatedNotes);
            
            const res = await api.put(`/meetings/candidates/${candidate._id}`, {
                name: candidate.name,
                email: candidate.email,
                phone: candidate.phone,
                applying_for: candidate.applying_for,
                status: candidate.status,
                notes: notesJson
            });
            
            setCandidates(prev => prev.map(c => c._id === candidate._id ? res.data : c));
            toast.success("Note deleted successfully");
            setNoteDeleteTarget(null);
        } catch (e) {
            toast.error("Failed to delete note");
        } finally {
            setDeletingNote(false);
        }
    };

    const handleScheduleFollowup = async (candId: string, force = false) => {
        if (!followUpDate) {
            toast.error("Please select a follow-up date");
            return;
        }
        if (!followUpNotes.trim()) {
            toast.error("Please provide notes or details");
            return;
        }
        setSchedulingFollowup(true);
        try {
            const res = await api.post(`/followups/candidate/${candId}`, {
                date_time: followUpDate,
                type: followUpType,
                priority: followUpPriority || null,
                notes: followUpNotes,
                force
            });
            
            setCandidateFollowups(prev => ({
                ...prev,
                [candId]: [...(prev[candId] || []), res.data].sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime())
            }));

            setFollowUpDate("");
            setFollowUpType("Call");
            setFollowUpPriority("");
            setFollowUpNotes("");

            toast.success("Follow-up scheduled successfully");
        } catch (err: any) {
            if (err.response?.status === 409) {
                // Open proper conflict dialog instead of window.confirm
                setConflictCandidateId(candId);
                setConflictMessage(err.response.data?.message || "A follow-up is already scheduled at this time.");
                setConflictDialogOpen(true);
            } else {
                toast.error(err.response?.data?.message || "Failed to schedule follow-up");
            }
        } finally {
            setSchedulingFollowup(false);
        }
    };

    const handleForceScheduleFollowup = async () => {
        if (!conflictCandidateId) return;
        setConflictDialogOpen(false);
        const candId = conflictCandidateId;
        setConflictCandidateId(null);
        setSchedulingFollowup(true);
        try {
            const res = await api.post(`/followups/candidate/${candId}`, {
                date_time: followUpDate,
                type: followUpType,
                priority: followUpPriority || null,
                notes: followUpNotes,
                force: true
            });
            setCandidateFollowups(prev => ({
                ...prev,
                [candId]: [...(prev[candId] || []), res.data].sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime())
            }));
            setFollowUpDate("");
            setFollowUpType("Call");
            setFollowUpPriority("");
            setFollowUpNotes("");
            toast.success("Follow-up scheduled successfully");
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to schedule follow-up");
        } finally {
            setSchedulingFollowup(false);
        }
    };

    const openEditFollowup = (candId: string, fu: CandidateFollowUp) => {
        setEditingFollowup(fu);
        setEditFollowupCandId(candId);
        setEditFollowUpDate(fu.date_time);
        setEditFollowUpType(fu.type);
        setEditFollowUpPriority(fu.priority || "");
        setEditFollowUpNotes(fu.notes);
    };

    const handleSaveEditFollowup = async () => {
        if (!editingFollowup || !editFollowupCandId) return;
        if (!editFollowUpDate) {
            toast.error("Please select a date");
            return;
        }
        setSavingEditFollowup(true);
        try {
            const res = await api.put(`/followups/${editingFollowup._id}`, {
                date_time: editFollowUpDate,
                type: editFollowUpType,
                priority: editFollowUpPriority || null,
                notes: editFollowUpNotes,
            });
            setCandidateFollowups(prev => ({
                ...prev,
                [editFollowupCandId]: (prev[editFollowupCandId] || []).map(f =>
                    f._id === editingFollowup._id ? res.data : f
                ).sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime())
            }));
            toast.success("Follow-up updated successfully");
            setEditingFollowup(null);
            setEditFollowupCandId(null);
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to update follow-up");
        } finally {
            setSavingEditFollowup(false);
        }
    };

    const handleCompleteFollowup = async (candId: string, fuId: string) => {
        try {
            await api.put(`/followups/${fuId}/complete`);
            toast.success("Follow-up marked as completed");
            setCandidateFollowups(prev => ({
                ...prev,
                [candId]: (prev[candId] || []).map(f => f._id === fuId ? { ...f, status: 'done' } : f)
            }));
        } catch (e) {
            toast.error("Failed to complete follow-up");
        }
    };

    const handleDeleteFollowup = (candId: string, fuId: string) => {
        setFollowupDeleteTarget({ candId, fuId });
    };

    const confirmDeleteFollowup = async () => {
        if (!followupDeleteTarget) return;
        const { candId, fuId } = followupDeleteTarget;
        setDeletingFollowup(true);
        try {
            await api.delete(`/followups/${fuId}`);
            toast.success("Follow-up deleted");
            setCandidateFollowups(prev => ({
                ...prev,
                [candId]: (prev[candId] || []).filter(f => f._id !== fuId)
            }));
            setFollowupDeleteTarget(null);
        } catch (e) {
            toast.error("Failed to delete follow-up");
        } finally {
            setDeletingFollowup(false);
        }
    };

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
        const parsedNotes = parseCandidateNotes(c.notes);
        setForm({
            name: c.name,
            email: c.email ?? "",
            phone: c.phone ?? "",
            applying_for: c.applying_for ?? "",
            status: c.status ?? "applied",
            notes: parsedNotes[0]?.text || ""
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
                const originalNotes = parseCandidateNotes(editingCandidate.notes);
                const newInitialText = form.notes.trim();
                
                let notesJson = editingCandidate.notes;
                if (originalNotes.length > 0) {
                    // Update only the first note's text, keeping all other notes intact
                    const updatedNotes = originalNotes.map((note, idx) => 
                        idx === 0 ? { ...note, text: newInitialText } : note
                    );
                    notesJson = JSON.stringify(updatedNotes);
                } else if (newInitialText) {
                    // If no notes existed, create the first note
                    notesJson = JSON.stringify([{
                        text: newInitialText,
                        author: currentUser?.name || currentUser?.username || "System",
                        date: new Date().toISOString()
                    }]);
                } else {
                    notesJson = "";
                }

                const payload = {
                    ...form,
                    notes: notesJson
                };
                const res = await api.put(`/meetings/candidates/${editingCandidate._id}`, payload);
                setCandidates((prev) =>
                    prev.map((c) => (c._id === editingCandidate._id ? res.data : c))
                );
                toast.success("Candidate updated successfully");
            } else {
                const payload = {
                    ...form,
                    notes: form.notes.trim()
                        ? JSON.stringify([{
                            text: form.notes.trim(),
                            author: currentUser?.name || currentUser?.username || "System",
                            date: new Date().toISOString()
                        }])
                        : ""
                };
                const res = await api.post("/meetings/candidates", payload);
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
    const appliedCount = candidates.filter((c) => c.status === "applied").length;
    const interviewingCount = candidates.filter((c) => c.status === "interviewing").length;
    const offeredCount = candidates.filter((c) => c.status === "offered").length;
    const hiredCount = candidates.filter((c) => c.status === "hired").length;
    const rejectedCount = candidates.filter((c) => c.status === "rejected").length;

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
                        <h1 className="text-3xl font-bold tracking-tight">HC Candidates</h1>
                        <p className="text-muted-foreground mt-1">
                            Create and manage internal HC candidates and job applicants for role hiring.
                        </p>
                    </div>
                    <div className="shrink-0">
                        <Button
                            id="btn-add-candidate"
                            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white shadow-sm transition-all"
                            onClick={openCreate}
                        >
                            <Plus size={16} />
                            Add HC Candidate
                        </Button>
                    </div>
                </div>

                {/* ── Stats Strip ── */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {/* Total Applicants */}
                    <div className="bg-card border rounded-xl p-4 flex items-center gap-3 shadow-sm">
                        <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                            <UserPlus size={18} className="text-violet-500" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-2xl font-bold">{totalCandidates}</p>
                            <p className="text-xs text-muted-foreground truncate">Total HC Candidates</p>
                        </div>
                    </div>
                    {/* Applied */}
                    <div className="bg-card border rounded-xl p-4 flex items-center gap-3 shadow-sm">
                        <div className="w-10 h-10 rounded-lg bg-zinc-500/10 flex items-center justify-center shrink-0">
                            <Users size={18} className="text-zinc-400" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-2xl font-bold">{appliedCount}</p>
                            <p className="text-xs text-muted-foreground truncate">Applied</p>
                        </div>
                    </div>
                    {/* Interviewing */}
                    <div className="bg-card border rounded-xl p-4 flex items-center gap-3 shadow-sm">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                            <Clock size={18} className="text-blue-500" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-2xl font-bold">{interviewingCount}</p>
                            <p className="text-xs text-muted-foreground truncate">Interviewing</p>
                        </div>
                    </div>
                    {/* Offered */}
                    <div className="bg-card border rounded-xl p-4 flex items-center gap-3 shadow-sm">
                        <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                            <Award size={18} className="text-amber-500" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-2xl font-bold">{offeredCount}</p>
                            <p className="text-xs text-muted-foreground truncate">Offered</p>
                        </div>
                    </div>
                    {/* Hired */}
                    <div className="bg-card border rounded-xl p-4 flex items-center gap-3 shadow-sm">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <UserCheck size={18} className="text-emerald-500" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-2xl font-bold">{hiredCount}</p>
                            <p className="text-xs text-muted-foreground truncate">Hired</p>
                        </div>
                    </div>
                    {/* Rejected */}
                    <div className="bg-card border rounded-xl p-4 flex items-center gap-3 shadow-sm">
                        <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                            <UserX size={18} className="text-red-500" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-2xl font-bold">{rejectedCount}</p>
                            <p className="text-xs text-muted-foreground truncate">Rejected</p>
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
                                    <Fragment key={cand._id}>
                                        <TableRow>
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
                                                {toESTDate(cand.createdAt).toLocaleDateString()}
                                            </div>
                                        </TableCell>

                                        {/* Actions */}
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    id={`notes-candidate-${cand._id}`}
                                                    variant="ghost"
                                                    size="icon"
                                                    className={`h-8 w-8 transition-colors ${
                                                        expandedCandidateId === cand._id 
                                                            ? 'text-violet-500 bg-violet-500/10' 
                                                            : 'text-muted-foreground hover:text-foreground'
                                                    }`}
                                                    onClick={() => toggleExpand(cand._id)}
                                                    aria-label="Notes and follow-ups"
                                                >
                                                    <MessageSquare size={14} />
                                                </Button>
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
                                    {expandedCandidateId === cand._id && (
                                        <TableRow className="bg-muted/30 border-t-0 hover:bg-muted/30 transition-all duration-300">
                                            <TableCell colSpan={6} className="p-6">
                                                <div className="bg-card border rounded-xl p-5 shadow-inner space-y-6">
                                                    {/* Custom Tab Switcher */}
                                                    <div className="flex gap-4 border-b border-border/50 pb-2">
                                                        <button
                                                            onClick={() => setActiveTab(cand._id, "notes")}
                                                            className={`text-sm font-semibold pb-2 border-b-2 transition-all relative ${
                                                                getActiveTab(cand._id) === "notes"
                                                                    ? "border-violet-500 text-violet-500 font-bold"
                                                                    : "border-transparent text-muted-foreground hover:text-foreground"
                                                            }`}
                                                        >
                                                            Notes Log ({parseCandidateNotes(cand.notes).length})
                                                        </button>
                                                        <button
                                                            onClick={() => setActiveTab(cand._id, "followups")}
                                                            className={`text-sm font-semibold pb-2 border-b-2 transition-all relative ${
                                                                getActiveTab(cand._id) === "followups"
                                                                    ? "border-violet-500 text-violet-500 font-bold"
                                                                    : "border-transparent text-muted-foreground hover:text-foreground"
                                                            }`}
                                                        >
                                                            Follow-ups ({candidateFollowups[cand._id]?.length || 0})
                                                        </button>
                                                    </div>

                                                    {/* Tab Contents */}
                                                    {getActiveTab(cand._id) === "notes" && (
                                                        <div className="space-y-4">
                                                            {/* Note List */}
                                                            <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                                                                {parseCandidateNotes(cand.notes).length === 0 ? (
                                                                    <p className="text-sm text-muted-foreground italic">No notes added yet for this candidate.</p>
                                                                ) : (
                                                                    parseCandidateNotes(cand.notes).map((note, index) => (
                                                                        <div key={index} className="bg-muted/40 border border-border/30 rounded-lg p-3 flex justify-between items-center gap-3 relative group">
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex justify-between items-center text-xs mb-1">
                                                                                    <span className="font-semibold text-violet-400">{note.author}</span>
                                                                                    <span className="text-[10px] text-muted-foreground">{formatAsEST(note.date)}</span>
                                                                                </div>
                                                                                <p className="text-sm text-foreground whitespace-pre-wrap">{note.text}</p>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => handleDeleteNote(cand, index)}
                                                                                className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-all shrink-0 self-center"
                                                                                title="Delete Note"
                                                                            >
                                                                                <Trash2 size={14} />
                                                                            </button>
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>

                                                            {/* Add Note Form */}
                                                            <div className="flex gap-2 items-end pt-2 border-t border-border/40">
                                                                <div className="flex-1">
                                                                    <textarea
                                                                        placeholder="Add a new note..."
                                                                        value={newNoteText}
                                                                        onChange={(e) => setNewNoteText(e.target.value)}
                                                                        className="w-full min-h-[60px] max-h-[120px] rounded-lg border border-border bg-background p-4 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 text-foreground placeholder:text-muted-foreground"
                                                                    />
                                                                </div>
                                                                <Button
                                                                    onClick={() => handleAddNote(cand)}
                                                                    disabled={savingNote || !newNoteText.trim()}
                                                                    className="bg-violet-600 hover:bg-violet-700 text-white shrink-0 h-10 px-4"
                                                                >
                                                                    {savingNote ? "Saving..." : "Add Note"}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {getActiveTab(cand._id) === "followups" && (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                            {/* Follow-up List */}
                                                            <div className="space-y-4">
                                                                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Scheduled Follow-ups</h4>
                                                                <div className="space-y-3 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
                                                                    {loadingFollowups[cand._id] ? (
                                                                        <p className="text-sm text-muted-foreground animate-pulse">Loading follow-ups...</p>
                                                                    ) : !candidateFollowups[cand._id] || candidateFollowups[cand._id].length === 0 ? (
                                                                        <p className="text-sm text-muted-foreground italic">No follow-ups scheduled.</p>
                                                                    ) : (
                                                                        candidateFollowups[cand._id].map((fu) => (
                                                                            <div key={fu._id} className={`border rounded-lg p-3 flex justify-between items-start ${
                                                                                fu.status === 'done'
                                                                                    ? "bg-emerald-500/5 border-emerald-500/20 opacity-80"
                                                                                    : "bg-muted/40 border-border/30"
                                                                            }`}>
                                                                                <div className="space-y-1 min-w-0">
                                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                                                                            fu.type === 'Call'
                                                                                                ? "bg-orange-500/10 text-orange-500"
                                                                                                : fu.type === 'Email'
                                                                                                    ? "bg-indigo-500/10 text-indigo-500"
                                                                                                    : "bg-blue-500/10 text-blue-500"
                                                                                        }`}>
                                                                                            {fu.type}
                                                                                        </span>
                                                                                        {fu.priority && (
                                                                                            <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                                                                                                fu.priority === 'High'
                                                                                                    ? "bg-red-500/10 text-red-500"
                                                                                                    : fu.priority === 'Medium'
                                                                                                        ? "bg-amber-500/10 text-amber-500"
                                                                                                        : "bg-zinc-500/10 text-zinc-400"
                                                                                            }`}>
                                                                                                {fu.priority} Priority
                                                                                            </span>
                                                                                        )}
                                                                                        <span className="text-[10px] text-muted-foreground">
                                                                                            {formatAsEST(fu.date_time)}
                                                                                        </span>
                                                                                    </div>
                                                                                    {fu.title && <p className="text-xs font-semibold text-foreground truncate">{fu.title}</p>}
                                                                                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{fu.notes}</p>
                                                                                </div>
                                                                                
                                                                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                                                                    {fu.status !== 'done' && (
                                                                                        <button
                                                                                            onClick={() => handleCompleteFollowup(cand._id, fu._id)}
                                                                                            className="p-1 hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-500 rounded transition-colors"
                                                                                            title="Mark Completed"
                                                                                        >
                                                                                            <CheckCircle size={14} />
                                                                                        </button>
                                                                                    )}
                                                                                    <button
                                                                                        onClick={() => openEditFollowup(cand._id, fu)}
                                                                                        className="p-1 hover:bg-violet-500/10 text-muted-foreground hover:text-violet-500 rounded transition-colors"
                                                                                        title="Edit Follow-up"
                                                                                    >
                                                                                        <Pencil size={14} />
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => handleDeleteFollowup(cand._id, fu._id)}
                                                                                        className="p-1 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded transition-colors"
                                                                                        title="Delete Follow-up"
                                                                                    >
                                                                                        <Trash2 size={14} />
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        ))
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Scheduler Form */}
                                                            <div className="space-y-4 border-t md:border-t-0 md:border-l border-border/40 pt-4 md:pt-0 md:pl-6">
                                                                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Schedule Follow-up</h4>
                                                                <div className="space-y-3">
                                                                    <div className="space-y-1">
                                                                        <Label className="text-xs text-muted-foreground">Date & Time</Label>
                                                                        <DateTimePicker value={followUpDate} onChange={setFollowUpDate} />
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-3">
                                                                        <div className="space-y-1">
                                                                            <Label className="text-xs text-muted-foreground">Type</Label>
                                                                            <Select
                                                                                value={followUpType}
                                                                                onValueChange={setFollowUpType}
                                                                            >
                                                                                <SelectTrigger className="h-9">
                                                                                    <SelectValue />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    <SelectItem value="Call">Call</SelectItem>
                                                                                    <SelectItem value="Email">Email</SelectItem>
                                                                                    <SelectItem value="Meeting">Meeting</SelectItem>
                                                                                </SelectContent>
                                                                            </Select>
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            <Label className="text-xs text-muted-foreground">Priority</Label>
                                                                            <Select
                                                                                value={followUpPriority}
                                                                                onValueChange={setFollowUpPriority}
                                                                            >
                                                                                <SelectTrigger className="h-9">
                                                                                    <SelectValue placeholder="None" />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    <SelectItem value="Low">Low</SelectItem>
                                                                                    <SelectItem value="Medium">Medium</SelectItem>
                                                                                    <SelectItem value="High">High</SelectItem>
                                                                                </SelectContent>
                                                                            </Select>
                                                                        </div>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <Label className="text-xs text-muted-foreground">Instructions / Notes</Label>
                                                                        <textarea
                                                                            placeholder="e.g. Call candidate to confirm interview schedule"
                                                                            value={followUpNotes}
                                                                            onChange={(e) => setFollowUpNotes(e.target.value)}
                                                                            className="w-full min-h-[60px] rounded-lg border border-border bg-background p-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                                                                        />
                                                                    </div>
                                                                    <Button
                                                                        onClick={() => handleScheduleFollowup(cand._id)}
                                                                        disabled={schedulingFollowup || !followUpDate || !followUpNotes.trim()}
                                                                        className="w-full bg-violet-600 hover:bg-violet-700 text-white h-9"
                                                                    >
                                                                        {schedulingFollowup ? "Scheduling..." : "Schedule"}
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    </Fragment>
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
                                            {toESTDate(cand.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-1 border-t border-border/50">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className={`h-8 gap-1.5 text-xs ${
                                            expandedCandidateId === cand._id 
                                                ? 'text-violet-500 bg-violet-500/10 font-bold' 
                                                : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                        onClick={() => toggleExpand(cand._id)}
                                    >
                                        <MessageSquare size={13} />
                                        Notes & Follow-ups
                                    </Button>
                                    <div className="flex items-center gap-2">
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

                                {expandedCandidateId === cand._id && (
                                    <div className="border-t border-border/50 pt-4 mt-2 space-y-4">
                                        {/* Mobile Tab Switcher */}
                                        <div className="flex gap-4 border-b border-border/50 pb-2">
                                            <button
                                                onClick={() => setActiveTab(cand._id, "notes")}
                                                className={`text-xs font-semibold pb-1.5 border-b-2 transition-all relative ${
                                                    getActiveTab(cand._id) === "notes"
                                                        ? "border-violet-500 text-violet-500 font-bold"
                                                        : "border-transparent text-muted-foreground hover:text-foreground"
                                                }`}
                                            >
                                                Notes ({parseCandidateNotes(cand.notes).length})
                                            </button>
                                            <button
                                                onClick={() => setActiveTab(cand._id, "followups")}
                                                className={`text-xs font-semibold pb-1.5 border-b-2 transition-all relative ${
                                                    getActiveTab(cand._id) === "followups"
                                                        ? "border-violet-500 text-violet-500 font-bold"
                                                        : "border-transparent text-muted-foreground hover:text-foreground"
                                                }`}
                                            >
                                                Follow-ups ({candidateFollowups[cand._id]?.length || 0})
                                            </button>
                                        </div>

                                        {/* Mobile Tab Contents */}
                                        {getActiveTab(cand._id) === "notes" && (
                                            <div className="space-y-4">
                                                {/* Note List */}
                                                <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                                                    {parseCandidateNotes(cand.notes).length === 0 ? (
                                                        <p className="text-xs text-muted-foreground italic">No notes added yet.</p>
                                                    ) : (
                                                        parseCandidateNotes(cand.notes).map((note, index) => (
                                                            <div key={index} className="bg-muted/40 border border-border/30 rounded-lg p-2.5 flex justify-between items-center gap-2 relative group">
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex justify-between items-center text-[10px] mb-0.5">
                                                                        <span className="font-semibold text-violet-400">{note.author}</span>
                                                                        <span className="text-[9px] text-muted-foreground">{formatAsEST(note.date)}</span>
                                                                    </div>
                                                                    <p className="text-xs text-foreground whitespace-pre-wrap">{note.text}</p>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleDeleteNote(cand, index)}
                                                                    className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-all shrink-0 self-center"
                                                                    title="Delete Note"
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>

                                                <div className="flex gap-2 items-end pt-2 border-t border-border/40 font-normal">
                                                    <div className="flex-1">
                                                        <textarea
                                                            placeholder="Add a new note..."
                                                            value={newNoteText}
                                                            onChange={(e) => setNewNoteText(e.target.value)}
                                                            className="w-full min-h-[50px] max-h-[100px] rounded-lg border border-border bg-background p-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 text-foreground placeholder:text-muted-foreground"
                                                        />
                                                    </div>
                                                    <Button
                                                        onClick={() => handleAddNote(cand)}
                                                        disabled={savingNote || !newNoteText.trim()}
                                                        className="bg-violet-600 hover:bg-violet-700 text-white shrink-0 h-9 px-3 text-xs"
                                                    >
                                                        Add
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        {getActiveTab(cand._id) === "followups" && (
                                            <div className="space-y-4">
                                                {/* Follow-up List */}
                                                <div className="space-y-3">
                                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Scheduled Follow-ups</h4>
                                                    <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                                                        {loadingFollowups[cand._id] ? (
                                                            <p className="text-xs text-muted-foreground animate-pulse">Loading...</p>
                                                        ) : !candidateFollowups[cand._id] || candidateFollowups[cand._id].length === 0 ? (
                                                            <p className="text-xs text-muted-foreground italic">No follow-ups.</p>
                                                        ) : (
                                                            candidateFollowups[cand._id].map((fu) => (
                                                                <div key={fu._id} className={`border rounded-lg p-2.5 flex justify-between items-start ${
                                                                    fu.status === 'done'
                                                                        ? "bg-emerald-500/5 border-emerald-500/20 opacity-80"
                                                                        : "bg-muted/40 border-border/30"
                                                                }`}>
                                                                    <div className="space-y-1 min-w-0">
                                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                                                                fu.type === 'Call'
                                                                                    ? "bg-orange-500/10 text-orange-500"
                                                                                    : fu.type === 'Email'
                                                                                        ? "bg-indigo-500/10 text-indigo-500"
                                                                                        : "bg-blue-500/10 text-blue-500"
                                                                            }`}>
                                                                                {fu.type}
                                                                            </span>
                                                                            {fu.priority && (
                                                                                <span className="text-[8px] font-semibold uppercase px-1 py-0.2 bg-zinc-500/10 text-zinc-400 rounded">
                                                                                    {fu.priority}
                                                                                </span>
                                                                            )}
                                                                            <span className="text-[9px] text-muted-foreground">
                                                                                {formatAsEST(fu.date_time)}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-xs text-muted-foreground whitespace-pre-wrap">{fu.notes}</p>
                                                                    </div>
                                                                    
                                                                    <div className="flex items-center gap-0.5 shrink-0 ml-1">
                                                                        {fu.status !== 'done' && (
                                                                            <button
                                                                                onClick={() => handleCompleteFollowup(cand._id, fu._id)}
                                                                                className="p-1 hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-500 rounded transition-colors"
                                                                            >
                                                                                <CheckCircle size={12} />
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            onClick={() => openEditFollowup(cand._id, fu)}
                                                                            className="p-1 hover:bg-violet-500/10 text-muted-foreground hover:text-violet-500 rounded transition-colors"
                                                                            title="Edit"
                                                                        >
                                                                            <Pencil size={12} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeleteFollowup(cand._id, fu._id)}
                                                                            className="p-1 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded transition-colors"
                                                                        >
                                                                            <Trash2 size={12} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Scheduler Form */}
                                                <div className="space-y-3 pt-3 border-t border-border/40">
                                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Schedule Follow-up</h4>
                                                    <div className="space-y-2.5">
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] text-muted-foreground">Date & Time</Label>
                                                            <DateTimePicker value={followUpDate} onChange={setFollowUpDate} size="sm" />
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="space-y-1">
                                                                <Label className="text-[10px] text-muted-foreground">Type</Label>
                                                                <Select
                                                                    value={followUpType}
                                                                    onValueChange={setFollowUpType}
                                                                >
                                                                    <SelectTrigger className="h-8 text-xs">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="Call">Call</SelectItem>
                                                                        <SelectItem value="Email">Email</SelectItem>
                                                                        <SelectItem value="Meeting">Meeting</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-[10px] text-muted-foreground">Priority</Label>
                                                                <Select
                                                                    value={followUpPriority}
                                                                    onValueChange={setFollowUpPriority}
                                                                >
                                                                    <SelectTrigger className="h-8 text-xs">
                                                                        <SelectValue placeholder="None" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="Low">Low</SelectItem>
                                                                        <SelectItem value="Medium">Medium</SelectItem>
                                                                        <SelectItem value="High">High</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] text-muted-foreground">Instructions / Notes</Label>
                                                            <textarea
                                                                placeholder="e.g. Call candidate to confirm..."
                                                                value={followUpNotes}
                                                                onChange={(e) => setFollowUpNotes(e.target.value)}
                                                                className="w-full min-h-[50px] rounded-lg border border-border bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                                                            />
                                                        </div>
                                                        <Button
                                                            onClick={() => handleScheduleFollowup(cand._id)}
                                                            disabled={schedulingFollowup || !followUpDate || !followUpNotes.trim()}
                                                            className="w-full bg-violet-600 hover:bg-violet-700 text-white h-8 text-xs"
                                                        >
                                                            {schedulingFollowup ? "Scheduling..." : "Schedule"}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* ── Add / Edit Candidate Modal ── */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent aria-describedby={undefined} className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {editingCandidate ? (
                                <>
                                    <Pencil size={16} className="text-violet-500" />
                                    Edit HC Candidate
                                </>
                            ) : (
                                <>
                                    <Plus size={16} className="text-violet-500" />
                                    Add HC Candidate
                                </>
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {editingCandidate ? "Update the HC candidate's details." : "Add a new HC candidate."}
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
                            <textarea
                                id="cand-notes"
                                placeholder="Interview performance, references, etc."
                                value={form.notes}
                                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                className="w-full min-h-[80px] rounded-lg border border-border bg-background p-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 text-foreground placeholder:text-muted-foreground"
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
                                    <Plus size={14} /> Add HC Candidate
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Candidate Note Delete Confirmation ── */}
            <AlertDialog open={!!noteDeleteTarget} onOpenChange={(open) => !open && setNoteDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Trash2 size={16} className="text-destructive" />
                            Delete Note?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this note? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deletingNote}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            id="btn-confirm-delete-note"
                            onClick={confirmDeleteNote}
                            disabled={deletingNote}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                            {deletingNote ? "Deleting…" : "Yes, Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Conflict Dialog ── */}
            <AlertDialog open={conflictDialogOpen} onOpenChange={(open) => { if (!open) { setConflictDialogOpen(false); setConflictCandidateId(null); } }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle size={16} className="text-amber-500" />
                            Scheduling Conflict
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {conflictMessage || "Another follow-up is already scheduled at this time."} Do you want to schedule anyway and override the conflict?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => { setConflictDialogOpen(false); setConflictCandidateId(null); }}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            id="btn-force-schedule-followup"
                            onClick={handleForceScheduleFollowup}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            Schedule Anyway
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Edit Follow-up Dialog ── */}
            <Dialog open={!!editingFollowup} onOpenChange={(open) => { if (!open) { setEditingFollowup(null); setEditFollowupCandId(null); } }}>
                <DialogContent aria-describedby={undefined} className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Pencil size={16} className="text-violet-500" />
                            Edit Follow-up
                        </DialogTitle>
                        <DialogDescription>
                            Update the details of this follow-up.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label>Date &amp; Time</Label>
                            <DateTimePicker value={editFollowUpDate} onChange={setEditFollowUpDate} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Type</Label>
                                <Select value={editFollowUpType} onValueChange={setEditFollowUpType}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Call">Call</SelectItem>
                                        <SelectItem value="Email">Email</SelectItem>
                                        <SelectItem value="Meeting">Meeting</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Priority</Label>
                                <Select value={editFollowUpPriority} onValueChange={setEditFollowUpPriority}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="None" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Low">Low</SelectItem>
                                        <SelectItem value="Medium">Medium</SelectItem>
                                        <SelectItem value="High">High</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Instructions / Notes</Label>
                            <textarea
                                placeholder="e.g. Call candidate to confirm interview schedule"
                                value={editFollowUpNotes}
                                onChange={(e) => setEditFollowUpNotes(e.target.value)}
                                className="w-full min-h-[80px] rounded-lg border border-border bg-background p-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 text-foreground placeholder:text-muted-foreground"
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => { setEditingFollowup(null); setEditFollowupCandId(null); }} disabled={savingEditFollowup}>
                            Cancel
                        </Button>
                        <Button
                            id="btn-save-edit-followup"
                            onClick={handleSaveEditFollowup}
                            disabled={savingEditFollowup || !editFollowUpDate}
                            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
                        >
                            {savingEditFollowup ? "Saving…" : <><Pencil size={14} /> Save Changes</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Delete Follow-up Confirmation ── */}
            <AlertDialog open={!!followupDeleteTarget} onOpenChange={(open) => !open && setFollowupDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Trash2 size={16} className="text-destructive" />
                            Delete Follow-up?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this follow-up? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deletingFollowup}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            id="btn-confirm-delete-followup"
                            onClick={confirmDeleteFollowup}
                            disabled={deletingFollowup}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                            {deletingFollowup ? "Deleting…" : "Yes, Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Candidate Delete Confirmation ── */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Trash2 size={16} className="text-destructive" />
                            Remove HC Candidate?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete HC candidate{" "}
                            <strong>{deleteTarget?.name}</strong> from the database.
                            This action cannot be undone.
                        </AlertDialogDescription>
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
