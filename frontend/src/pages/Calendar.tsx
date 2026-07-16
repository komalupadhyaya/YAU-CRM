import { useCallback, useEffect, useState } from "react";
import AppLayout from "../layout/AppLayout";
import api from "../api/api";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toESTDate } from "../utils/timezoneHelper";
import {
    CalendarDays, ChevronLeft, ChevronRight,
    Clock, AlertCircle, CheckCircle2,
    Loader2, Filter, ChevronDown, Video
} from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../components/ui/select";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CalEvent {
    id: string;
    type: "followup" | "task";
    title: string;
    date: Date;
    status: string;
    priority?: string;
    leadId?: string;
    candidateId?: string;
    // follow-up specific
    notes?: string;
    followUpType?: string;
    campaignName?: string;
    leadName?: string;
    // task specific
    taskDescription?: string;
    assignedToName?: string;
    // user filtering specific
    createdById?: string;
    assignedUser?: string;
    assignedToId?: string;
    assignedToIds?: string[];
    // meeting specific
    meetingType?: "online" | "in_person" | "phone";
    meetingLink?: string | null;
    zoomStartUrl?: string | null;
    durationMinutes?: number;
}
// ─── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
];
const DAYS_FULL  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate();

const isToday = (d: Date) => sameDay(d, new Date());
const isPast  = (d: Date) => d < new Date() && !isToday(d);

const fmtTime = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

const PRIORITY_COLOR: Record<string, string> = {
    high:   "text-red-500 bg-red-500/10 border-red-500/20",
    medium: "text-orange-400 bg-orange-400/10 border-orange-400/20",
    low:    "text-blue-400 bg-blue-400/10 border-blue-400/20",
};

const dotBg = (ev: CalEvent) => {
    const done = ev.status === "done" || ev.status === "completed";
    if (done) return "bg-green-500";
    if (isPast(ev.date)) return "bg-red-500";
    if (ev.type === "task") return "bg-blue-500";
    if (ev.followUpType === "HR Meeting") return "bg-emerald-500";
    if (ev.followUpType === "School Meeting") return "bg-purple-500";
    return "bg-orange-400";
};

const cellEventBg = (ev: CalEvent) => {
    const done = ev.status === "done" || ev.status === "completed";
    const overdue = isPast(ev.date) && !done;
    if (overdue) return "bg-red-500/15 text-red-500";
    if (done) return "bg-green-500/10 text-green-500";
    
    if (ev.type === "task") return "bg-blue-500/15 text-blue-500";
    if (ev.followUpType === "HR Meeting") return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
    if (ev.followUpType === "School Meeting") return "bg-purple-500/15 text-purple-600 dark:text-purple-400";
    return "bg-orange-400/15 text-orange-500";
};

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function CalendarPage() {
    const { currentUser } = useAuth();
    const today = new Date();
    const [viewMonth,    setViewMonth]    = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const [selectedDate, setSelectedDate] = useState<Date>(today);
    const [events,       setEvents]       = useState<CalEvent[]>([]);
    const [loading,      setLoading]      = useState(true);

    const [showFollowups, setShowFollowups] = useState(true);
    const [showTasks, setShowTasks] = useState(true);
    const [showHCMeetings, setShowHCMeetings] = useState(true);
    const [showSchoolMeetings, setShowSchoolMeetings] = useState(true);
    const [filterOpen, setFilterOpen] = useState(false);
    const [filterType, setFilterType] = useState<'all' | 'school_meetings' | 'candidates' | 'hr_meetings' | 'followups' | 'tasks'>('all');

    const [teamMembers, setTeamMembers] = useState<any[]>([]);
    const [selectedMemberId, setSelectedMemberId] = useState<string>("all");

    useEffect(() => {
        if (currentUser?.role === "admin" || currentUser?.role === "manager") {
            api.get("/team")
                .then((res) => {
                    setTeamMembers(res.data || []);
                })
                .catch((err) => {
                    console.error("Error fetching team members:", err);
                });
        }
    }, [currentUser]);

    const isEventVisible = (ev: CalEvent) => {
        // Team member filter check
        if (selectedMemberId !== "all") {
            const selectedMember = teamMembers.find((m) => m._id === selectedMemberId);
            if (!selectedMember) return false;

            const isMeeting = ev.followUpType === "School Meeting" || ev.followUpType === "HR Meeting";
            if (isMeeting) {
                const matchesAttendee = ev.assignedToIds?.includes(selectedMemberId);
                const hasNoAttendees = !ev.assignedToIds || ev.assignedToIds.length === 0;
                const matchesCreator = hasNoAttendees && ev.createdById === selectedMemberId;
                if (!matchesAttendee && !matchesCreator) return false;
            } else if (ev.type === "task") {
                const matchesAssigned = ev.assignedToId === selectedMemberId;
                const hasNoAssignee = !ev.assignedToId;
                const matchesCreator = hasNoAssignee && ev.createdById === selectedMemberId;
                if (!matchesAssigned && !matchesCreator) return false;
            } else {
                // general follow-up
                const matchesAssigned =
                    ev.assignedUser === selectedMemberId ||
                    ev.assignedUser === selectedMember.name ||
                    ev.assignedUser === selectedMember.username ||
                    ev.assignedUser === selectedMember.email ||
                    ((!ev.assignedUser || ev.assignedUser === "self") && ev.createdById === selectedMemberId);
                if (!matchesAssigned) return false;
            }
        }

        // High-level filter type check
        if (filterType === 'school_meetings') {
            if (ev.followUpType !== "School Meeting") return false;
        } else if (filterType === 'candidates') {
            const isCandidateFollowUp = ev.type === "followup" && ev.candidateId && ev.followUpType !== "HR Meeting";
            if (!isCandidateFollowUp) return false;
        } else if (filterType === 'hr_meetings') {
            if (ev.followUpType !== "HR Meeting") return false;
        } else if (filterType === 'followups') {
            const isMeeting = ev.followUpType === "School Meeting" || ev.followUpType === "HR Meeting";
            if (ev.type !== "followup" || isMeeting) return false;
        } else if (filterType === 'tasks') {
            if (ev.type !== "task") return false;
        }

        // Detailed toggles check
        if (ev.type === "task") return showTasks;
        if (ev.type === "followup") {
            if (ev.followUpType === "School Meeting") return showSchoolMeetings;
            if (ev.followUpType === "HR Meeting") return showHCMeetings;
            return showFollowups;
        }
        return true;
    };
 
    const fetchEvents = useCallback(async () => {
        setLoading(true);
        try {
            const [fuRes, taskRes, meetingRes] = await Promise.all([
                api.get("/followups/grouped").catch(() => ({ data: null })),
                api.get("/tasks").catch(() => ({ data: [] })),
                api.get("/meetings").catch(() => ({ data: [] })),
            ]);
 
            const all: CalEvent[] = [];
 
            const grouped = fuRes.data;
            if (grouped) {
                // Backend already filters follow-ups for sales_rep via aggregation pipeline
                const rawFollowups = [...(grouped.overdue || []), ...(grouped.dueToday || []), ...(grouped.upcoming || [])];

                rawFollowups.forEach((fu: any) => {
                    all.push({
                        id:           fu._id,
                        type:         "followup",
                        title:        fu.title || fu.lead_name || fu.lead?.name || "Follow-up",
                        date:         toESTDate(fu.date_time),
                        status:       fu.status || "pending",
                        priority:     fu.priority,
                        leadId:       fu.lead?._id || fu.lead_id_val,
                        candidateId:  fu.candidate?._id || fu.candidate_id_val,
                        notes:        fu.notes,
                        followUpType: fu.type,
                        campaignName: fu.campaign?.name || fu.campaign_name,
                        leadName:     fu.lead_name || fu.lead?.name,
                        createdById:  fu.created_by,
                        assignedUser: fu.assigned_user,
                    });
                });
            }
 
            const rawTasks = taskRes.data || [];
            // Backend already filters tasks for sales_rep (assignedTo = req.user.id)
            rawTasks.forEach((t: any) => {
                if (!t.dueDate) return;
                all.push({
                    id:              t._id,
                    type:            "task",
                    title:           t.title,
                    date:            toESTDate(t.dueDate),
                    status:          t.status,
                    priority:        t.priority,
                    taskDescription: t.description,
                    assignedToName:  t.assignedTo?.name || t.assignedTo?.username,
                    leadId:          t.lead_id,
                    createdById:     t.createdBy?._id || t.createdBy,
                    assignedToId:    t.assignedTo?._id || t.assignedTo,
                });
            });

            const rawMeetings = meetingRes.data || [];
            rawMeetings.filter((m: any) => m.status !== 'canceled').forEach((m: any) => {
                const leads = (m.lead_ids && m.lead_ids.length > 0)
                    ? m.lead_ids
                    : m.lead_id ? [m.lead_id] : [];
                
                const candidates = (m.candidate_ids && m.candidate_ids.length > 0)
                    ? m.candidate_ids
                    : m.candidate_id ? [m.candidate_id] : [];

                const leadNames = leads.map((l: any) => l.name).join(', ');
                const candidateNames = candidates.map((c: any) => c.name).join(', ');

                let subTitle = "";
                if (m.category === 'school' && leadNames) {
                    subTitle = ` (${leadNames})`;
                } else if (m.category === 'hr' && candidateNames) {
                    subTitle = ` (${candidateNames})`;
                }

                all.push({
                    id:           m._id,
                    type:         "followup",
                    title:        `${m.title}${subTitle}`,
                    date:         toESTDate(m.date_time),
                    status:       m.status,
                    priority:     "High",
                    leadId:       leads[0]?._id,
                    candidateId:  candidates[0]?._id,
                    notes:        m.notes,
                    followUpType: m.category === 'school' ? 'School Meeting' : 'HR Meeting',
                    leadName:     leadNames || candidateNames || undefined,
                    createdById:  m.created_by?._id || m.created_by,
                    assignedToIds: m.internal_attendees?.map((a: any) => a._id || a) || [],
                    meetingType:  m.meeting_type,
                    meetingLink:  m.meeting_link,
                    zoomStartUrl: m.zoom_start_url,
                    durationMinutes: m.duration_minutes,
                });
            });
 
            setEvents(all);
        } finally {
            setLoading(false);
        }
    }, []);


    useEffect(() => { fetchEvents(); }, [fetchEvents]);

    // ── Calendar grid ──────────────────────────────────────────────────────────

    const year        = viewMonth.getFullYear();
    const month       = viewMonth.getMonth();
    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays    = new Date(year, month, 0).getDate();

    const cells: { date: Date; isCurrentMonth: boolean }[] = [];
    for (let i = firstDay - 1; i >= 0; i--) {
        cells.push({ date: new Date(year, month - 1, prevDays - i), isCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
        cells.push({ date: new Date(year, month, d), isCurrentMonth: true });
    }
    while (cells.length % 7 !== 0) {
        cells.push({ date: new Date(year, month + 1, cells.length - daysInMonth - firstDay + 1), isCurrentMonth: false });
    }

    const eventsOn       = (d: Date) => events.filter(e => sameDay(e.date, d) && isEventVisible(e));
    const selectedEvents = eventsOn(selectedDate);
 
    const monthEvents    = events.filter(e => e.date.getMonth() === month && e.date.getFullYear() === year && isEventVisible(e));
    const pendingCount   = monthEvents.filter(e => e.status !== "done" && e.status !== "completed").length;
    const overdueCount   = monthEvents.filter(e => (e.status !== "done" && e.status !== "completed") && isPast(e.date)).length;
    const completedCount = monthEvents.filter(e => e.status === "done" || e.status === "completed").length;

    return (
        <AppLayout>
            <div className="max-w-7xl mx-auto pb-12 space-y-6">

                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2.5">
                            <span className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                                <CalendarDays size={18} className="text-primary" />
                            </span>
                            Calendar
                        </h1>
                        <p className="text-muted-foreground mt-1">All follow-ups and tasks in one view.</p>
                    </div>

                    {!loading && (
                        <div className="flex flex-wrap gap-2">
                            <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-orange-400/10 text-orange-400 border border-orange-400/20">
                                <Clock size={11} /> {pendingCount} Pending
                            </span>
                            <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                                <AlertCircle size={11} /> {overdueCount} Overdue
                            </span>
                            <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
                                <CheckCircle2 size={11} /> {completedCount} Done
                            </span>
                        </div>
                    )}
                </div>

                {/* Filter Bar: Segmented Toggles & Team Member Dropdown */}
                {!loading && (
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full max-w-7xl">
                        {/* Segmented Filter Toggles */}
                        <div className="flex bg-muted/40 p-1 rounded-xl border w-full md:max-w-4xl gap-1 overflow-x-auto select-none scrollbar-none">
                            <button
                                onClick={() => setFilterType('all')}
                                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                    filterType === 'all'
                                        ? "bg-card text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                                }`}
                            >
                                All Activity
                            </button>
                            <button
                                onClick={() => setFilterType('hr_meetings')}
                                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                    filterType === 'hr_meetings'
                                        ? "bg-card text-emerald-600 dark:text-emerald-400 shadow-sm"
                                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                                }`}
                            >
                                HR Meetings
                            </button>
                            <button
                                onClick={() => setFilterType('school_meetings')}
                                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                    filterType === 'school_meetings'
                                        ? "bg-card text-purple-600 dark:text-purple-400 shadow-sm"
                                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                                }`}
                            >
                                School Meetings
                            </button>
                            <button
                                onClick={() => setFilterType('followups')}
                                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                    filterType === 'followups'
                                        ? "bg-card text-orange-500 shadow-sm"
                                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                                }`}
                            >
                                Follow-ups
                            </button>
                            <button
                                onClick={() => setFilterType('tasks')}
                                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                    filterType === 'tasks'
                                        ? "bg-card text-blue-500 shadow-sm"
                                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                                }`}
                            >
                                Tasks
                            </button>
                            {currentUser?.role !== 'sales_rep' && (
                                <button
                                    onClick={() => setFilterType('candidates')}
                                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                        filterType === 'candidates'
                                            ? "bg-card text-emerald-600 dark:text-emerald-400 shadow-sm"
                                            : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                                    }`}
                                >
                                    HC Candidates
                                </button>
                            )}
                        </div>

                        {/* Team Member Selector (Manager / Admin only) */}
                        {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Filter by User:</span>
                                <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                                    <SelectTrigger className="w-[180px] h-9 text-xs bg-card border-border text-foreground font-semibold shadow-sm focus:ring-1 focus:ring-primary">
                                        <SelectValue placeholder="All Team Members" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Team Members</SelectItem>
                                        {teamMembers.map((member) => (
                                            <SelectItem key={member._id} value={member._id}>
                                                {member.name || member.username} {member._id === currentUser?._id ? "(Me)" : ""}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
                        <Loader2 size={18} className="animate-spin" /> Loading calendar…
                    </div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 items-start">

                        {/* ── Calendar Grid ── */}
                        <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">

                            {/* Month navigation */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                                <button
                                    onClick={() => setViewMonth(new Date(year, month - 1, 1))}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <h2 className="font-bold text-lg text-foreground">{MONTHS[month]} {year}</h2>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => { setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(today); }}
                                        className="text-xs font-semibold px-3 py-1 rounded-lg hover:bg-primary/10 text-primary transition-colors border border-primary/20"
                                    >
                                        Today
                                    </button>
                                    <button
                                        onClick={() => setViewMonth(new Date(year, month + 1, 1))}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Day headers */}
                            <div className="grid grid-cols-7 border-b border-border">
                                {DAYS_SHORT.map(d => (
                                    <div key={d} className="py-3 text-center text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                        {d}
                                    </div>
                                ))}
                            </div>

                            {/* Date cells */}
                            <div className="grid grid-cols-7">
                                {cells.map(({ date, isCurrentMonth }, i) => {
                                    const dayEvs     = eventsOn(date);
                                    const selected   = sameDay(date, selectedDate);
                                    const todayDate  = isToday(date);
                                    const hasOverdue = dayEvs.some(e => (e.status !== "done" && e.status !== "completed") && isPast(e.date));
                                    const isLastRow  = i >= cells.length - 7;
                                    const isLastCol  = (i + 1) % 7 === 0;

                                    return (
                                        <button
                                            key={`${date.toISOString()}-${isCurrentMonth}`}
                                            onClick={() => setSelectedDate(date)}
                                            className={`relative min-h-[80px] p-2 text-left transition-all duration-100
                                                ${!isLastRow ? "border-b border-border" : ""}
                                                ${!isLastCol ? "border-r border-border" : ""}
                                                ${selected ? "bg-primary/8" : "hover:bg-accent/50"}
                                                ${!isCurrentMonth ? "opacity-30" : ""}
                                            `}
                                        >
                                            <span className={`inline-flex w-7 h-7 items-center justify-center rounded-full text-sm font-semibold
                                                ${selected && todayDate ? "bg-primary text-primary-foreground" :
                                                  selected   ? "bg-primary/20 text-primary" :
                                                  todayDate  ? "bg-primary text-primary-foreground" :
                                                  "text-foreground"
                                                }`}
                                            >
                                                {date.getDate()}
                                            </span>

                                            {dayEvs.length > 0 && (
                                                <div className="mt-1.5 space-y-0.5">
                                                    {dayEvs.slice(0, 3).map(ev => {
                                                        const done    = ev.status === "done" || ev.status === "completed";
                                                        const overdue = isPast(ev.date) && !done;
                                                        return (
                                                            <div
                                                                key={ev.id}
                                                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate ${cellEventBg(ev)}`}
                                                            >
                                                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotBg(ev)}`} />
                                                                <span className="truncate">{ev.title}</span>
                                                            </div>
                                                        );
                                                    })}
                                                    {dayEvs.length > 3 && (
                                                        <div className="text-[10px] text-muted-foreground px-1.5">
                                                            +{dayEvs.length - 3} more
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {hasOverdue && !selected && (
                                                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── Day Panel ── */}
                        <div className="bg-card border rounded-2xl shadow-sm sticky top-6 overflow-hidden">
                            {/* Day header */}
                            <div className="px-5 py-4 border-b border-border bg-muted/20">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                            {DAYS_FULL[selectedDate.getDay()]}
                                        </p>
                                        <h3 className="text-xl font-bold text-foreground mt-0.5">
                                            {selectedDate.getDate()} {MONTHS[selectedDate.getMonth()]} {selectedDate.getFullYear()}
                                        </h3>
                                    </div>
                                    <div className="flex items-center gap-2 relative">
                                        {isToday(selectedDate) && (
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
                                                Today
                                            </span>
                                        )}
                                        
                                        {/* Dropdown filter button with slide toggle switches */}
                                        <div className="relative inline-block text-left">
                                            <button
                                                type="button"
                                                onClick={() => setFilterOpen(prev => !prev)}
                                                className="h-7 px-2 rounded-lg border border-border bg-background hover:bg-accent text-muted-foreground hover:text-foreground text-[11px] font-bold flex items-center gap-1 transition-all shadow-sm"
                                            >
                                                <Filter size={11} />
                                                <span>Filter</span>
                                                <ChevronDown size={9} className={`transition-transform duration-200 ${filterOpen ? 'rotate-180' : ''}`} />
                                            </button>

                                            {filterOpen && (
                                                <>
                                                    <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />
                                                    <div className="absolute right-0 mt-1.5 w-48 rounded-xl border border-border bg-card p-3 shadow-xl z-50 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                                                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-1.5 mb-1.5">Event Filters</p>
                                                        
                                                        {/* Filter 1: Follow-ups */}
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                                                Follow-ups
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowFollowups(prev => !prev)}
                                                                className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                                                    showFollowups ? 'bg-primary' : 'bg-zinc-700'
                                                                }`}
                                                            >
                                                                <span
                                                                    className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                                                                        showFollowups ? 'translate-x-3' : 'translate-x-0'
                                                                    }`}
                                                                />
                                                            </button>
                                                        </div>

                                                        {/* Filter 2: Tasks */}
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                                Tasks
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowTasks(prev => !prev)}
                                                                className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                                                    showTasks ? 'bg-primary' : 'bg-zinc-700'
                                                                }`}
                                                            >
                                                                <span
                                                                    className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                                                                        showTasks ? 'translate-x-3' : 'translate-x-0'
                                                                    }`}
                                                                />
                                                            </button>
                                                        </div>

                                                        {/* Filter 3: HC Meetings */}
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                                HC Meetings
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowHCMeetings(prev => !prev)}
                                                                className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                                                    showHCMeetings ? 'bg-primary' : 'bg-zinc-700'
                                                                }`}
                                                            >
                                                                <span
                                                                    className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                                                                        showHCMeetings ? 'translate-x-3' : 'translate-x-0'
                                                                    }`}
                                                                />
                                                            </button>
                                                        </div>

                                                        {/* Filter 4: School Meetings */}
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                                                School Meetings
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowSchoolMeetings(prev => !prev)}
                                                                className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                                                    showSchoolMeetings ? 'bg-primary' : 'bg-zinc-700'
                                                                }`}
                                                            >
                                                                <span
                                                                    className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                                                                        showSchoolMeetings ? 'translate-x-3' : 'translate-x-0'
                                                                    }`}
                                                                />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <p className="text-[10px] font-semibold text-muted-foreground mt-2">
                                    {selectedEvents.length} event{selectedEvents.length !== 1 ? "s" : ""}
                                </p>
                            </div>

                            {/* Events list */}
                            <div className="max-h-[520px] overflow-y-auto custom-scrollbar">
                                {selectedEvents.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                                        <CalendarDays size={36} className="text-muted-foreground/20 mb-3" />
                                        <p className="text-sm font-semibold text-muted-foreground">No events</p>
                                        <p className="text-xs text-muted-foreground/60 mt-1">Nothing scheduled for this day.</p>
                                    </div>
                                ) : (
                                    <div className="p-3 space-y-2.5">
                                        {selectedEvents.map(ev => {
                                            const done       = ev.status === "done" || ev.status === "completed";
                                            const overdue    = isPast(ev.date) && !done;
                                            const isFollowup = ev.type === "followup";

                                            // Card left-border + tinted background
                                            const cardBorder = done
                                                ? "border-l-green-500 bg-green-500/5"
                                                : overdue
                                                ? "border-l-red-500 bg-red-500/5"
                                                : ev.followUpType === "HR Meeting"
                                                ? "border-l-emerald-500 bg-emerald-500/5"
                                                : ev.followUpType === "School Meeting"
                                                ? "border-l-purple-500 bg-purple-500/5"
                                                : isFollowup
                                                ? "border-l-orange-400 bg-orange-400/5"
                                                : "border-l-blue-500 bg-blue-500/5";

                                            // Type badge colour
                                            const typeLabelColor = done
                                                ? "bg-green-500/20 text-green-600"
                                                : overdue
                                                ? "bg-red-500/15 text-red-500"
                                                : ev.followUpType === "HR Meeting"
                                                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                                : ev.followUpType === "School Meeting"
                                                ? "bg-purple-500/20 text-purple-600 dark:text-purple-400"
                                                : isFollowup
                                                ? "bg-orange-400/20 text-orange-500"
                                                : "bg-blue-500/20 text-blue-500";

                                            const statusText  = done ? "Completed" : overdue ? "Overdue" : "Pending";
                                            const statusColor = done
                                                ? "text-green-500 font-semibold"
                                                : "text-red-500 font-semibold";

                                            return (
                                                <div
                                                    key={ev.id}
                                                    className={`rounded-xl border border-border border-l-4 ${cardBorder} overflow-hidden transition-all duration-150 hover:shadow-md ${done ? "opacity-75" : ""}`}
                                                >
                                                    {/* ── Top row: type badge · full datetime · priority ── */}
                                                    <div className="flex items-center gap-2 px-3.5 pt-3 pb-2">
                                                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md shrink-0 ${typeLabelColor}`}>
                                                            {isFollowup ? (ev.followUpType || "Follow-up") : "Task"}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground flex-1 truncate">
                                                            {ev.date.toLocaleString("en-US", {
                                                                month: "numeric", day: "numeric", year: "numeric",
                                                                hour: "numeric", minute: "2-digit", hour12: true,
                                                            })}
                                                        </span>
                                                        {ev.priority && (
                                                            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border shrink-0 ${PRIORITY_COLOR[ev.priority.toLowerCase()] || "bg-muted text-muted-foreground border-transparent"}`}>
                                                                {ev.priority}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* ── Lead / Task name ── */}
                                                    <div className="px-3.5 pb-1">
                                                        {isFollowup && (ev.leadId || ev.candidateId) ? (
                                                            <Link
                                                                to={ev.candidateId ? "/candidates" : `/lead/${ev.leadId}`}
                                                                className={`text-sm font-bold hover:text-primary transition-colors leading-snug block ${done ? "line-through text-muted-foreground" : "text-foreground"}`}
                                                            >
                                                                {ev.leadName || ev.title}
                                                            </Link>
                                                        ) : (
                                                            <p className={`text-sm font-bold leading-snug ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                                                {ev.title}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {/* ── Detail rows ── */}
                                                    <div className="px-3.5 pb-3 pt-1 space-y-1">
                                                        {/* Follow-up fields */}
                                                        {isFollowup && ev.notes && (
                                                            <div className="flex gap-2 text-xs">
                                                                <span className="text-muted-foreground w-16 shrink-0">Notes</span>
                                                                <span className="text-foreground leading-relaxed">{ev.notes}</span>
                                                            </div>
                                                        )}
                                                        {isFollowup && ev.campaignName && (
                                                            <div className="flex gap-2 text-xs">
                                                                <span className="text-muted-foreground w-16 shrink-0">Campaign</span>
                                                                <span className="text-foreground">{ev.campaignName}</span>
                                                            </div>
                                                        )}
                                                        {isFollowup && (
                                                            <div className="flex gap-2 text-xs">
                                                                <span className="text-muted-foreground w-16 shrink-0">Scheduled</span>
                                                                <span className="text-foreground">{fmtTime(ev.date)}</span>
                                                            </div>
                                                        )}
                                                        {isFollowup && ev.durationMinutes && (
                                                            <div className="flex gap-2 text-xs">
                                                                <span className="text-muted-foreground w-16 shrink-0">Duration</span>
                                                                <span className="text-foreground">{ev.durationMinutes} mins</span>
                                                            </div>
                                                        )}
                                                        {isFollowup && ev.meetingType === 'online' && (ev.zoomStartUrl || ev.meetingLink) && (
                                                            <div className="flex gap-2 text-xs items-center pt-0.5 pb-0.5">
                                                                <span className="text-muted-foreground w-16 shrink-0">Zoom</span>
                                                                <a
                                                                    href={ev.zoomStartUrl || ev.meetingLink}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                                                                >
                                                                    <Video size={11} />
                                                                    {ev.zoomStartUrl ? 'Start Zoom Meeting' : 'Join Zoom Meeting'}
                                                                </a>
                                                            </div>
                                                        )}
                                                        {isFollowup && (
                                                            <div className="flex gap-2 text-xs">
                                                                <span className="text-muted-foreground w-16 shrink-0">Status</span>
                                                                <span className={statusColor}>{statusText}</span>
                                                            </div>
                                                        )}

                                                        {/* Task fields */}
                                                        {!isFollowup && ev.taskDescription && (
                                                            <div className="flex gap-2 text-xs">
                                                                <span className="text-muted-foreground w-16 shrink-0">Details</span>
                                                                <span className="text-foreground leading-relaxed">{ev.taskDescription}</span>
                                                            </div>
                                                        )}
                                                        {!isFollowup && ev.assignedToName && (
                                                            <div className="flex gap-2 text-xs">
                                                                <span className="text-muted-foreground w-16 shrink-0">Assigned</span>
                                                                <span className="text-foreground">{ev.assignedToName}</span>
                                                            </div>
                                                        )}
                                                        {!isFollowup && (
                                                            <div className="flex gap-2 text-xs">
                                                                <span className="text-muted-foreground w-16 shrink-0">Due</span>
                                                                <span className="text-foreground">{fmtTime(ev.date)}</span>
                                                            </div>
                                                        )}
                                                        {!isFollowup && (
                                                            <div className="flex gap-2 text-xs">
                                                                <span className="text-muted-foreground w-16 shrink-0">Status</span>
                                                                <span className={statusColor}>{statusText}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Legend ── */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-2">
                    <span className="font-semibold text-foreground">Legend:</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-400" /> Follow-up (Pending)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Task (Pending)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> HC Meeting (Pending)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> School Meeting (Pending)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Completed / Done</span>
                </div>
            </div>
        </AppLayout>
    );
}
