import { useEffect, useState } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import { Clock, AlertCircle, Calendar, CheckCircle, Phone, ArrowUpRight, Eye, Search, X, CheckCircle2, Edit, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "../context/AuthContext";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
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

interface FollowUp {
    _id: string;
    title?: string;
    notes: string;
    date_time: string;
    type: string;
    priority: string;
    status: string;
    lead: {
        _id: string;
        name: string;
        telephone?: string;
    };
    campaign: {
        _id: string;
        name: string;
    };
    assigned_user?: string;
}

interface GroupedFollowUps {
    overdue: FollowUp[];
    dueToday: FollowUp[];
    upcoming: FollowUp[];
}

export default function FollowUps() {
    const [data, setData] = useState<GroupedFollowUps | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    const { currentUser } = useAuth();
    const isReadOnly = currentUser?.role === 'view_only';

    // Follow-up editing states
    const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
    const [followUpTitle, setFollowUpTitle] = useState("");
    const [followUpDate, setFollowUpDate] = useState("");
    const [followUpType, setFollowUpType] = useState("Call");
    const [followUpPriority, setFollowUpPriority] = useState("");
    const [followUpNotes, setFollowUpNotes] = useState("");
    const [assignedTo, setAssignedTo] = useState("self");
    const [customAssignedTo, setCustomAssignedTo] = useState("");
    const [followUpStatus, setFollowUpStatus] = useState("pending");
    const [editingFollowUp, setEditingFollowUp] = useState<any | null>(null);
    const [fuErrors, setFuErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Completion states
    const [taskToComplete, setTaskToComplete] = useState<string | null>(null);
    const [isConfirmDoneOpen, setIsConfirmDoneOpen] = useState(false);
    const [followUpToDelete, setFollowUpToDelete] = useState<string | null>(null);

    const loadFollowUps = async () => {
        try {
            const res = await api.get("/followups/grouped");
            setData(res.data);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load follow-ups");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFollowUps();
    }, []);

    const handleOpenEditFollowUpModal = (fu: any) => {
        setEditingFollowUp(fu);
        setFollowUpTitle(fu.title || "");
        setFollowUpDate(fu.date_time ? new Date(new Date(fu.date_time).getTime() - new Date(fu.date_time).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
        setFollowUpNotes(fu.notes || "");
        setFollowUpType(fu.type || "Call");
        let p = fu.priority;
        if (!p || p === "None") {
            p = "";
        } else {
            p = p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
        }
        setFollowUpPriority(p);
        setFollowUpStatus(fu.status || "pending");
        if (!fu.assigned_user) {
            setAssignedTo("self");
            setCustomAssignedTo("");
        } else {
            setAssignedTo("other");
            setCustomAssignedTo(fu.assigned_user);
        }
        setFuErrors({});
        setIsFollowUpModalOpen(true);
    };

    const handleDeleteFollowUp = (fuId: string) => {
        setFollowUpToDelete(fuId);
    };

    const confirmDeleteFollowUp = async () => {
        if (!followUpToDelete) return;
        try {
            await api.delete(`/followups/${followUpToDelete}`);
            toast.success("Follow-up deleted");
            loadFollowUps();
        } catch (err) {
            toast.error("Failed to delete follow-up");
        } finally {
            setFollowUpToDelete(null);
        }
    };

    const markFollowupDone = (fuId: string) => {
        setTaskToComplete(fuId);
        setIsConfirmDoneOpen(true);
    };

    const handleConfirmDone = async () => {
        if (!taskToComplete || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await api.put(`/followups/${taskToComplete}/complete`);
            toast.success("Follow-up completed");
            setIsConfirmDoneOpen(false);
            setTaskToComplete(null);
            loadFollowUps();
        } catch (error) {
            console.error(error);
            toast.error("Failed to complete follow-up");
        } finally {
            setIsSubmitting(false);
        }
    };

    const submitFollowUp = async (force = false) => {
        if (isSubmitting) return;
        const errors: Record<string, string> = {};

        if (!followUpDate) {
            errors.date = "Date and time are required";
        }

        if (!followUpNotes.trim()) {
            errors.notes = "Please provide notes/instructions";
        }

        if (Object.keys(errors).length > 0) {
            setFuErrors(errors);
            toast.error("Please fill in all required fields");
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                title: followUpTitle.trim(),
                date_time: new Date(followUpDate).toISOString(),
                type: followUpType,
                priority: followUpPriority,
                notes: followUpNotes,
                status: followUpStatus,
                force
            };

            await api.put(`/followups/${editingFollowUp._id}`, payload);
            toast.success("Follow-up updated");
            setIsFollowUpModalOpen(false);
            setEditingFollowUp(null);
            setFollowUpTitle("");
            loadFollowUps();
        } catch (err: any) {
            if (err.response?.status === 409) {
                const conflicts = err.response.data.conflicts || [];
                const conflictNames = conflicts.map((c: any) => c.summary).join(", ");
                if (window.confirm(`Conflict detected: "${conflictNames || 'Existing Event'}". Update anyway?`)) {
                    setIsSubmitting(false);
                    submitFollowUp(true);
                    return;
                }
            } else {
                toast.error(err.response?.data?.message || "Failed to update follow-up");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const filterBySearch = (list: FollowUp[]) => {
        if (!searchQuery.trim()) return list;
        const query = searchQuery.toLowerCase();
        return list.filter((item) => {
            const leadNameMatch = item.lead?.name?.toLowerCase().includes(query) || false;
            const titleMatch = item.title?.toLowerCase().includes(query) || false;
            const notesMatch = item.notes?.toLowerCase().includes(query) || false;
            const typeMatch = item.type?.toLowerCase().includes(query) || false;
            return leadNameMatch || titleMatch || notesMatch || typeMatch;
        });
    };

    const overdueFiltered = filterBySearch(data?.overdue || []);
    const dueTodayFiltered = filterBySearch(data?.dueToday || []);
    const upcomingFiltered = filterBySearch(data?.upcoming || []);

    const TaskCard = ({ item, variant }: { item: FollowUp, variant: 'overdue' | 'today' | 'upcoming' }) => {
        const statusStyles = {
            overdue: "border-l-destructive bg-destructive/5",
            today: "border-l-warning bg-warning/5",
            upcoming: "border-l-success bg-success/5"
        }[variant] || "border-l-border bg-card";

        return (
            <div className={`flex items-center justify-between p-4 border rounded-lg border-l-4 hover:shadow-md transition-shadow ${statusStyles}`}>
                <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-full ${item.status === 'done' ? 'bg-green-500/10 text-green-500' : 'bg-primary/10 text-primary'
                        }`}>
                        <Clock size={18} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm flex items-center gap-2">
                            <span className="text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded">{item.type || 'Task'}</span>
                            <Link to={`/lead/${item.lead._id}`} className="hover:text-primary transition-colors">
                                {item.lead?.name || 'Unknown Lead'}
                            </Link>
                        </h3>
                        {item.title && <h4 className="text-xs font-bold text-foreground mt-1.5">{item.title}</h4>}
                        <p className={`text-xs text-muted-foreground ${item.title ? 'mt-0.5' : 'mt-1'}`}>{item.notes}</p>
                        <div className="flex items-center gap-3 mt-2">
                            <span className="flex items-center gap-1 text-[10px] bg-secondary px-2 py-0.5 rounded-full text-secondary-foreground border">
                                {item.campaign?.name || 'No Campaign'}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                                <Calendar size={10} />
                                {new Date(item.date_time).toLocaleString()}
                            </span>
                            {item.lead?.telephone && (
                                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <Phone size={10} />
                                    {item.lead.telephone}
                                </span>
                            )}
                            {item.priority && (
                                <span className={`text-[10px] font-bold uppercase ${item.priority === 'High' ? 'text-destructive' : 'text-muted-foreground'}`}>
                                    {item.priority}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <Link to={`/lead/${item.lead._id}`}>
                        <Button variant="ghost" size="sm" className="p-1.5 h-8 w-8 hover:bg-accent rounded-lg" title="View details">
                            <Eye size={14} />
                        </Button>
                    </Link>
                    {!isReadOnly && (
                        <>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => markFollowupDone(item._id)}
                                className="p-1.5 h-8 w-8 hover:bg-success/15 hover:text-success rounded-lg"
                                title="Mark done"
                            >
                                <CheckCircle2 size={14} />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEditFollowUpModal(item)}
                                className="p-1.5 h-8 w-8 hover:bg-primary/15 hover:text-primary rounded-lg"
                                title="Edit follow-up"
                            >
                                <Edit size={14} />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteFollowUp(item._id)}
                                className="p-1.5 h-8 w-8 hover:bg-destructive/15 hover:text-destructive rounded-lg"
                                title="Delete follow-up"
                            >
                                <Trash2 size={14} />
                            </Button>
                        </>
                    )}
                </div>
            </div>
        );
    };

    const TaskSection = ({ title, items, icon: Icon, color, variant }: { title: string, items: FollowUp[], icon: any, color: string, variant: 'overdue' | 'today' | 'upcoming' }) => (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-md ${color}`}>
                    <Icon size={16} />
                </div>
                <h2 className="text-lg font-bold">{title}</h2>
                <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full border">
                    {items.length}
                </span>
            </div>
            <div className="space-y-3">
                {items.length === 0 ? (
                    <div className="p-8 text-center border-2 border-dashed rounded-lg bg-muted/30 text-muted-foreground text-sm">
                        {searchQuery ? "No matching follow-ups found." : `No ${title.toLowerCase()} follow-ups.`}
                    </div>
                ) : (
                    items.map(item => <TaskCard key={item._id} item={item} variant={variant} />)
                )}
            </div>
        </div>
    );

    if (loading) return <AppLayout><div className="flex items-center justify-center h-full text-muted-foreground">Loading tasks...</div></AppLayout>;

    return (
        <AppLayout>
            <div className="space-y-8 max-w-5xl mx-auto pb-12">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Follow Ups</h1>
                        <p className="text-muted-foreground mt-1">Manage and track all scheduled activities.</p>
                    </div>
                    
                    {/* Search Bar */}
                    <div className="relative w-full sm:w-80 shrink-0">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                            <Search size={14} />
                        </span>
                        <input
                            id="followups-search"
                            name="followups-search"
                            type="text"
                            placeholder="Search follow-ups by lead or notes..."
                            className="input-field pl-9 pr-10 py-1.5 text-xs dark:bg-card w-full shadow-sm rounded-xl"
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
                </div>

                <div className="grid grid-cols-1 gap-8">
                    <TaskSection
                        title="Overdue"
                        items={overdueFiltered}
                        icon={AlertCircle}
                        color="bg-red-500/10 text-red-500"
                        variant="overdue"
                    />
                    <TaskSection
                        title="Due Today"
                        items={dueTodayFiltered}
                        icon={Clock}
                        color="bg-warning/10 text-warning"
                        variant="today"
                    />
                    <TaskSection
                        title="Upcoming"
                        items={upcomingFiltered}
                        icon={Calendar}
                        color="bg-success/10 text-success"
                        variant="upcoming"
                    />
                </div>
            </div>

            {/* Edit Follow-up Modal */}
            <Dialog
                open={isFollowUpModalOpen}
                onOpenChange={(open) => {
                    setIsFollowUpModalOpen(open);
                    if (!open) {
                        setFuErrors({});
                        setEditingFollowUp(null);
                    }
                }}
            >
                <DialogContent aria-describedby={undefined} className="w-[90vw] max-w-md dark:bg-card max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <DialogHeader>
                        <DialogTitle className="dark:text-foreground">Edit Follow-up</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <label htmlFor="title" className="text-sm font-medium">Title</label>
                            <input
                                id="title"
                                type="text"
                                name="title"
                                className="input-field dark:bg-card"
                                placeholder="e.g. Discuss proposal details"
                                value={followUpTitle || ""}
                                onChange={(e) => setFollowUpTitle(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <label htmlFor="date" className="text-sm font-medium">Follow-up Time <span className="text-destructive">*</span></label>
                            <input
                                id="date"
                                type="datetime-local"
                                name="date"
                                className={`input-field dark:bg-card dark:color-scheme-dark ${fuErrors.date ? "border-destructive focus:ring-destructive/20" : ""}`}
                                value={followUpDate || ""}
                                onChange={(e) => {
                                    setFollowUpDate(e.target.value);
                                    if (fuErrors.date) setFuErrors(prev => ({ ...prev, date: "" }));
                                }}
                                required
                            />
                            {fuErrors.date && <p className="text-xs text-destructive mt-1 font-medium">{fuErrors.date}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-4 items-start">
                            <div className="grid gap-2">
                                <label htmlFor="fu-type" className="text-sm font-medium">Type <span className="text-destructive">*</span></label>
                                <select
                                    id="fu-type"
                                    name="type"
                                    className={`input-field dark:bg-card ${fuErrors.type ? "border-destructive focus:ring-destructive/20" : ""}`}
                                    value={followUpType || ""}
                                    onChange={e => {
                                        setFollowUpType(e.target.value);
                                        if (fuErrors.type) setFuErrors(prev => ({ ...prev, type: "" }));
                                    }}
                                >
                                    <option value="">Select type...</option>
                                    <option value="Call">Call</option>
                                    <option value="Email">Email</option>
                                    <option value="Meeting">Meeting</option>
                                    <option value="Task">Task</option>
                                </select>
                                {fuErrors.type && <p className="text-xs text-destructive mt-1 font-medium">{fuErrors.type}</p>}
                            </div>
                            <div className="grid gap-2">
                                <label htmlFor="fu-priority" className="text-sm font-medium">Priority (optional)</label>
                                <select
                                    id="fu-priority"
                                    name="priority"
                                    className={`input-field dark:bg-card ${fuErrors.priority ? "border-destructive focus:ring-destructive/20" : ""}`}
                                    value={followUpPriority || ""}
                                    onChange={e => {
                                        setFollowUpPriority(e.target.value);
                                        if (fuErrors.priority) setFuErrors(prev => ({ ...prev, priority: "" }));
                                    }}
                                >
                                    <option value="">NO</option>
                                    <option value="Low">Low</option>
                                    <option value="Medium">Medium</option>
                                    <option value="High">High</option>
                                </select>
                                {fuErrors.priority && <p className="text-xs text-destructive mt-1 font-medium">{fuErrors.priority}</p>}
                                {(!followUpPriority || followUpPriority === "") && (
                                    <p className="text-xs text-muted-foreground mt-1">The Priority is not required</p>
                                )}
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <label htmlFor="fu-status" className="text-sm font-medium">Status <span className="text-destructive">*</span></label>
                            <select
                                id="fu-status"
                                name="status"
                                className="input-field dark:bg-card"
                                value={followUpStatus || ""}
                                onChange={e => setFollowUpStatus(e.target.value)}
                            >
                                <option value="pending">Pending</option>
                                <option value="done">Completed / Done</option>
                            </select>
                        </div>
                        <div className="grid gap-2">
                            <label htmlFor="reason" className="text-sm font-medium">Notes / Instructions <span className="text-destructive">*</span></label>
                            <textarea
                                id="reason"
                                name="notes"
                                className={`input-field min-h-[80px] ${fuErrors.notes ? "border-destructive focus:ring-destructive/20" : ""}`}
                                placeholder="What needs to happen?"
                                value={followUpNotes || ""}
                                onChange={(e) => {
                                    setFollowUpNotes(e.target.value);
                                    if (fuErrors.notes) setFuErrors(prev => ({ ...prev, notes: "" }));
                                }}
                            />
                            {fuErrors.notes && <p className="text-xs text-destructive mt-1 font-medium">{fuErrors.notes}</p>}
                        </div>
                    </div>
                    <DialogFooter>
                        <button className="btn-secondary" onClick={() => {
                            setIsFollowUpModalOpen(false);
                            setFuErrors({});
                            setEditingFollowUp(null);
                        }}>Cancel</button>
                        <button
                            disabled={isSubmitting}
                            className={`btn-primary ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
                            onClick={() => submitFollowUp()}
                        >
                            {isSubmitting ? "Saving..." : "Update Follow-up"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirm Completion Modal */}
            <Dialog open={isConfirmDoneOpen} onOpenChange={setIsConfirmDoneOpen}>
                <DialogContent aria-describedby={undefined} className="w-[90vw] max-w-sm dark:bg-card max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <DialogHeader>
                        <DialogTitle className="dark:text-foreground text-center font-bold">Confirm Completion</DialogTitle>
                    </DialogHeader>
                    <div className="py-3 text-center">
                        <p className="text-muted-foreground text-sm">
                            Are you sure you want to mark this follow-up as completed?
                        </p>
                    </div>
                    <DialogFooter className="mt-1 justify-center sm:justify-center flex-row gap-3">
                        <button className="btn-secondary h-10 px-6 rounded-lg text-xs" onClick={() => setIsConfirmDoneOpen(false)}>Cancel</button>
                        <button className="btn-primary h-10 px-8 rounded-lg text-xs font-bold bg-success hover:bg-success/90" onClick={handleConfirmDone} disabled={isSubmitting}>
                            {isSubmitting ? "Completing..." : "Confirm"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Follow-up Confirmation Dialog */}
            <AlertDialog open={!!followUpToDelete} onOpenChange={(open) => !open && setFollowUpToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-600 dark:text-red-400 font-bold flex items-center gap-2">
                            Confirm Permanent Deletion
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm">
                            Are you sure you want to permanently delete this follow-up? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>No, Keep It</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDeleteFollowUp}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
                        >
                            Yes, Delete Permanently
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}
