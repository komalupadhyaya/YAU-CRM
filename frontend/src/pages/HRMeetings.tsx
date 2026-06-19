import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import {
    Building2, Plus, Trash2, Clock, Calendar,
    Edit2, X, Search, User as UserIcon,
    Loader2, Users, Mail, FileText,
    AlertTriangle, ChevronDown, Info,
    ChevronLeft, ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "../context/AuthContext";
import { can } from "../utils/permissions";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamMember {
    _id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
}

interface Candidate {
    _id: string;
    name: string;
    email?: string;
    phone?: string;
    applying_for?: string;
    status: string;
}

interface Meeting {
    _id: string;
    title: string;
    category: 'school' | 'hr';
    candidate_id?: { _id: string; name: string; email?: string; phone?: string; applying_for?: string; status?: string } | null;
    candidate_ids?: { _id: string; name: string; email?: string; phone?: string; applying_for?: string; status?: string }[] | null;
    date_time: string;
    duration_minutes: number;
    status: 'scheduled' | 'completed' | 'rescheduled' | 'canceled' | 'no_show';
    internal_attendees: TeamMember[];
    cc_attendees: TeamMember[];
    external_emails: string[];
    notes: string;
    created_by?: { name: string; email: string };
    change_log?: Array<{ action: string; by?: { name: string }; at: string; note: string }>;
    createdAt: string;
}

interface ConflictResult {
    userId: string;
    name: string;
    available: boolean;
    reason: string | null;
}

// ─── Shared Helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG = {
    scheduled:   { label: 'Scheduled',   color: 'text-blue-400',   bg: 'bg-blue-400/10',   border: 'border-blue-400/20' },
    completed:   { label: 'Completed',   color: 'text-green-500',  bg: 'bg-green-500/10',  border: 'border-green-500/20' },
    rescheduled: { label: 'Rescheduled', color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20' },
    canceled:    { label: 'Canceled',    color: 'text-red-500',    bg: 'bg-red-500/10',    border: 'border-red-500/20' },
    no_show:     { label: 'No Show',     color: 'text-zinc-400',   bg: 'bg-zinc-400/10',   border: 'border-zinc-400/20' },
};

const formatDateTime = (d: string) =>
    new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

const toLocalDateTimeString = (dateOrStr: string | Date | undefined | null) => {
    if (!dateOrStr) return '';
    const date = new Date(dateOrStr);
    if (isNaN(date.getTime())) return '';
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function StatusBadge({ status }: { status: Meeting['status'] }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.scheduled;
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
            {cfg.label}
        </span>
    );
}

function AttendeeChip({ member }: { member: TeamMember }) {
    const initials = member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    return (
        <span title={`${member.name} (${member.email})`}
            className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-[9px] flex items-center justify-center border border-emerald-500/20 dark:border-emerald-500/30 ring-2 ring-card shrink-0">
            {initials}
        </span>
    );
}

// ─── Multi-select Attendee Picker ─────────────────────────────────────────────

function MultiUserPicker({ teamMembers, selected, onChange, placeholder = 'Select attendees...' }: {
    teamMembers: TeamMember[];
    selected: TeamMember[];
    onChange: (members: TeamMember[]) => void;
    placeholder?: string;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const ref = useRef<HTMLDivElement>(null);

    const filtered = teamMembers.filter(m =>
        m.isActive &&
        !selected.find(s => s._id === m._id) &&
        (m.name.toLowerCase().includes(query.toLowerCase()) || m.email.toLowerCase().includes(query.toLowerCase()))
    );

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery(''); }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const remove = (id: string) => onChange(selected.filter(m => m._id !== id));
    const add = (member: TeamMember) => { onChange([...selected, member]); setQuery(''); };

    return (
        <div ref={ref} className="relative">
            <div onClick={() => setOpen(true)}
                className="min-h-[38px] w-full flex flex-wrap gap-1.5 px-3 py-2 rounded-lg border border-border hover:border-primary/50 bg-background cursor-text">
                {selected.map(m => (
                    <span key={m._id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
                        {m.name}
                        <button type="button" onClick={(e) => { e.stopPropagation(); remove(m._id); }} className="hover:text-destructive transition-colors">
                            <X size={10} />
                        </button>
                    </span>
                ))}
                {selected.length === 0 && <span className="text-sm text-muted-foreground">{placeholder}</span>}
            </div>
            {open && (
                <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-xl shadow-xl overflow-hidden">
                    <div className="p-2 border-b border-border flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/60 flex-1">
                            <Search size={13} className="text-muted-foreground shrink-0" />
                            <input autoFocus type="text" placeholder="Search team members..." value={query}
                                onChange={e => setQuery(e.target.value)}
                                className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground" />
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            {filtered.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onChange([...selected, ...filtered]);
                                        setQuery('');
                                    }}
                                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-bold shrink-0 px-2 py-1 rounded hover:bg-emerald-500/10 transition-colors"
                                >
                                    Select All
                                </button>
                            )}
                            {selected.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onChange([]);
                                        setQuery('');
                                    }}
                                    className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-bold shrink-0 px-2 py-1 rounded hover:bg-rose-500/10 transition-colors"
                                >
                                    Deselect All
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="max-h-44 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="px-3 py-4 text-center text-sm text-muted-foreground">No members found</div>
                        ) : filtered.map(m => (
                            <button key={m._id} type="button" onClick={() => add(m)}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-accent/50 transition-colors text-left">
                                <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[9px] flex items-center justify-center shrink-0">
                                    {m.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate text-foreground">{m.name}</div>
                                    <div className="text-[11px] text-muted-foreground truncate">{m.email}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Candidate Dropdown ───────────────────────────────────────────────────────

// ─── Multi Candidate Picker ──────────────────────────────────────────────────

function MultiCandidatePicker({ candidates, selected, onChange }: {
    candidates: Candidate[];
    selected: Candidate[];
    onChange: (c: Candidate[]) => void;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
                setQuery('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const selectedIds = new Set(selected.map(c => c._id));
    const filtered = candidates.filter(c =>
        !selectedIds.has(c._id) &&
        (c.name.toLowerCase().includes(query.toLowerCase()) || c.email?.toLowerCase().includes(query.toLowerCase()))
    );

    const add = (candidate: Candidate) => {
        onChange([...selected, candidate]);
        setQuery('');
    };

    const remove = (id: string) => {
        onChange(selected.filter(c => c._id !== id));
    };

    return (
        <div ref={ref} className="relative">
            <div
                onClick={() => setOpen(true)}
                className="min-h-[38px] w-full flex flex-wrap gap-1.5 px-3 py-2 rounded-lg border border-border hover:border-primary/50 bg-background cursor-pointer"
            >
                {selected.map(c => (
                    <span key={c._id} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium border border-emerald-500/20">
                        <UserIcon size={9} />
                        {c.name}
                        {c.applying_for && <span className="opacity-60 text-[9px] ml-0.5">({c.applying_for})</span>}
                        <button type="button" onClick={(e) => { e.stopPropagation(); remove(c._id); }} className="hover:text-destructive transition-colors ml-0.5">
                            <X size={10} />
                        </button>
                    </span>
                ))}
                {selected.length === 0 && (
                    <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <UserIcon size={13} className="text-muted-foreground" />
                        Select candidates...
                    </span>
                )}
                {selected.length > 0 && (
                    <span className="ml-auto self-center">
                        <ChevronDown size={13} className="text-muted-foreground" />
                    </span>
                )}
            </div>

            {open && (
                <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-xl shadow-xl overflow-hidden animate-fadeIn">
                    <div className="p-2 border-b border-border flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/60 flex-1">
                            <Search size={13} className="text-muted-foreground shrink-0" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Search candidates..."
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                            />
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            {filtered.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onChange([...selected, ...filtered]);
                                        setQuery('');
                                    }}
                                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-bold shrink-0 px-2 py-1 rounded hover:bg-emerald-500/10 transition-colors"
                                >
                                    Select All
                                </button>
                            )}
                            {selected.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onChange([]);
                                        setQuery('');
                                    }}
                                    className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-bold shrink-0 px-2 py-1 rounded hover:bg-rose-500/10 transition-colors"
                                >
                                    Deselect All
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                        {filtered.map(c => (
                            <button
                                key={c._id}
                                type="button"
                                onClick={() => add(c)}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-accent/50 transition-colors text-left"
                            >
                                <UserIcon size={12} className="text-muted-foreground shrink-0" />
                                <span className="flex-1 truncate">{c.name}</span>
                                {c.applying_for && <span className="text-[10px] text-muted-foreground shrink-0">{c.applying_for}</span>}
                                <Plus size={12} className="text-emerald-500 shrink-0" />
                            </button>
                        ))}
                        {filtered.length === 0 && (
                            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                                {candidates.length === selected.length ? 'All candidates selected' : 'No candidates found'}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Helpers for calendar math ────────────────────────────────────────────────

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function isSameDate(d1: Date, d2: Date): boolean {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
}

function timeToMinutes(timeStr: string): number {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

function minutesToTime(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function subtractInterval(freeIntervals: { start: number; end: number }[], cStart: number, cEnd: number) {
    const result: { start: number; end: number }[] = [];
    for (const interval of freeIntervals) {
        if (cEnd <= interval.start || cStart >= interval.end) {
            result.push(interval);
        } else {
            if (cStart > interval.start) {
                result.push({ start: interval.start, end: cStart });
            }
            if (cEnd < interval.end) {
                result.push({ start: cEnd, end: interval.end });
            }
        }
    }
    return result;
}

function intersectIntervalLists(listA: { start: number; end: number }[], listB: { start: number; end: number }[]) {
    const result: { start: number; end: number }[] = [];
    for (const a of listA) {
        for (const b of listB) {
            const start = Math.max(a.start, b.start);
            const end = Math.min(a.end, b.end);
            if (start < end) {
                result.push({ start, end });
            }
        }
    }
    return result;
}

// ─── CcEmailPicker Component ──────────────────────────────────────────────────

function CcEmailPicker({
    teamMembers,
    emails,
    onChange
}: {
    teamMembers: TeamMember[];
    emails: string[];
    onChange: (emails: string[]) => void;
}) {
    const [inputValue, setInputValue] = useState("");
    const [open, setOpen] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const filteredMembers = teamMembers.filter(m =>
        m.isActive &&
        !emails.includes(m.email) &&
        (m.name.toLowerCase().includes(inputValue.toLowerCase()) ||
         m.email.toLowerCase().includes(inputValue.toLowerCase()))
    );

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
                addEmailFromInput();
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [inputValue, emails]);

    const addEmailFromInput = () => {
        const trimmed = inputValue.trim().replace(/,$/, "");
        if (!trimmed) return;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(trimmed)) {
            if (!emails.includes(trimmed)) {
                onChange([...emails, trimmed]);
            }
            setInputValue("");
        } else {
            toast.error(`"${trimmed}" is not a valid email address.`);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
            e.preventDefault();
            if (open && filteredMembers.length > 0 && focusedIndex >= 0 && focusedIndex < filteredMembers.length) {
                const selectedMember = filteredMembers[focusedIndex];
                if (!emails.includes(selectedMember.email)) {
                    onChange([...emails, selectedMember.email]);
                }
                setInputValue("");
                setOpen(false);
                setFocusedIndex(-1);
            } else {
                addEmailFromInput();
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!open) {
                setOpen(true);
            } else {
                setFocusedIndex(prev => Math.min(prev + 1, filteredMembers.length - 1));
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocusedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Backspace' && !inputValue && emails.length > 0) {
            onChange(emails.slice(0, -1));
        }
    };

    const removeEmail = (index: number) => {
        onChange(emails.filter((_, i) => i !== index));
    };

    const addEmail = (email: string) => {
        if (!emails.includes(email)) {
            onChange([...emails, email]);
        }
        setInputValue("");
        setOpen(false);
        setFocusedIndex(-1);
        inputRef.current?.focus();
    };

    return (
        <div ref={containerRef} className="relative">
            <div 
                onClick={() => inputRef.current?.focus()}
                className="min-h-[38px] w-full flex flex-wrap items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:border-emerald-500/50 bg-background cursor-text"
            >
                {emails.map((email, idx) => (
                    <span 
                        key={idx} 
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20"
                    >
                        {email}
                        <button 
                            type="button" 
                            onClick={(e) => { e.stopPropagation(); removeEmail(idx); }} 
                            className="hover:text-destructive transition-colors ml-0.5"
                        >
                            <X size={10} />
                        </button>
                    </span>
                ))}
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                        setInputValue(e.target.value);
                        setOpen(true);
                        setFocusedIndex(0);
                    }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder={emails.length === 0 ? "Enter CC emails manually..." : ""}
                    className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground min-w-[150px] py-0.5"
                />
            </div>
            
            {open && inputValue.trim() && filteredMembers.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-xl shadow-xl overflow-hidden max-h-44 overflow-y-auto">
                    {filteredMembers.map((m, idx) => (
                        <button
                            key={m._id}
                            type="button"
                            onClick={() => addEmail(m.email)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors text-left
                                ${focusedIndex === idx ? 'bg-accent/70 text-foreground' : 'hover:bg-accent/50 text-foreground'}`}
                        >
                            <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[9px] flex items-center justify-center shrink-0">
                                {m.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                            </span>
                            <div className="flex-1 min-w-0">
                                <div className="font-medium truncate text-foreground">{m.name}</div>
                                <div className="text-[11px] text-muted-foreground truncate">{m.email}</div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── AvailabilityCalendarModal Component ──────────────────────────────────────

interface AvailabilityCalendarModalProps {
    open: boolean;
    onClose: () => void;
    internalAttendees: TeamMember[];
    duration: number;
    setDuration: (d: number) => void;
    onSelectDateTime: (dateTimeStr: string) => void;
    selectedDateTime: string;
}

function AvailabilityCalendarModal({
    open,
    onClose,
    internalAttendees,
    duration,
    setDuration,
    onSelectDateTime,
    selectedDateTime
}: AvailabilityCalendarModalProps) {
    const [currentMonth, setCurrentMonth] = useState<Date>(() => {
        return selectedDateTime ? new Date(selectedDateTime) : new Date();
    });
    const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
        return selectedDateTime ? new Date(selectedDateTime) : null;
    });
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(() => {
        return selectedDateTime ? new Date(selectedDateTime).toISOString() : null;
    });
    const [availabilityData, setAvailabilityData] = useState<{ schedules: Record<string, any>; meetings: any[] } | null>(null);
    const [loading, setLoading] = useState(false);
    const [calendarMode, setCalendarMode] = useState<'availability' | 'manual'>('availability');
    const [manualDateTime, setManualDateTime] = useState<string>(selectedDateTime || '');

    // Calculate Grid Days
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const startDayOfWeek = firstDayOfMonth.getDay();
    const startOfGrid = new Date(firstDayOfMonth);
    startOfGrid.setDate(startOfGrid.getDate() - startDayOfWeek);

    const endOfMonth = new Date(year, month + 1, 0);
    const endDayOfWeek = endOfMonth.getDay();
    const endOfGrid = new Date(endOfMonth);
    endOfGrid.setDate(endOfGrid.getDate() + (6 - endDayOfWeek));

    const gridDays: Date[] = [];
    let curr = new Date(startOfGrid);
    while (curr <= endOfGrid) {
        gridDays.push(new Date(curr));
        curr.setDate(curr.getDate() + 1);
    }

    const fetchAvailabilityData = useCallback(async () => {
        if (internalAttendees.length === 0) {
            setAvailabilityData(null);
            return;
        }
        setLoading(true);
        try {
            const res = await api.post('/meetings/attendees-availability', {
                attendee_ids: internalAttendees.map(a => a._id),
                start_date: startOfGrid.toISOString(),
                end_date: endOfGrid.toISOString()
            });
            setAvailabilityData(res.data);
        } catch {
            toast.error("Failed to load availability schedules");
        } finally {
            setLoading(false);
        }
    }, [internalAttendees, currentMonth]);

    useEffect(() => {
        if (open) {
            fetchAvailabilityData();
        }
    }, [open, fetchAvailabilityData]);

    const handlePrevMonth = () => {
        setCurrentMonth(new Date(year, month - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(new Date(year, month + 1, 1));
    };

    // Calculate availability details for a given date
    const getDateAvailability = (date: Date) => {
        if (internalAttendees.length === 0) return { status: 'neutral', availableCount: 0 };
        if (!availabilityData) return { status: 'loading', availableCount: 0 };

        const dayName = DAY_NAMES[date.getDay()];
        let availableCount = 0;

        for (const attendee of internalAttendees) {
            const sched = availabilityData.schedules[attendee._id];
            if (!sched) continue;

            const daySched = sched.weekly_schedule?.[dayName];
            if (!daySched?.enabled) continue;

            const isBlocked = sched.blocked_dates?.some((bd: string) => {
                const b = new Date(bd);
                return b.getFullYear() === date.getFullYear() &&
                       b.getMonth() === date.getMonth() &&
                       b.getDate() === date.getDate();
            });

            if (!isBlocked) {
                availableCount++;
            }
        }

        let status = 'busy';
        if (availableCount === internalAttendees.length) {
            status = 'all-free';
        } else if (availableCount > 0) {
            status = 'some-free';
        }

        return { status, availableCount };
    };

    // Calculate free timeslots for selectedDate
    const timeSlots = useMemo(() => {
        if (!selectedDate || !availabilityData || internalAttendees.length === 0) return [];
        const dayName = DAY_NAMES[selectedDate.getDay()];

        // Free intervals list for each attendee
        let attendeeIntervalsList: { start: number; end: number }[][] = [];

        for (const attendee of internalAttendees) {
            const sched = availabilityData.schedules[attendee._id];
            if (!sched) continue;

            const daySched = sched.weekly_schedule?.[dayName];
            if (!daySched?.enabled) {
                attendeeIntervalsList.push([]);
                continue;
            }

            const isBlocked = sched.blocked_dates?.some((bd: string) => {
                const b = new Date(bd);
                return b.getFullYear() === selectedDate.getFullYear() &&
                       b.getMonth() === selectedDate.getMonth() &&
                       b.getDate() === selectedDate.getDate();
            });

            if (isBlocked) {
                attendeeIntervalsList.push([]);
                continue;
            }

            let slots: { start: string; end: string }[] = [];
            if (daySched.slots && daySched.slots.length > 0) {
                slots = daySched.slots;
            } else if (daySched.start && daySched.end) {
                slots = [{ start: daySched.start, end: daySched.end }];
            } else {
                slots = [{ start: '09:00', end: '17:00' }];
            }

            let freeIntervals = slots.map(s => ({
                start: timeToMinutes(s.start),
                end: timeToMinutes(s.end)
            }));

            // Subtract existing meetings
            const dateMeetings = availabilityData.meetings.filter(m => {
                const mDate = new Date(m.date_time);
                const sameDay = mDate.getFullYear() === selectedDate.getFullYear() &&
                                mDate.getMonth() === selectedDate.getMonth() &&
                                mDate.getDate() === selectedDate.getDate();
                const hasAttendee = m.internal_attendees?.some((uid: any) => 
                    (typeof uid === 'string' ? uid : uid._id) === attendee._id
                );
                return sameDay && hasAttendee;
            });

            for (const m of dateMeetings) {
                const mDate = new Date(m.date_time);
                const startMin = mDate.getHours() * 60 + mDate.getMinutes();
                const endMin = startMin + m.duration_minutes;
                freeIntervals = subtractInterval(freeIntervals, startMin, endMin);
            }

            attendeeIntervalsList.push(freeIntervals);
        }

        if (attendeeIntervalsList.length === 0) return [];

        // Pairwise intersection
        let intersection = attendeeIntervalsList[0];
        for (let i = 1; i < attendeeIntervalsList.length; i++) {
            intersection = intersectIntervalLists(intersection, attendeeIntervalsList[i]);
        }

        const slotsList: { label: string; value: string; time: string }[] = [];
        const intervalStep = 30; // standard half-hour steps

        // Generate options between 07:00 and 21:00
        for (let mins = 420; mins <= 1260 - duration; mins += intervalStep) {
            const slotStart = mins;
            const slotEnd = mins + duration;

            const fits = intersection.some(interval => slotStart >= interval.start && slotEnd <= interval.end);
            if (fits) {
                const label = minutesToTime(slotStart);
                const dateCopy = new Date(selectedDate);
                dateCopy.setHours(Math.floor(slotStart / 60), slotStart % 60, 0, 0);

                const hour = Math.floor(slotStart / 60);
                const min = slotStart % 60;
                const ampm = hour >= 12 ? 'PM' : 'AM';
                const displayHour = hour % 12 === 0 ? 12 : hour % 12;
                const displayMin = min.toString().padStart(2, '0');
                const displayTime = `${displayHour}:${displayMin} ${ampm}`;

                slotsList.push({
                    label: displayTime,
                    value: dateCopy.toLocaleString('en-US', { hour12: false }), // We store ISO or date representation
                    time: label
                });
            }
        }

        return slotsList;
    }, [selectedDate, availabilityData, internalAttendees, duration]);

    // Format selected date details for attendee stats list
    const attendeeStatusesForDate = useMemo(() => {
        if (!selectedDate || !availabilityData || internalAttendees.length === 0) return [];
        const dayName = DAY_NAMES[selectedDate.getDay()];

        return internalAttendees.map(attendee => {
            const sched = availabilityData.schedules[attendee._id];
            if (!sched) return { name: attendee.name, status: 'No schedule set', color: 'text-zinc-400' };

            const daySched = sched.weekly_schedule?.[dayName];
            if (!daySched?.enabled) return { name: attendee.name, status: 'Not working today', color: 'text-zinc-400' };

            const isBlocked = sched.blocked_dates?.some((bd: string) => {
                const b = new Date(bd);
                return b.getFullYear() === selectedDate.getFullYear() &&
                       b.getMonth() === selectedDate.getMonth() &&
                       b.getDate() === selectedDate.getDate();
            });
            if (isBlocked) return { name: attendee.name, status: 'Blocked / Day Off', color: 'text-rose-400' };

            // Find meetings
            const dateMeetings = availabilityData.meetings.filter(m => {
                const mDate = new Date(m.date_time);
                const sameDay = mDate.getFullYear() === selectedDate.getFullYear() &&
                                mDate.getMonth() === selectedDate.getMonth() &&
                                mDate.getDate() === selectedDate.getDate();
                const hasAttendee = m.internal_attendees?.some((uid: any) => 
                    (typeof uid === 'string' ? uid : uid._id) === attendee._id
                );
                return sameDay && hasAttendee;
            });

            let hoursText = daySched.slots && daySched.slots.length > 0 
                ? daySched.slots.map((s: any) => `${s.start}-${s.end}`).join(', ')
                : (daySched.start && daySched.end ? `${daySched.start}-${daySched.end}` : '09:00-17:00');

            if (dateMeetings.length > 0) {
                const meetingsList = dateMeetings.map((m: any) => {
                    const mDate = new Date(m.date_time);
                    const sh = mDate.getHours().toString().padStart(2, '0');
                    const sm = mDate.getMinutes().toString().padStart(2, '0');
                    const eh = new Date(mDate.getTime() + m.duration_minutes * 60000).getHours().toString().padStart(2, '0');
                    const em = new Date(mDate.getTime() + m.duration_minutes * 60000).getMinutes().toString().padStart(2, '0');
                    return `"${m.title}" (${sh}:${sm}-${eh}:${em})`;
                }).join(', ');
                return { name: attendee.name, status: `Available ${hoursText} · Busy: ${meetingsList}`, color: 'text-amber-400' };
            }

            return { name: attendee.name, status: `Available (${hoursText})`, color: 'text-emerald-400' };
        });
    }, [selectedDate, availabilityData, internalAttendees]);

    const handleSelectSlot = (val: string) => {
        setSelectedTimeSlot(val);
    };

    const handleConfirm = () => {
        if (calendarMode === 'manual') {
            if (manualDateTime) {
                onSelectDateTime(manualDateTime);
                onClose();
            }
        } else {
            if (selectedTimeSlot) {
                // Convert to input format: YYYY-MM-DDTHH:mm
                const d = new Date(selectedTimeSlot);
                const pad = (n: number) => n.toString().padStart(2, '0');
                const localISOTime = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                onSelectDateTime(localISOTime);
                onClose();
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent 
                aria-describedby={undefined}
                className="max-w-4xl w-[95vw] p-0 overflow-hidden bg-card border border-border rounded-2xl shadow-2xl flex flex-col h-[90vh] md:h-[680px] [color-scheme:light] dark:[color-scheme:dark]"
            >
                <DialogTitle className="sr-only">Choose Date & Time</DialogTitle>
                
                {/* Mode Tab Bar */}
                <div className="flex border-b border-border shrink-0 px-4 pt-4 gap-2">
                    <button
                        type="button"
                        onClick={() => setCalendarMode('availability')}
                        className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-all
                            ${calendarMode === 'availability'
                                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/40'}`}
                    >
                        <Calendar size={12} /> Check Availability
                    </button>
                    <button
                        type="button"
                        onClick={() => setCalendarMode('manual')}
                        className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-all
                            ${calendarMode === 'manual'
                                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/40'}`}
                    >
                        <Clock size={12} /> Pick Manually
                    </button>
                </div>

                {calendarMode === 'manual' ? (
                    /* ── Manual date/time picker panel ── */
                    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
                        <div className="w-full max-w-sm space-y-6">
                            <div className="text-center space-y-1">
                                <h3 className="text-base font-bold text-foreground">Set Date & Time Manually</h3>
                                <p className="text-xs text-muted-foreground">Choose any date and time for the meeting.</p>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                        <Calendar size={11} /> Date & Time <span className="text-destructive">*</span>
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={manualDateTime}
                                        onChange={e => setManualDateTime(e.target.value)}
                                        min={new Date().toISOString().slice(0, 16)}
                                        className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                        <Clock size={11} /> Duration
                                    </label>
                                    <select
                                        value={duration}
                                        onChange={e => setDuration(Number(e.target.value))}
                                        className="w-full h-10 text-sm bg-background border border-border rounded-lg text-foreground px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all"
                                    >
                                        {[15, 30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} minutes</option>)}
                                    </select>
                                </div>

                                {manualDateTime && (
                                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 text-center space-y-0.5">
                                        <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Selected</p>
                                        <p className="text-sm font-bold text-foreground">{formatDateTime(manualDateTime)}</p>
                                        <p className="text-[10px] text-muted-foreground">Duration: {duration} min</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={onClose} className="flex-1 text-xs">
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    disabled={!manualDateTime}
                                    onClick={handleConfirm}
                                    className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                                >
                                    Confirm
                                </Button>
                            </div>

                            <div className="bg-muted/30 border border-border/50 rounded-xl p-3.5 text-center">
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    💡 <strong>Pick Manually</strong> bypasses all automatic availability checks, allowing you to set a custom meeting time regardless of calendar conflicts or team working hours.
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* ── Availability Grid panel ── */
                    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                        {/* Left Side: Calendar Grid */}
                        <div className="flex-1 p-5 flex flex-col justify-between border-b md:border-b-0 md:border-r border-border h-full overflow-hidden">
                            <div>
                                <div className="flex items-center justify-between mb-5">
                                    <h3 className="text-base font-bold text-foreground">
                                        {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                                    </h3>
                                    <div className="flex items-center gap-1.5">
                                        <Button variant="outline" size="sm" className="h-8 w-8 p-0 hover:bg-accent" onClick={handlePrevMonth}>
                                            <ChevronLeft size={15} />
                                        </Button>
                                        <Button variant="outline" size="sm" className="h-8 w-8 p-0 hover:bg-accent" onClick={handleNextMonth}>
                                            <ChevronRight size={15} />
                                        </Button>
                                    </div>
                                </div>

                                {/* Weekday headers */}
                                <div className="grid grid-cols-7 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                    <span>Sun</span>
                                    <span>Mon</span>
                                    <span>Tue</span>
                                    <span>Wed</span>
                                    <span>Thu</span>
                                    <span>Fri</span>
                                    <span>Sat</span>
                                </div>

                                {/* Calendar Day Grid */}
                                <div className="grid grid-cols-7 gap-1.5 relative">
                                    {loading && (
                                        <div className="absolute inset-0 z-10 bg-card/65 backdrop-blur-[2px] flex items-center justify-center">
                                            <Loader2 size={24} className="animate-spin text-emerald-500" />
                                        </div>
                                    )}

                                    {gridDays.map((day, idx) => {
                                        const isCurrentMonth = day.getMonth() === month;
                                        const isSelected = selectedDate && isSameDate(day, selectedDate);
                                        const isToday = isSameDate(day, new Date());
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        const isPast = day < today;
                                        const avail = getDateAvailability(day);
                                        const countText = internalAttendees.length > 0 ? `(${avail.availableCount}/${internalAttendees.length})` : '';

                                        // Determine colors based on availability status
                                        let cellBg = 'bg-background hover:bg-zinc-50 dark:hover:bg-zinc-900/50 cursor-pointer';
                                        let borderCol = 'border-border';
                                        let textCol = 'text-foreground font-medium';

                                        if (internalAttendees.length > 0 && isCurrentMonth) {
                                            if (avail.status === 'all-free') {
                                                cellBg = 'bg-emerald-500/10 hover:bg-emerald-500/20 cursor-pointer';
                                                borderCol = 'border-emerald-500/30';
                                                textCol = 'text-emerald-700 dark:text-emerald-400 font-semibold';
                                            } else if (avail.status === 'some-free') {
                                                cellBg = 'bg-amber-500/10 hover:bg-amber-500/20 cursor-pointer';
                                                borderCol = 'border-amber-500/30';
                                                textCol = 'text-amber-700 dark:text-amber-400 font-semibold';
                                            } else if (avail.status === 'busy') {
                                                cellBg = 'bg-zinc-500/5 hover:bg-zinc-500/10 cursor-pointer';
                                                borderCol = 'border-border/60';
                                                textCol = 'text-muted-foreground/60';
                                            }
                                        }

                                        if (!isCurrentMonth) {
                                            cellBg = 'bg-transparent cursor-not-allowed';
                                            borderCol = 'border-transparent';
                                            textCol = 'text-muted-foreground/15';
                                        } else if (isPast) {
                                            cellBg = 'bg-zinc-500/5 cursor-not-allowed';
                                            borderCol = 'border-border/40';
                                            textCol = 'text-muted-foreground/40';
                                        }

                                        return (
                                            <button
                                                key={idx}
                                                type="button"
                                                disabled={isPast || !isCurrentMonth}
                                                onClick={() => {
                                                    setSelectedDate(day);
                                                    setSelectedTimeSlot(null);
                                                }}
                                                className={`h-14 flex flex-col justify-between p-2 rounded-xl border text-left transition-all relative overflow-hidden group
                                                    ${cellBg} ${borderCol} ${textCol}
                                                    ${isSelected ? 'ring-2 ring-emerald-500 border-transparent scale-95 shadow-sm' : ''}
                                                    ${isToday ? 'border-emerald-600/50 dark:border-emerald-500/50 shadow-sm' : ''}`}
                                            >
                                                <div className="flex justify-between w-full">
                                                    <span className={`text-xs ${isToday ? 'bg-emerald-600 text-white font-bold rounded-full w-5 h-5 flex items-center justify-center' : ''}`}>
                                                        {day.getDate()}
                                                    </span>
                                                    {isCurrentMonth && internalAttendees.length > 0 && (
                                                        <span className="text-[8px] opacity-75 font-semibold leading-none">{countText}</span>
                                                    )}
                                                </div>
                                                {/* Meeting dot indicator if attendee has meeting on that day */}
                                                {availabilityData && availabilityData.meetings.some(m => {
                                                    const mDate = new Date(m.date_time);
                                                    return isSameDate(mDate, day) && m.internal_attendees?.some((uid: any) => 
                                                        internalAttendees.some(a => a._id === (typeof uid === 'string' ? uid : uid._id))
                                                    );
                                                }) && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 self-center mb-0.5"></span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Legend */}
                            <div className="flex gap-4 border-t border-border pt-4 text-[10px] text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded bg-emerald-500/10 border border-emerald-500/20"></span> All Free
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded bg-amber-500/10 border border-amber-500/20"></span> Some Free
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded bg-zinc-500/5 border border-border"></span> Unavailable
                                </div>
                            </div>
                        </div>

                        {/* Right Side: Day Details & Slots */}
                        <div className="w-full md:w-[350px] p-5 flex flex-col justify-between bg-muted/20 h-full overflow-hidden">
                            <div className="flex flex-col h-full overflow-y-auto space-y-4 pr-1">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Selected Date</p>
                                    <h4 className="text-sm font-bold text-foreground mt-0.5">
                                        {selectedDate ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'No date selected'}
                                    </h4>
                                </div>

                                {/* Duration settings */}
                                <div className="space-y-1.5">
                                    <label htmlFor="hr-meeting-duration" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Duration</label>
                                    <select
                                        id="hr-meeting-duration"
                                        name="hr-meeting-duration"
                                        value={duration}
                                        onChange={e => setDuration(Number(e.target.value))}
                                        className="w-full h-8 text-xs bg-background border border-border rounded-lg text-foreground px-2 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                                    >
                                        {[15, 30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} min</option>)}
                                    </select>
                                </div>

                                {/* Attendee Details List */}
                                {selectedDate && internalAttendees.length > 0 && (
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Attendee Schedule Details</p>
                                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                            {attendeeStatusesForDate.map((ast, i) => (
                                                <div key={i} className="text-[11px] leading-tight border-b border-border/40 pb-1.5 last:border-b-0">
                                                    <span className="font-semibold text-foreground block">{ast.name}</span>
                                                    <span className={`${ast.color} text-[10px]`}>{ast.status}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Time slots picker */}
                                <div className="flex-1 flex flex-col min-h-[150px]">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Overlapping Free Slots</p>
                                    {selectedDate ? (
                                        timeSlots.length === 0 ? (
                                            <div className="flex-1 flex items-center justify-center text-center p-5 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                                                No overlapping working slots found for this day. Try another date or check attendee schedules.
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-1.5 max-h-[220px] overflow-y-auto pr-1">
                                                {timeSlots.map(slot => {
                                                    const isSlotSelected = selectedTimeSlot ? new Date(selectedTimeSlot).getTime() === new Date(slot.value).getTime() : false;
                                                    return (
                                                        <button
                                                            key={slot.value}
                                                            type="button"
                                                            onClick={() => handleSelectSlot(slot.value)}
                                                            className={`py-1.5 px-2 text-xs font-semibold rounded-lg text-center transition-all border
                                                                ${isSlotSelected 
                                                                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' 
                                                                    : 'bg-background hover:bg-accent/40 border-border text-foreground'}`}
                                                        >
                                                            {slot.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )
                                    ) : (
                                        <div className="flex-1 flex items-center justify-center text-center text-xs text-muted-foreground">
                                            Select a date from the calendar to view available slots.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="border-t border-border pt-4 flex gap-2 shrink-0">
                                <Button type="button" variant="outline" size="sm" onClick={onClose} className="flex-1 text-xs">
                                    Cancel
                                </Button>
                                <Button 
                                    type="button" 
                                    size="sm" 
                                    disabled={!selectedTimeSlot}
                                    onClick={handleConfirm}
                                    className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                                >
                                    Confirm
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ─── HR Meeting Form ──────────────────────────────────────────────────────────

function HRMeetingForm({ teamMembers, candidates, editingMeeting, onSuccess, onCancelEdit, onCandidateCreated }: {
    teamMembers: TeamMember[];
    candidates: Candidate[];
    editingMeeting: Meeting | null;
    onSuccess: (m: Meeting) => void;
    onCancelEdit: () => void;
    onCandidateCreated: (c: Candidate) => void;
}) {
    const [step, setStep] = useState(1);
    const [title, setTitle] = useState(editingMeeting?.title ?? '');
    const [selectedCandidates, setSelectedCandidates] = useState<Candidate[]>(
        editingMeeting?.candidate_ids && editingMeeting.candidate_ids.length > 0
            ? editingMeeting.candidate_ids.map(c => ({ _id: c._id, name: c.name, status: '', email: c.email, phone: c.phone, applying_for: c.applying_for }))
            : editingMeeting?.candidate_id
                ? [{ _id: editingMeeting.candidate_id._id, name: editingMeeting.candidate_id.name, status: '', email: editingMeeting.candidate_id.email, phone: editingMeeting.candidate_id.phone, applying_for: editingMeeting.candidate_id.applying_for }]
                : []
    );
    const [dateTime, setDateTime] = useState(
        toLocalDateTimeString(editingMeeting?.date_time)
    );
    const [duration, setDuration] = useState(editingMeeting?.duration_minutes ?? 30);
    const [internalAttendees, setInternalAttendees] = useState<TeamMember[]>(editingMeeting?.internal_attendees ?? []);
    
    // We store CC emails as string array
    const [ccEmails, setCcEmails] = useState<string[]>(editingMeeting?.external_emails ?? []);
    
    const [notes, setNotes] = useState(editingMeeting?.notes ?? '');
    const [status, setStatus] = useState<Meeting['status']>(editingMeeting?.status ?? 'scheduled');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [conflicts, setConflicts] = useState<ConflictResult[]>([]);
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [force, setForce] = useState(false);

    const isEditing = !!editingMeeting;

    useEffect(() => {
        setTitle(editingMeeting?.title ?? '');
        setSelectedCandidates(
            editingMeeting?.candidate_ids && editingMeeting.candidate_ids.length > 0
                ? editingMeeting.candidate_ids.map(c => ({ _id: c._id, name: c.name, status: '', email: c.email, phone: c.phone, applying_for: c.applying_for }))
                : editingMeeting?.candidate_id
                    ? [{ _id: editingMeeting.candidate_id._id, name: editingMeeting.candidate_id.name, status: '', email: editingMeeting.candidate_id.email, phone: editingMeeting.candidate_id.phone, applying_for: editingMeeting.candidate_id.applying_for }]
                    : []
        );
        setDateTime(toLocalDateTimeString(editingMeeting?.date_time));
        setDuration(editingMeeting?.duration_minutes ?? 30);
        setInternalAttendees(editingMeeting?.internal_attendees ?? []);
        setCcEmails(editingMeeting?.external_emails ?? []);
        setNotes(editingMeeting?.notes ?? '');
        setStatus(editingMeeting?.status ?? 'scheduled');
        setConflicts([]);
        setForce(false);
        setStep(1);
    }, [editingMeeting]);

    const canNavigateToStep = (targetStep: number) => {
        if (targetStep === 1) return true;
        if (targetStep === 2 && !title.trim()) return false;
        if (targetStep === 3 && !title.trim()) return false;
        if (targetStep === 4 && (!title.trim() || internalAttendees.length === 0)) return false;
        if (targetStep === 5 && (!title.trim() || internalAttendees.length === 0)) return false;
        return true;
    };

    const handleNext = () => {
        if (step === 1 && !title.trim()) {
            toast.error("Please enter a meeting title.");
            return;
        }
        if (step === 3 && internalAttendees.length === 0) {
            toast.error("Please select at least one internal attendee.");
            return;
        }
        if (step < 5) {
            setStep(prev => prev + 1);
        }
    };

    const handleBack = () => {
        if (step > 1) {
            setStep(prev => prev - 1);
        }
    };

    // Reset conflicts and force when date/time, duration, or attendees change
    useEffect(() => {
        setConflicts([]);
        setForce(false);
    }, [dateTime, duration, internalAttendees]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !dateTime) {
            toast.error('Title and Date/Time are required.');
            return;
        }
        setIsSubmitting(true);

        try {
            const payload = {
                title: title.trim(),
                category: 'hr',
                candidate_ids: selectedCandidates.map(c => c._id),
                candidate_id: selectedCandidates[0]?._id || null,
                date_time: dateTime,
                duration_minutes: duration,
                internal_attendees: internalAttendees.map(m => m._id),
                cc_attendees: [], // CC emails stored in external_emails for HR meetings
                external_emails: ccEmails,
                notes,
                force,
                ...(isEditing ? { status } : {})
            };

            const res = isEditing
                ? await api.put(`/meetings/${editingMeeting!._id}`, payload)
                : await api.post('/meetings', payload);

            onSuccess(res.data);
            if (!isEditing) {
                setTitle(''); setSelectedCandidates([]); setDateTime(''); setDuration(30);
                setInternalAttendees([]); setCcEmails([]); setNotes(''); setStep(1);
            }
            setForce(false);
            setConflicts([]);
            toast.success(isEditing ? 'Meeting updated' : 'HR Meeting scheduled');
        } catch (err: any) {
            if (err?.response?.status === 409 && err.response.data?.conflicts) {
                setConflicts(err.response.data.conflicts);
                toast.error('Scheduling conflict detected — see details below.');
            } else {
                toast.error(isEditing ? 'Failed to update meeting' : 'Failed to schedule meeting');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const steps = [
        { number: 1, label: 'Title' },
        { number: 2, label: 'Candidate' },
        { number: 3, label: 'Attendees' },
        { number: 4, label: 'CC' },
        { number: 5, label: 'Schedule' }
    ];

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {conflicts.length > 0 && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 space-y-1.5 animate-fadeIn">
                    <div className="flex items-center gap-2 text-destructive text-sm font-semibold">
                        <AlertTriangle size={14} /> Scheduling Conflict
                    </div>
                    {conflicts.map(c => (
                        <div key={c.userId} className="text-xs text-destructive/80 pl-5">
                            <span className="font-semibold">{c.name}:</span> {c.reason}
                        </div>
                    ))}
                    <label htmlFor="hr-force-schedule" className="flex items-center gap-2 mt-2 pt-1.5 border-t border-destructive/10 text-xs text-destructive font-semibold cursor-pointer select-none">
                        <input
                            id="hr-force-schedule"
                            name="hr-force-schedule"
                            type="checkbox"
                            checked={force}
                            onChange={(e) => setForce(e.target.checked)}
                            className="rounded border-destructive/30 text-destructive focus:ring-destructive"
                        />
                        Ignore conflicts and schedule anyway
                    </label>
                </div>
            )}

            {/* Stepper bar */}
            <div className="flex items-center justify-between border-b border-border pb-3 mb-2">
                {steps.map(s => {
                    const isActive = step === s.number;
                    const isCompleted = step > s.number;
                    const isDisabled = !canNavigateToStep(s.number);
                    return (
                        <button
                            key={s.number}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => setStep(s.number)}
                            className={`flex flex-col items-center gap-1 flex-1 relative
                                ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all
                                ${isActive 
                                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-500/20' 
                                    : isCompleted 
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                        : 'bg-background border border-border text-muted-foreground hover:border-emerald-500/30'}`}>
                                {isCompleted ? '✓' : s.number}
                            </span>
                            <span className={`text-[9px] font-bold uppercase tracking-wider
                                ${isActive ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                                {s.label}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="text-xs font-bold text-emerald-400 uppercase tracking-widest text-center py-1">
                Step {step} of 5 — {steps[step - 1].label}
            </div>

            {/* Step Content */}
            <div className="min-h-[70px] py-1">
                {step === 1 && (
                    <div className="space-y-1.5 animate-fadeIn">
                        <label htmlFor="hr-meeting-title" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Meeting Title <span className="text-destructive">*</span>
                        </label>
                        <input 
                            id="hr-meeting-title"
                            name="hr-meeting-title"
                            type="text" 
                            placeholder="e.g. Coach Interview — John Smith" 
                            value={title}
                            onChange={e => setTitle(e.target.value)} 
                            required 
                            className="input-field" 
                        />
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-1.5 animate-fadeIn">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <UserIcon size={11} /> Candidates
                        </span>
                        <MultiCandidatePicker
                            candidates={candidates}
                            selected={selectedCandidates}
                            onChange={setSelectedCandidates}
                        />
                        <p className="text-[10px] text-muted-foreground">Select single or multiple candidates for this interview meeting (optional).</p>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-1.5 animate-fadeIn">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Users size={11} /> Internal Attendees <span className="text-destructive">*</span>
                        </span>
                        <MultiUserPicker 
                            teamMembers={teamMembers} 
                            selected={internalAttendees} 
                            onChange={setInternalAttendees} 
                            placeholder="Select managers/members..." 
                        />
                        <p className="text-[10px] text-muted-foreground">Select the team members to coordinate schedules.</p>
                    </div>
                )}

                {step === 4 && (
                    <div className="space-y-1.5 animate-fadeIn">
                        <label htmlFor="hr-cc-email-input" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Mail size={11} /> Optional CC Attendees
                        </label>
                        <CcEmailPicker 
                            teamMembers={teamMembers} 
                            emails={ccEmails} 
                            onChange={setCcEmails} 
                        />
                        <p className="text-[10px] text-muted-foreground">Enter manually or search team member emails to CC on notifications.</p>
                    </div>
                )}

                {step === 5 && (
                    <div className="space-y-3 animate-fadeIn">
                        <div className="space-y-1.5">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <Calendar size={11} /> Selected Date & Time
                            </span>
                            
                            {dateTime ? (
                                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Confirmed Slot</span>
                                        <p className="text-xs font-bold text-foreground">{formatDateTime(dateTime)}</p>
                                        <p className="text-[10px] text-muted-foreground">Duration: {duration} minutes</p>
                                    </div>
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => setCalendarOpen(true)} 
                                        className="h-7 text-[10px] px-2.5 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10"
                                    >
                                        Change
                                    </Button>
                                </div>
                            ) : (
                                <div className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-4 text-center space-y-2">
                                    <AlertTriangle className="mx-auto text-rose-400" size={18} />
                                    <div className="space-y-0.5">
                                        <h5 className="text-[11px] font-bold text-foreground uppercase tracking-wider">No Date & Time Selected</h5>
                                        <p className="text-[10px] text-muted-foreground">Open calendar grid to check schedules.</p>
                                    </div>
                                    <Button 
                                        type="button" 
                                        onClick={() => setCalendarOpen(true)} 
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-1.5 h-8 rounded-lg"
                                    >
                                        Pick Date & Time
                                    </Button>
                                </div>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="interview-agenda-prep-questions" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <FileText size={11} /> Notes
                            </label>
                            <textarea 
                                placeholder="Interview agenda, prep questions..." 
                                value={notes}
                                onChange={e => setNotes(e.target.value)} 
                                rows={2} 
                                className="input-field resize-none text-xs" 
                            />
                        </div>

                        {isEditing && (
                            <div className="space-y-1.5">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</span>
                                <div className="grid grid-cols-3 gap-1">
                                    {(Object.keys(STATUS_CONFIG) as Meeting['status'][]).map(s => {
                                        const cfg = STATUS_CONFIG[s];
                                        return (
                                            <button key={s} type="button" onClick={() => setStatus(s)}
                                                className={`py-1 px-1 rounded-lg border text-[10px] font-semibold transition-all duration-150 text-center
                                                    ${status === s ? `${cfg.bg} ${cfg.color} ${cfg.border} shadow-sm` : 'border-border text-muted-foreground hover:bg-accent/50'}`}>
                                                {cfg.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Stepper controls */}
            <div className="flex gap-2 border-t border-border pt-3 mt-2">
                {step > 1 ? (
                    <Button type="button" variant="outline" onClick={handleBack} className="flex-1 gap-1 h-9 text-xs">
                        Back
                    </Button>
                ) : isEditing ? (
                    <Button type="button" variant="outline" onClick={onCancelEdit} className="flex-1 gap-1 h-9 text-xs">
                        <X size={12} /> Cancel Edit
                    </Button>
                ) : null}

                {step < 5 ? (
                    <Button type="button" onClick={handleNext} className="flex-1 h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                        Next
                    </Button>
                ) : (
                    <Button 
                        type="submit" 
                        disabled={isSubmitting || !dateTime}
                        className="flex-1 h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    >
                        {isSubmitting ? <><Loader2 size={12} className="animate-spin" /> Saving...</> :
                            isEditing ? 'Update Meeting' : 'Schedule Meeting'}
                    </Button>
                )}
            </div>

            {/* Popup calendar modal */}
            {calendarOpen && (
                <AvailabilityCalendarModal
                    open={calendarOpen}
                    onClose={() => setCalendarOpen(false)}
                    internalAttendees={internalAttendees}
                    duration={duration}
                    setDuration={setDuration}
                    onSelectDateTime={setDateTime}
                    selectedDateTime={dateTime}
                />
            )}
        </form>
    );
}

// ─── HR Meeting Card ──────────────────────────────────────────────────────────

function HRMeetingCard({ meeting, onEdit, onDelete, onViewDetails, canEdit, canDelete }: {
    meeting: Meeting;
    onEdit: (m: Meeting) => void;
    onDelete: (id: string) => void;
    onViewDetails: (m: Meeting) => void;
    canEdit: boolean;
    canDelete: boolean;
}) {
    const isPast = new Date(meeting.date_time) < new Date();
    return (
        <div onClick={() => onViewDetails(meeting)}
            className={`group relative bg-card border border-l-4 rounded-xl p-3 sm:p-4 transition-all duration-200 cursor-pointer hover:border-emerald-500/40 hover:shadow-sm
                ${meeting.status === 'canceled' ? 'border-l-red-500 opacity-60' : meeting.status === 'completed' ? 'border-l-green-500' : meeting.status === 'rescheduled' ? 'border-l-orange-400' : 'border-l-emerald-500'}
                border-border`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold text-sm leading-snug ${meeting.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {meeting.title}
                    </h3>
                    {((meeting.candidate_ids && meeting.candidate_ids.length > 0) || meeting.candidate_id) && (
                        <div className="flex items-center gap-1.5 mt-1">
                            <div className="flex -space-x-1.5">
                                {(meeting.candidate_ids && meeting.candidate_ids.length > 0
                                    ? meeting.candidate_ids
                                    : [meeting.candidate_id!]
                                ).map((c, idx) => {
                                    const initials = c.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                                    return (
                                        <span
                                            key={c._id}
                                            title={`${c.name}${c.applying_for ? ` (${c.applying_for})` : ''}`}
                                            className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-[8px] flex items-center justify-center border border-emerald-500/20 dark:border-emerald-500/30 ring-1 ring-card shrink-0"
                                            style={{ zIndex: 10 - idx }}
                                        >
                                            {initials}
                                        </span>
                                    );
                                })}
                            </div>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                                {meeting.candidate_ids && meeting.candidate_ids.length > 1
                                    ? `${meeting.candidate_ids.length} Candidates`
                                    : (meeting.candidate_ids?.[0]?.name || meeting.candidate_id?.name)
                                }
                            </span>
                        </div>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <StatusBadge status={meeting.status} />
                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border
                            ${isPast && meeting.status === 'scheduled' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-muted text-muted-foreground border-transparent'}`}>
                            <Calendar size={9} className="shrink-0" />{formatDateTime(meeting.date_time)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Clock size={9} />{meeting.duration_minutes}m
                        </span>
                    </div>
                    {meeting.internal_attendees?.length > 0 && (
                        <div className="flex items-center gap-1 mt-2">
                            <div className="flex -space-x-1.5">
                                {meeting.internal_attendees.slice(0, 5).map(a => <AttendeeChip key={a._id} member={a} />)}
                                {meeting.internal_attendees.length > 5 && (
                                    <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground font-bold text-[9px] flex items-center justify-center ring-1 ring-border">
                                        +{meeting.internal_attendees.length - 5}
                                    </span>
                                )}
                            </div>
                            <span className="text-[10px] text-muted-foreground ml-1">{meeting.internal_attendees.length} attendee{meeting.internal_attendees.length !== 1 ? 's' : ''}</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:transition-opacity">
                    {canEdit && (
                        <button onClick={e => { e.stopPropagation(); onEdit(meeting); }} title="Edit"
                            className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-emerald-400 hover:border-emerald-400/40 hover:bg-emerald-500/10 active:scale-95 transition-all">
                            <Edit2 size={12} />
                        </button>
                    )}
                    {canDelete && (
                        <button onClick={e => { e.stopPropagation(); onDelete(meeting._id); }} title="Delete"
                            className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10 active:scale-95 transition-all">
                            <Trash2 size={12} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Detail Sheet ─────────────────────────────────────────────────────────────

function MeetingDetailSheet({ meeting, open, onClose }: { meeting: Meeting | null; open: boolean; onClose: () => void }) {
    if (!meeting) return null;
    return (
        <Sheet open={open} onOpenChange={onClose}>
            <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
                <SheetHeader className="pb-4 border-b border-border">
                    <SheetTitle className="flex items-center gap-2 text-base">
                        <Building2 size={16} className="text-emerald-400" />{meeting.title}
                    </SheetTitle>
                    <StatusBadge status={meeting.status} />
                </SheetHeader>
                <div className="py-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2 space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                {meeting.candidate_ids && meeting.candidate_ids.length > 1 ? 'Candidates' : 'Candidate'}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {(meeting.candidate_ids && meeting.candidate_ids.length > 0
                                    ? meeting.candidate_ids
                                    : meeting.candidate_id ? [meeting.candidate_id] : []
                                ).map(c => (
                                    <span key={c._id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium border border-emerald-500/20">
                                        <UserIcon size={11} className="shrink-0" />
                                        <span>
                                            {c.name}
                                            {c.applying_for && <span className="opacity-60 text-[10px] ml-1">({c.applying_for})</span>}
                                        </span>
                                    </span>
                                ))}
                                {!meeting.candidate_id && (!meeting.candidate_ids || meeting.candidate_ids.length === 0) && (
                                    <span className="text-sm font-medium text-muted-foreground">—</span>
                                )}
                            </div>
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Date & Time</p>
                            <p className="text-sm font-medium">{formatDateTime(meeting.date_time)}</p>
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Duration</p>
                            <p className="text-sm font-medium">{meeting.duration_minutes} minutes</p>
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Scheduled By</p>
                            <p className="text-sm font-medium">{meeting.created_by?.name || '—'}</p>
                        </div>
                    </div>
                    {meeting.internal_attendees?.length > 0 && (
                        <div className="space-y-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Attendees</p>
                            <div className="space-y-1">
                                {meeting.internal_attendees.map(a => (
                                    <div key={a._id} className="flex items-center gap-2 text-sm">
                                        <AttendeeChip member={a} />
                                        <span className="text-foreground">{a.name}</span>
                                        <span className="text-muted-foreground text-xs">{a.email}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {meeting.external_emails?.length > 0 && (
                        <div className="space-y-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">CC Recipients</p>
                            <div className="flex flex-wrap gap-1.5">
                                {meeting.external_emails.map(e => (
                                    <span key={e} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs border border-border">
                                        <Mail size={9} />{e}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    {meeting.notes && (
                        <div className="space-y-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Notes</p>
                            <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/40 rounded-lg p-3">{meeting.notes}</p>
                        </div>
                    )}
                    {meeting.change_log && meeting.change_log.length > 0 && (
                        <div className="space-y-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Activity Log</p>
                            <div className="space-y-1">
                                {[...meeting.change_log].reverse().map((entry, i) => (
                                    <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                                        <Info size={10} className="mt-0.5 shrink-0 text-emerald-400" />
                                        <span>
                                            <span className="font-medium text-foreground">{entry.by?.name || 'System'}</span>
                                            {' · '}{entry.note}
                                            {' · '}<span className="text-[10px]">{formatDateTime(entry.at)}</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HRMeetings() {
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [detailMeeting, setDetailMeeting] = useState<Meeting | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const { currentUser } = useAuth();
    const permissions = can(currentUser?.role);

    const loadAll = useCallback(async () => {
        try {
            const hasScheduleAccess = currentUser?.role === 'admin' || currentUser?.role === 'manager';
            const [meetingsRes, teamRes, candidatesRes] = await Promise.all([
                api.get('/meetings?category=hr'),
                hasScheduleAccess ? api.get('/team') : Promise.resolve({ data: [] }),
                hasScheduleAccess ? api.get('/meetings/candidates') : Promise.resolve({ data: [] }),
            ]);
            setMeetings(meetingsRes.data);
            setTeamMembers(teamRes.data);
            setCandidates(candidatesRes.data);
        } catch {
            toast.error('Failed to load HR meetings');
        } finally {
            setLoading(false);
        }
    }, [currentUser?.role]);

    useEffect(() => { loadAll(); }, [loadAll]);

    const handleSuccess = (meeting: Meeting) => {
        if (editingMeeting) {
            setMeetings(prev => prev.map(m => m._id === meeting._id ? meeting : m));
            setEditingMeeting(null);
        } else {
            setMeetings(prev => [meeting, ...prev]);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await api.delete(`/meetings/${id}`);
            setMeetings(prev => prev.filter(m => m._id !== id));
            setDeletingId(null);
            toast.success('Meeting deleted');
        } catch {
            toast.error('Failed to delete meeting');
        }
    };

    const filtered = meetings.filter(m => {
        const matchesSearch = !searchQuery ||
            m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.candidate_id?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (m.candidate_ids && m.candidate_ids.some(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())));
        const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const scheduledCount = meetings.filter(m => m.status === 'scheduled' || m.status === 'rescheduled').length;

    return (
        <AppLayout>
            <div className="space-y-6 max-w-6xl mx-auto pb-12">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b pb-5">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5">
                            <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                                <Building2 size={16} className="text-emerald-500" />
                            </span>
                            HR Meetings
                        </h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            Interviews, onboarding, and staffing meetings.
                        </p>
                    </div>
                    {/* Stats */}
                    <div className="flex items-center gap-2 sm:gap-3 sm:pt-1 shrink-0">
                        <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            <Clock size={11} />
                            {scheduledCount} Scheduled
                        </span>
                        <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-full bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                            <Calendar size={11} />
                            {meetings.length} Total
                        </span>
                    </div>
                </div>

                <div className={`grid grid-cols-1 gap-6 lg:gap-8 items-start ${
                    permissions.scheduleMeetings ? 'lg:grid-cols-[340px_1fr]' : ''
                }`}>
                    {/* ── Sidebar: Form ── */}
                    {permissions.scheduleMeetings && (
                        <div className="lg:sticky lg:top-6">
                            <div className="bg-card border rounded-2xl shadow-sm">
                                <div className={`px-4 sm:px-5 py-4 border-b ${editingMeeting ? "bg-emerald-500/5" : ""}`}>
                                    <h2 className="text-sm font-bold flex items-center gap-2">
                                        {editingMeeting ? (
                                            <>
                                                <Edit2 size={15} className="text-emerald-500" />
                                                Edit HR Meeting
                                            </>
                                        ) : (
                                            <>
                                                <Plus size={15} className="text-emerald-500" />
                                                Schedule HR Meeting
                                            </>
                                        )}
                                    </h2>
                                    {editingMeeting && (
                                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                                            Editing: {editingMeeting.title}
                                        </p>
                                    )}
                                </div>
                                <div className="p-4 sm:p-5">
                                    <HRMeetingForm
                                        teamMembers={teamMembers}
                                        candidates={candidates}
                                        editingMeeting={editingMeeting}
                                        onSuccess={handleSuccess}
                                        onCancelEdit={() => setEditingMeeting(null)}
                                        onCandidateCreated={c => setCandidates(prev => [c, ...prev])}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Main Panel: List ── */}
                    <div className="space-y-6">
                        {/* Search and Filters */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            {/* Search */}
                            <div className="relative flex-1">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                                    <Search size={14} />
                                </span>
                                <input
                                    id="hr-search-meetings"
                                    name="hr-search-meetings"
                                    type="text"
                                    placeholder="Search meetings by title or candidate..."
                                    className="input-field pl-9 pr-10 py-2 text-sm dark:bg-card w-full shadow-sm rounded-xl"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
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

                            {/* Status filter */}
                            <select
                                id="hr-meetings-status-filter"
                                name="hr-meetings-status-filter"
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                                className="text-xs px-3 py-2 rounded-xl border border-border bg-card text-foreground shadow-sm h-11 shrink-0"
                            >
                                <option value="all">All Statuses</option>
                                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                                    <option key={k} value={k}>{v.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Meetings list */}
                        <div className="space-y-2.5">
                            {loading ? (
                                <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
                                    <Loader2 size={18} className="animate-spin text-emerald-500" /> Loading HR meetings...
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="p-12 text-center border-2 border-dashed rounded-2xl bg-muted/20 text-muted-foreground text-sm">
                                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-3 mx-auto">
                                        <Building2 size={24} className="text-emerald-400" />
                                    </div>
                                    <p className="font-semibold text-foreground">No HR meetings</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {searchQuery ? "No matching meetings found." : "Schedule your first HR meeting using the form."}
                                    </p>
                                </div>
                            ) : (
                                filtered.map(m => (
                                    <HRMeetingCard
                                        key={m._id}
                                        meeting={m}
                                        onEdit={setEditingMeeting}
                                        onDelete={setDeletingId}
                                        onViewDetails={setDetailMeeting}
                                        canEdit={permissions.scheduleMeetings}
                                        canDelete={permissions.deleteRecords}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <MeetingDetailSheet meeting={detailMeeting} open={!!detailMeeting} onClose={() => setDetailMeeting(null)} />

            <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete HR Meeting</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently delete the meeting and cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deletingId && handleDelete(deletingId)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}
