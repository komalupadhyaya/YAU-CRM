import { useEffect, useRef, useState } from "react";
import {
    CalendarDays, ChevronLeft, ChevronRight, X,
    Clock, CheckSquare, AlertCircle, CheckCircle2
} from "lucide-react";
import api from "../api/api";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalEvent {
    id: string;
    type: "followup" | "task";
    title: string;
    date: Date;
    status: string;
    priority?: string;
    leadId?: string;
    leadName?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

const isToday = (d: Date) => sameDay(d, new Date());
const isPast  = (d: Date) => d < new Date() && !isToday(d);

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CalendarPopover() {
    const { currentUser } = useAuth();
    const [open, setOpen] = useState(false);
    const [viewMonth, setViewMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [events, setEvents] = useState<CalEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
 
    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);
 
    // Fetch follow-ups + tasks when opened
    useEffect(() => {
        if (!open) return;
        setLoading(true);
        Promise.all([
            api.get("/followups/grouped").catch(() => ({ data: null })),
            api.get("/tasks").catch(() => ({ data: [] })),
        ]).then(([fuRes, taskRes]) => {
            const calEvents: CalEvent[] = [];
 
            // Follow-ups
            const grouped = fuRes.data;
            if (grouped) {
                const rawFollowups = [
                    ...(grouped.overdue  || []),
                    ...(grouped.dueToday || []),
                    ...(grouped.upcoming || []),
                ];
                const filteredFollowups = currentUser?.role === "sales_rep"
                    ? rawFollowups.filter((fu: any) => {
                        const av = fu.assigned_user;
                        const isAssigned = av && (
                            av === "self" ||
                            av === currentUser.name ||
                            av === currentUser.username ||
                            av === currentUser.email ||
                            av === currentUser._id
                        );
                        const isCreator = fu.created_by === currentUser._id || (fu.created_by && (fu.created_by._id === currentUser._id || fu.created_by === currentUser._id));
                        const isLeadAssignee = fu.lead?.assigned_to === currentUser._id;
                        const isUnassigned = !av || av === "self";
                        return isAssigned || (isUnassigned && (isCreator || isLeadAssignee));
                    })
                    : rawFollowups;

                filteredFollowups.forEach((fu: any) => {
                    calEvents.push({
                        id: fu._id,
                        type: "followup",
                        title: fu.title || fu.lead?.name || "Follow-up",
                        date: new Date(fu.date_time),
                        status: fu.status || "pending",
                        priority: fu.priority,
                        leadId: fu.lead?._id,
                        leadName: fu.lead?.name,
                    });
                });
            }
 
            // Tasks with due dates
            const rawTasks: any[] = taskRes.data || [];
            const filteredTasks = currentUser?.role === "sales_rep"
                ? rawTasks.filter((t: any) => {
                    const assignedId = t.assignedTo?._id || t.assignedTo;
                    return assignedId === currentUser._id;
                })
                : rawTasks;

            filteredTasks.forEach((t: any) => {
                if (!t.dueDate) return;
                calEvents.push({
                    id: t._id,
                    type: "task",
                    title: t.title,
                    date: new Date(t.dueDate),
                    status: t.status,
                    priority: t.priority,
                });
            });
 
            setEvents(calEvents);
        }).finally(() => setLoading(false));
    }, [open, currentUser]);


    // Build calendar grid
    const year  = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (Date | null)[] = [
        ...Array(firstDay).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
    ];
    // Pad to complete last row
    while (cells.length % 7 !== 0) cells.push(null);

    const eventsOnDay = (d: Date) => events.filter(e => sameDay(e.date, d));
    const selectedEvents = eventsOnDay(selectedDate);

    // Dot colours per event type
    const dotStyle = (ev: CalEvent) =>
        ev.type === "followup"
            ? ev.status === "done"
                ? "bg-green-500"
                : isPast(ev.date)
                ? "bg-red-500"
                : "bg-orange-400"
            : ev.status === "completed"
            ? "bg-green-500"
            : isPast(ev.date)
            ? "bg-red-500"
            : "bg-primary";

    return (
        <div ref={ref} className="relative">
            {/* Trigger Button */}
            <button
                id="topbar-calendar-btn"
                onClick={() => setOpen(v => !v)}
                title="Calendar — Follow-ups & Tasks"
                className={`p-2 rounded-xl transition-all duration-200
                    ${open
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
            >
                <CalendarDays size={20} />
            </button>

            {/* Popover */}
            {open && (
                <div className="absolute right-0 top-11 z-50 w-[360px] bg-popover border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* ── Month Header ── */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/80">
                        <button
                            onClick={() => setViewMonth(new Date(year, month - 1, 1))}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ChevronLeft size={15} />
                        </button>
                        <span className="font-bold text-sm text-foreground">
                            {MONTHS[month]} {year}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setViewMonth(new Date(year, month + 1, 1))}
                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <ChevronRight size={15} />
                            </button>
                            <button
                                onClick={() => setOpen(false)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors ml-1"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>

                    {/* ── Day Labels ── */}
                    <div className="grid grid-cols-7 px-3 pt-3 pb-1">
                        {DAYS.map(d => (
                            <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-1">
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* ── Calendar Grid ── */}
                    <div className="grid grid-cols-7 px-3 pb-3 gap-y-0.5">
                        {cells.map((date, i) => {
                            if (!date) return <div key={`e-${i}`} />;
                            const dayEvents = eventsOnDay(date);
                            const selected  = sameDay(date, selectedDate);
                            const today     = isToday(date);
                            const past      = isPast(date);
                            const hasOverdue = dayEvents.some(ev =>
                                (ev.status !== "done" && ev.status !== "completed") && isPast(ev.date)
                            );
                            const hasEvents  = dayEvents.length > 0;

                            return (
                                <button
                                    key={date.toISOString()}
                                    onClick={() => setSelectedDate(date)}
                                    className={`relative flex flex-col items-center py-1.5 rounded-lg transition-all duration-100 group
                                        ${selected
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : today
                                            ? "bg-primary/10 text-primary font-bold"
                                            : past
                                            ? "text-muted-foreground/60"
                                            : "text-foreground hover:bg-accent"
                                        }`}
                                >
                                    <span className="text-[12px] font-semibold leading-none">{date.getDate()}</span>

                                    {/* Event dot row */}
                                    {hasEvents && (
                                        <div className="flex gap-0.5 mt-1">
                                            {dayEvents.slice(0, 3).map(ev => (
                                                <span
                                                    key={ev.id}
                                                    className={`w-1 h-1 rounded-full ${selected ? "bg-primary-foreground/70" : dotStyle(ev)}`}
                                                />
                                            ))}
                                            {dayEvents.length > 3 && (
                                                <span className={`w-1 h-1 rounded-full ${selected ? "bg-primary-foreground/50" : "bg-muted-foreground/40"}`} />
                                            )}
                                        </div>
                                    )}

                                    {/* Overdue ring */}
                                    {hasOverdue && !selected && (
                                        <span className="absolute inset-0 rounded-lg ring-1 ring-red-500/40 pointer-events-none" />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* ── Selected Day Events ── */}
                    <div className="border-t border-border">
                        {/* Day header */}
                        <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30">
                            <span className="text-xs font-bold text-foreground">
                                {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                            </span>
                            {isToday(selectedDate) && (
                                <span className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                    Today
                                </span>
                            )}
                        </div>

                        {/* Events list */}
                        <div className="max-h-52 overflow-y-auto custom-scrollbar">
                            {loading ? (
                                <div className="py-8 text-center text-xs text-muted-foreground animate-pulse">
                                    Loading events…
                                </div>
                            ) : selectedEvents.length === 0 ? (
                                <div className="py-8 text-center">
                                    <CalendarDays size={24} className="mx-auto mb-2 text-muted-foreground/30" />
                                    <p className="text-xs text-muted-foreground">No events scheduled</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border/50">
                                    {selectedEvents.map(ev => {
                                        const isFollowUp = ev.type === "followup";
                                        const isDone = ev.status === "done" || ev.status === "completed";
                                        const isOverdue = isPast(ev.date) && !isDone;

                                        return (
                                            <div
                                                key={ev.id}
                                                className={`flex items-start gap-3 px-4 py-3 hover:bg-accent/40 transition-colors
                                                    ${isDone ? "opacity-60" : ""}`}
                                            >
                                                {/* Icon */}
                                                <div className={`mt-0.5 w-6 h-6 flex items-center justify-center rounded-md shrink-0
                                                    ${isDone
                                                        ? "bg-green-500/10 text-green-500"
                                                        : isOverdue
                                                        ? "bg-red-500/10 text-red-500"
                                                        : isFollowUp
                                                        ? "bg-orange-400/10 text-orange-400"
                                                        : "bg-primary/10 text-primary"
                                                    }`}
                                                >
                                                    {isDone
                                                        ? <CheckCircle2 size={13} />
                                                        : isOverdue
                                                        ? <AlertCircle size={13} />
                                                        : isFollowUp
                                                        ? <Clock size={13} />
                                                        : <CheckSquare size={13} />
                                                    }
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded
                                                            ${isFollowUp
                                                                ? "bg-orange-400/15 text-orange-400"
                                                                : "bg-primary/15 text-primary"
                                                            }`}
                                                        >
                                                            {isFollowUp ? "Follow-up" : "Task"}
                                                        </span>
                                                        {isOverdue && (
                                                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/15 text-red-500">
                                                                Overdue
                                                            </span>
                                                        )}
                                                    </div>

                                                    {isFollowUp && ev.leadId ? (
                                                        <Link
                                                            to={`/lead/${ev.leadId}`}
                                                            onClick={() => setOpen(false)}
                                                            className={`text-xs font-semibold truncate block hover:text-primary transition-colors
                                                                ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}
                                                        >
                                                            {ev.title}
                                                        </Link>
                                                    ) : (
                                                        <p className={`text-xs font-semibold truncate
                                                            ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}
                                                        >
                                                            {ev.title}
                                                        </p>
                                                    )}

                                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                                        {ev.date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                                                        {ev.priority && <span className="ml-1.5 capitalize">· {ev.priority}</span>}
                                                    </p>
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
        </div>
    );
}
