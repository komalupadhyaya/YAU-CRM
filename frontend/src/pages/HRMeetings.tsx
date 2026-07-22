import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import {
    Building2, Plus, Trash2, Clock, Calendar,
    Edit2, X, Search, User as UserIcon,
    Loader2, Users, Mail, FileText,
    AlertTriangle, ChevronDown, Info,
    ChevronLeft, ChevronRight, Video, MapPin, Phone, Copy
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "../context/AuthContext";
import { can } from "../utils/permissions";
import { getESTDateParts, formatDateToESTString, toESTDateTimeString, format24hTimeTo12h, toESTDate } from "../utils/timezoneHelper";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
    meeting_type?: 'online' | 'in_person' | 'phone';
    meeting_link?: string | null;
    zoom_start_url?: string | null;
    location?: string | null;
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
    toESTDate(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

const toLocalDateTimeString = (dateOrStr: string | Date | undefined | null) => {
    return toESTDateTimeString(dateOrStr);
};

function StatusBadge({ status }: { status: Meeting['status'] }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.scheduled;
    return (
        <span className={`w-fit inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
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

function MultiUserPicker({ teamMembers, selected, onChange, placeholder = 'Select attendees...', maxSelection }: {
    teamMembers: TeamMember[];
    selected: TeamMember[];
    onChange: (members: TeamMember[]) => void;
    placeholder?: string;
    maxSelection?: number;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const ref = useRef<HTMLDivElement>(null);

    const isMaxReached = maxSelection !== undefined && selected.length >= maxSelection;

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
    const add = (member: TeamMember) => {
        if (isMaxReached) return;
        onChange([...selected, member]);
        setQuery('');
        if (maxSelection === 1) setOpen(false);
    };

    return (
        <div ref={ref} className="relative">
            <div 
                onClick={() => {
                    if (!isMaxReached) setOpen(true);
                }}
                className={`min-h-[38px] w-full flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-background transition-all
                    ${isMaxReached ? 'opacity-95 cursor-default border-emerald-500/30' : 'hover:border-primary/50 cursor-text'}`}
            >
                {selected.map(m => (
                    <span key={m._id} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                        {m.name}
                        <button type="button" onClick={(e) => { e.stopPropagation(); remove(m._id); }} className="hover:text-destructive transition-colors ml-0.5" title="Remove Host">
                            <X size={10} />
                        </button>
                    </span>
                ))}
                {selected.length === 0 && <span className="text-sm text-muted-foreground">{placeholder}</span>}
                {isMaxReached && (
                    <span className="text-[11px] text-muted-foreground ml-auto font-medium opacity-70">
                        (Host selected — click X to change)
                    </span>
                )}
            </div>
            {open && !isMaxReached && (
                <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-xl shadow-xl overflow-hidden">
                    <div className="p-2 border-b border-border flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/60 flex-1">
                            <Search size={13} className="text-muted-foreground shrink-0" />
                            <input autoFocus type="text" placeholder="Search team members..." value={query}
                                onChange={e => setQuery(e.target.value)}
                                className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground" />
                        </div>
                        {maxSelection === undefined && (
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
                        )}
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

    const isOutsideActiveRange = (date: Date) => {
        if (internalAttendees.length === 0 || !availabilityData) return false;
        const dStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        return internalAttendees.some(attendee => {
            const sched = availabilityData.schedules[attendee._id];
            if (sched && sched.date_range_start && sched.date_range_end) {
                return dStr < sched.date_range_start || dStr > sched.date_range_end;
            }
            return false;
        });
    };

    // Calculate availability details for a given date
    const getDateAvailability = (date: Date) => {
        if (internalAttendees.length === 0) return { status: 'neutral', availableCount: 0 };
        if (!availabilityData) return { status: 'loading', availableCount: 0 };

        const dStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        const est = getESTDateParts(date);
        const dayName = est.weekday;
        let availableCount = 0;

        for (const attendee of internalAttendees) {
            const sched = availabilityData.schedules[attendee._id];
            if (!sched) continue;

            const isBlocked = sched.blocked_dates?.some((bd: string) => {
                return bd.slice(0, 10) === dStr;
            });
            if (isBlocked) continue;

            if (sched.date_range_start && sched.date_range_end) {
                if (dStr < sched.date_range_start || dStr > sched.date_range_end) {
                    continue;
                }
                const override = (sched.custom_schedule || []).find((cs: any) => cs.date === dStr);
                if (override && override.enabled && override.slots && override.slots.length > 0) {
                    availableCount++;
                }
            } else {
                const daySched = sched.weekly_schedule?.[dayName];
                if (daySched?.enabled) {
                    availableCount++;
                }
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
        const dStr = `${selectedDate.getFullYear()}-${(selectedDate.getMonth() + 1).toString().padStart(2, '0')}-${selectedDate.getDate().toString().padStart(2, '0')}`;
        const est = getESTDateParts(selectedDate);
        const dayName = est.weekday;

        // Free intervals list for each attendee
        let attendeeIntervalsList: { start: number; end: number }[][] = [];

        for (const attendee of internalAttendees) {
            const sched = availabilityData.schedules[attendee._id];
            if (!sched) continue;

            const isBlocked = sched.blocked_dates?.some((bd: string) => {
                return bd.slice(0, 10) === dStr;
            });

            if (isBlocked) {
                attendeeIntervalsList.push([]);
                continue;
            }

            let slots: { start: string; end: string }[] = [];
            if (sched.date_range_start && sched.date_range_end) {
                if (dStr < sched.date_range_start || dStr > sched.date_range_end) {
                    attendeeIntervalsList.push([]);
                    continue;
                }
                const override = (sched.custom_schedule || []).find((cs: any) => cs.date === dStr);
                if (override && override.enabled && override.slots && override.slots.length > 0) {
                    slots = override.slots;
                } else {
                    attendeeIntervalsList.push([]);
                    continue;
                }
            } else {
                const daySched = sched.weekly_schedule?.[dayName];
                if (!daySched?.enabled) {
                    attendeeIntervalsList.push([]);
                    continue;
                }

                if (daySched.slots && daySched.slots.length > 0) {
                    slots = daySched.slots;
                } else if (daySched.start && daySched.end) {
                    slots = [{ start: daySched.start, end: daySched.end }];
                } else {
                    slots = [{ start: '09:00', end: '17:00' }];
                }
            }

            let freeIntervals = slots.map(s => ({
                start: timeToMinutes(s.start),
                end: timeToMinutes(s.end)
            }));

            // Subtract existing meetings
            const dateMeetings = availabilityData.meetings.filter(m => {
                const mDate = new Date(m.date_time);
                const sameDay = formatDateToESTString(mDate) === dStr;
                const hasAttendee = m.internal_attendees?.some((uid: any) => 
                    (typeof uid === 'string' ? uid : uid._id) === attendee._id
                );
                return sameDay && hasAttendee;
            });

            for (const m of dateMeetings) {
                const mDate = new Date(m.date_time);
                const mParts = getESTDateParts(mDate);
                const startMin = mParts.hour * 60 + mParts.minute;
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
                const b = toESTDate(bd);
                return b.getFullYear() === selectedDate.getFullYear() &&
                       b.getMonth() === selectedDate.getMonth() &&
                       b.getDate() === selectedDate.getDate();
            });
            if (isBlocked) return { name: attendee.name, status: 'Blocked / Day Off', color: 'text-rose-400' };

            // Find meetings
            const dateMeetings = availabilityData.meetings.filter(m => {
                const mDate = toESTDate(m.date_time);
                const sameDay = mDate.getFullYear() === selectedDate.getFullYear() &&
                                mDate.getMonth() === selectedDate.getMonth() &&
                                mDate.getDate() === selectedDate.getDate();
                const hasAttendee = m.internal_attendees?.some((uid: any) => 
                    (typeof uid === 'string' ? uid : uid._id) === attendee._id
                );
                return sameDay && hasAttendee;
            });

            let hoursText = daySched.slots && daySched.slots.length > 0 
                ? daySched.slots.map((s: any) => `${format24hTimeTo12h(s.start)} - ${format24hTimeTo12h(s.end)}`).join(', ')
                : (daySched.start && daySched.end ? `${format24hTimeTo12h(daySched.start)} - ${format24hTimeTo12h(daySched.end)}` : '9:00 AM - 5:00 PM');

            if (dateMeetings.length > 0) {
                const meetingsList = dateMeetings.map((m: any) => {
                    const mDate = new Date(m.date_time);
                    const startParts = getESTDateParts(mDate);
                    const endParts = getESTDateParts(new Date(mDate.getTime() + m.duration_minutes * 60000));
                    const start12h = minutesToTime(startParts.hour * 60 + startParts.minute);
                    const end12h = minutesToTime(endParts.hour * 60 + endParts.minute);
                    return `"${m.title}" (${start12h} - ${end12h})`;
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
                                    <DateTimePicker
                                        value={manualDateTime}
                                        onChange={setManualDateTime}
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
                                        const outsideRange = isOutsideActiveRange(day);
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
                                        } else if (isPast || outsideRange) {
                                            cellBg = 'bg-zinc-500/5 cursor-not-allowed';
                                            borderCol = 'border-border/40';
                                            textCol = 'text-muted-foreground/40';
                                        }

                                        return (
                                            <button
                                                key={idx}
                                                type="button"
                                                disabled={isPast || !isCurrentMonth || outsideRange}
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
                                                    const mDate = toESTDate(m.date_time);
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
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Available Slots</p>
                                    {selectedDate ? (
                                        timeSlots.length === 0 ? (
                                            <div className="flex-1 flex items-center justify-center text-center p-5 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                                                No Available slots found for this day. Try another date or check attendee schedules.
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
    const [meetingType, setMeetingType] = useState<'online' | 'in_person' | 'phone'>(
        editingMeeting?.meeting_type ?? 'online'
    );
    const [location, setLocation] = useState(editingMeeting?.location ?? '');
    const [force, setForce] = useState(false);

    // Zoom users list fetched from Zoom API
    interface ZoomApiUser {
        email: string;
        display_name: string;
        type: number;
        is_owner?: boolean;
    }
    const [zoomUsersList, setZoomUsersList] = useState<ZoomApiUser[]>([]);
    const [zoomUsersLoaded, setZoomUsersLoaded] = useState(false);

    useEffect(() => {
        if (meetingType !== 'online') return;
        if (zoomUsersLoaded) return; // already fetched
        api.get('/meetings/zoom-users')
            .then(res => {
                const users: ZoomApiUser[] = res.data.users || [];
                setZoomUsersList(users);
            })
            .catch(() => {
                setZoomUsersList([]);
            })
            .finally(() => setZoomUsersLoaded(true));
    }, [meetingType, zoomUsersLoaded]);

    // Build the list of selectable internal attendees when meeting type is online vs in_person/phone
    const selectableAttendees = useMemo(() => {
        if (meetingType !== 'online' || !zoomUsersLoaded || zoomUsersList.length === 0) {
            return teamMembers;
        }

        const result: TeamMember[] = [];
        const addedEmails = new Set<string>();
        const adminCrmUser = teamMembers.find(m => m.role === 'admin') || teamMembers[0];

        // Strictly show only active users present in Zoom User Management
        zoomUsersList.forEach(zUser => {
            const emailLower = (zUser.email || '').toLowerCase();
            if (!emailLower || addedEmails.has(emailLower)) return;

            const matchingCrm = teamMembers.find(m => m.email.toLowerCase() === emailLower);
            if (matchingCrm) {
                result.push(matchingCrm);
                addedEmails.add(emailLower);
            } else {
                // Zoom user not in CRM DB (e.g. Kimberly Shackelford kimberly@thecollegemomboss.com)
                result.push({
                    _id: adminCrmUser?._id || `zoom_${emailLower}`,
                    name: zUser.display_name || (zUser.is_owner ? 'Kimberly Shackelford' : emailLower),
                    email: zUser.email,
                    role: 'admin',
                    isActive: true
                });
                addedEmails.add(emailLower);
            }
        });

        return result;
    }, [meetingType, zoomUsersLoaded, zoomUsersList, teamMembers]);

    // Combined attendees list for Step 5 availability checking (Zoom Host + CC team members for online meetings)
    const allAttendeesForAvailability = useMemo(() => {
        if (meetingType === 'online') {
            const ccMembers: TeamMember[] = [];
            ccEmails.forEach(email => {
                const member = teamMembers.find(m => m.email.toLowerCase() === email.toLowerCase());
                if (member && !internalAttendees.some(ia => ia._id === member._id)) {
                    ccMembers.push(member);
                }
            });
            return [...internalAttendees, ...ccMembers];
        }
        return internalAttendees;
    }, [meetingType, internalAttendees, ccEmails, teamMembers]);

    const [scriptLoaded, setScriptLoaded] = useState(false);
    const [scriptError, setScriptError] = useState(false);
    const addressInputRef = useRef<HTMLInputElement>(null);

    const isEditing = !!editingMeeting;

    useEffect(() => {
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (!apiKey || apiKey === "YOUR_GOOGLE_MAPS_API_KEY") {
            console.warn("VITE_GOOGLE_MAPS_API_KEY is not configured or is using placeholder. Google Places Autocomplete will be disabled.");
            return;
        }
        
        const scriptId = "google-maps-script";
        if (document.getElementById(scriptId)) {
            if ((window as any).google) setScriptLoaded(true);
            return;
        }

        (window as any).onGoogleMapsLoad = () => {
            setScriptLoaded(true);
        };

        const script = document.createElement("script");
        script.id = scriptId;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async&callback=onGoogleMapsLoad`;
        script.async = true;
        script.onerror = () => setScriptError(true);
        document.body.appendChild(script);
    }, []);

    useEffect(() => {
        if (!scriptLoaded || !addressInputRef.current || !(window as any).google) return;

        try {
            const autocomplete = new (window as any).google.maps.places.Autocomplete(addressInputRef.current, {
                types: ["address"],
                fields: ["formatted_address", "geometry"]
            });

            autocomplete.addListener("place_changed", () => {
                const place = autocomplete.getPlace();
                if (place && place.formatted_address) {
                    setLocation(place.formatted_address);
                }
            });
            
            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === "Enter") {
                    const pacContainer = document.querySelector(".pac-container");
                    if (pacContainer && window.getComputedStyle(pacContainer).display !== "none") {
                        e.preventDefault();
                    }
                }
            };
            const currentInput = addressInputRef.current;
            currentInput.addEventListener("keydown", handleKeyDown);
            return () => {
                currentInput.removeEventListener("keydown", handleKeyDown);
            };
        } catch (err) {
            console.error("Failed to initialize Google Places Autocomplete:", err);
        }
    }, [scriptLoaded, meetingType, step]);

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
        setMeetingType(editingMeeting?.meeting_type ?? 'online');
        setLocation(editingMeeting?.location ?? '');
        setStep(1);
    }, [editingMeeting]);

    const canNavigateToStep = (targetStep: number) => {
        if (targetStep === 1) return true;
        if (targetStep === 2 && (!title.trim() || (meetingType === 'in_person' && !location.trim()))) return false;
        if (targetStep === 3 && (!title.trim() || (meetingType === 'in_person' && !location.trim()))) return false;
        if (targetStep === 4 && (!title.trim() || (meetingType === 'in_person' && !location.trim()) || internalAttendees.length === 0)) return false;
        if (targetStep === 5 && (!title.trim() || (meetingType === 'in_person' && !location.trim()) || internalAttendees.length === 0)) return false;
        return true;
    };

    const handleNext = () => {
        if (step === 1) {
            if (!title.trim()) {
                toast.error("Please enter a meeting title.");
                return;
            }
            if (meetingType === 'in_person' && !location.trim()) {
                toast.error("Please enter a meeting address.");
                return;
            }
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
                host_email: internalAttendees[0]?.email || null,
                cc_attendees: [], // CC emails stored in external_emails for HR meetings
                external_emails: ccEmails,
                notes,
                force,
                meeting_type: meetingType,
                location: meetingType === 'in_person' ? location : null,
                ...(isEditing ? { status } : {})
            };

            const res = isEditing
                ? await api.put(`/meetings/${editingMeeting!._id}`, payload)
                : await api.post('/meetings', payload);

            onSuccess(res.data);
            if (!isEditing) {
                setTitle(''); setSelectedCandidates([]); setDateTime(''); setDuration(30);
                setInternalAttendees([]); setCcEmails([]); setNotes(''); setMeetingType('online'); setLocation(''); setStep(1);
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
                    <div className="space-y-3 animate-fadeIn">
                        <div className="space-y-1.5">
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

                        <div className="space-y-1.5">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Meeting Type
                            </span>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setMeetingType('online')}
                                    className={`py-2 px-1 rounded-lg border text-xs font-semibold transition-all duration-150 text-center
                                        ${meetingType === 'online' 
                                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' 
                                            : 'border-border text-muted-foreground hover:bg-accent/50'}`}
                                >
                                    Zoom / Online
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMeetingType('in_person')}
                                    className={`py-2 px-1 rounded-lg border text-xs font-semibold transition-all duration-150 text-center
                                        ${meetingType === 'in_person' 
                                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' 
                                            : 'border-border text-muted-foreground hover:bg-accent/50'}`}
                                >
                                    In-Person
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMeetingType('phone')}
                                    className={`py-2 px-1 rounded-lg border text-xs font-semibold transition-all duration-150 text-center
                                        ${meetingType === 'phone' 
                                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' 
                                            : 'border-border text-muted-foreground hover:bg-accent/50'}`}
                                >
                                    Phone Call
                                </button>
                            </div>
                        </div>

                        {meetingType === 'in_person' && (
                            <div className="space-y-1.5 animate-fadeIn">
                                <label htmlFor="hr-meeting-location" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Meeting Address / Location <span className="text-destructive">*</span>
                                </label>
                                <input
                                    ref={addressInputRef}
                                    id="hr-meeting-location"
                                    name="hr-meeting-location"
                                    type="text"
                                    placeholder="e.g. 123 Main St, New York, NY"
                                    value={location}
                                    onChange={e => setLocation(e.target.value)}
                                    required
                                    className="input-field"
                                />
                            </div>
                        )}
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
                    <div className="space-y-2 animate-fadeIn">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Users size={11} /> {meetingType === 'online' ? 'Zoom Meeting Host' : 'Internal Attendees'} <span className="text-destructive">*</span>
                        </span>

                        {/* Zoom-eligible filter notice */}
                        {meetingType === 'online' && (
                            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-[10px] text-emerald-600 dark:text-emerald-400">
                                <Video size={11} className="shrink-0 mt-0.5" />
                                <span>
                                    Select <strong>1 Zoom Host</strong> for this meeting. Additional team members can be CC'd in <strong>Step 4</strong>.
                                </span>
                            </div>
                        )}

                        <MultiUserPicker
                            teamMembers={selectableAttendees}
                            selected={internalAttendees}
                            onChange={setInternalAttendees}
                            placeholder={meetingType === 'online' ? 'Select 1 Zoom Host...' : 'Select managers/members...'}
                            maxSelection={meetingType === 'online' ? 1 : undefined}
                        />
                        <p className="text-[10px] text-muted-foreground">
                            {meetingType === 'online' ? 'The selected host will run this Zoom meeting.' : 'Select the team members to coordinate schedules.'}
                        </p>
                        {meetingType === 'online' && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400/90 font-medium flex items-center gap-1 mt-1">
                                💡 If your email is not present in the list, please ask the admin to invite you for the Zoom ID from Team Management.
                            </p>
                        )}
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
                        <p className="text-[10px] text-muted-foreground">
                            {meetingType === 'online'
                                ? 'Select team members from the dropdown list to CC on this Zoom meeting notification.'
                                : 'Enter manually or search team member emails to CC on notifications.'}
                        </p>
                    </div>
                )}

                {step === 5 && (
                    <div className="space-y-3 animate-fadeIn">
                        {/* Zoom combined availability notice */}
                        {meetingType === 'online' && allAttendeesForAvailability.length > 1 && (
                            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-[10px] text-emerald-600 dark:text-emerald-400">
                                <Video size={11} className="shrink-0 mt-0.5" />
                                <span>
                                    Checking combined calendar availability for <strong>Zoom Host</strong> ({internalAttendees[0]?.name || 'Host'}) and <strong>{allAttendeesForAvailability.length - 1} CC Team Member(s)</strong>.
                                </span>
                            </div>
                        )}

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
                    <Button key="back-button" type="button" variant="outline" onClick={handleBack} className="flex-1 gap-1 h-9 text-xs">
                        Back
                    </Button>
                ) : isEditing ? (
                    <Button key="cancel-edit-button" type="button" variant="outline" onClick={onCancelEdit} className="flex-1 gap-1 h-9 text-xs">
                        <X size={12} /> Cancel Edit
                    </Button>
                ) : null}

                {step < 5 ? (
                    <Button key="next-button" type="button" onClick={handleNext} className="flex-1 h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                        Next
                    </Button>
                ) : (
                    <Button 
                        key="submit-button"
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
                    internalAttendees={allAttendeesForAvailability}
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
                        {meeting.meeting_type === 'online' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" title={meeting.meeting_link || undefined}>
                                <Video size={9} className="shrink-0" />
                                Online
                            </span>
                        )}
                        {meeting.meeting_type === 'in_person' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20" title={meeting.location || undefined}>
                                <MapPin size={9} className="shrink-0" />
                                In-Person
                            </span>
                        )}
                        {meeting.meeting_type === 'phone' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                <Phone size={9} className="shrink-0" />
                                Phone Call
                            </span>
                        )}
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

// ─── Detail Sheet ─────────────────────────────────────────────────────────────

function MeetingDetailSheet({ 
    meeting, 
    open, 
    onClose, 
    onMeetingUpdated 
}: { 
    meeting: Meeting | null; 
    open: boolean; 
    onClose: () => void;
    onMeetingUpdated: (updatedMeeting: Meeting) => void;
}) {
    if (!meeting) return null;

    const { currentUser } = useAuth();
    const [updatingStatus, setUpdatingStatus] = useState(false);

    const isZoomHost = meeting.internal_attendees?.some((a: any) => {
        const attendeeId = a._id || a;
        const attendeeEmail = a.email || "";
        return attendeeId === currentUser?._id || (attendeeEmail && attendeeEmail.toLowerCase() === currentUser?.email?.toLowerCase());
    });

    const handleStatusChange = async (newStatus: string) => {
        setUpdatingStatus(true);
        try {
            const res = await api.put(`/meetings/${meeting._id}`, { status: newStatus });
            toast.success("Meeting status updated successfully");
            onMeetingUpdated(res.data);
        } catch (err: any) {
            console.error("Failed to update status:", err);
            toast.error(err.response?.data?.error || "Failed to update meeting status");
        } finally {
            setUpdatingStatus(false);
        }
    };

    const cfg = STATUS_CONFIG[meeting.status] || STATUS_CONFIG.scheduled;

    return (
        <Sheet open={open} onOpenChange={onClose}>
            <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
                <SheetHeader className="pb-4 border-b border-border">
                    <SheetTitle className="flex items-center gap-2 text-base">
                        <Building2 size={16} className="text-emerald-400" />{meeting.title}
                    </SheetTitle>
                    <div className="relative inline-block w-fit">
                        {updatingStatus ? (
                            <span className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-full border border-border bg-muted/20 text-muted-foreground">
                                <Loader2 size={10} className="animate-spin text-emerald-500" /> Updating...
                            </span>
                        ) : (
                            <select
                                value={meeting.status}
                                onChange={(e) => handleStatusChange(e.target.value)}
                                className={`appearance-none text-[10px] font-bold tracking-wider px-3.5 py-1.5 pr-8 rounded-full border bg-card cursor-pointer transition-all duration-200 outline-none hover:shadow-sm focus:outline-none focus:ring-0 focus-visible:ring-0 uppercase ${cfg.color} ${cfg.border}`}
                                style={{
                                    backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236B7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                                    backgroundPosition: 'right 0.6rem center',
                                    backgroundSize: '1rem 1rem',
                                    backgroundRepeat: 'no-repeat'
                                }}
                            >
                                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                                    <option key={k} value={k} className="bg-card text-foreground font-semibold normal-case">
                                        {v.label}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
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
                            <p className="text-sm font-medium">{meeting.duration_minutes} minutes</p>
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-sm font-medium">{meeting.created_by?.name || '—'}</p>
                        </div>
                    </div>

                    {/* Location details */}
                    <div className="border-t border-border/60 pt-3 space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Location</p>
                        {meeting.meeting_type === 'online' ? (
                            <div className="flex flex-col gap-2 bg-muted/10 p-3 rounded-xl border border-border/40">
                                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                    <Video size={13} className="text-emerald-500" />
                                    Zoom Meeting
                                </span>
                                {meeting.zoom_start_url || meeting.meeting_link ? (
                                    <div className={`grid gap-3 ${(meeting.zoom_start_url && isZoomHost) && meeting.meeting_link ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                        {/* Host URL */}
                                        {meeting.zoom_start_url && isZoomHost && (
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Host URL (Admin Key)</p>
                                                <div className="flex gap-1.5">
                                                    <a
                                                        href={meeting.zoom_start_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="h-9 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex-1"
                                                    >
                                                        <Video size={13} />
                                                        Start Zoom
                                                    </a>
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(meeting.zoom_start_url!);
                                                            toast.success("Host link copied!");
                                                        }}
                                                        className="w-9 h-9 flex items-center justify-center rounded-lg border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                                        title="Copy Host Link"
                                                    >
                                                        <Copy size={13} />
                                                    </button>
                                                </div>
                                                <p className="text-[9px] text-muted-foreground leading-tight">Starts meeting using master API host key.</p>
                                            </div>
                                        )}
                                        {/* Candidate Join Link */}
                                        {meeting.meeting_link && (
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Join URL (Staff & Candidates)</p>
                                                <div className="flex gap-1.5">
                                                    <a
                                                        href={meeting.meeting_link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="h-9 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-accent text-foreground transition-colors flex-1 text-center"
                                                    >
                                                        Join Zoom
                                                    </a>
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(meeting.meeting_link!);
                                                            toast.success("Candidate link copied!");
                                                        }}
                                                        className="w-9 h-9 flex items-center justify-center rounded-lg border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                                        title="Copy Candidate Link"
                                                    >
                                                        <Copy size={13} />
                                                    </button>
                                                </div>
                                                <p className="text-[9px] text-muted-foreground leading-tight">Joins meeting with your own logged-in profile.</p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <span className="text-xs text-muted-foreground italic">Generating link...</span>
                                )}
                            </div>
                        ) : meeting.meeting_type === 'in_person' ? (
                            <div className="space-y-0.5">
                                <span className="text-xs font-semibold text-foreground">In-Person</span>
                                <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                                    <MapPin size={13} className="text-emerald-500 shrink-0" />
                                    {meeting.location || 'No address specified'}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-0.5">
                                <span className="text-xs font-semibold text-foreground">Phone Call</span>
                                <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                                    <Phone size={13} className="text-emerald-500 shrink-0" />
                                    Phone Interview
                                </p>
                            </div>
                        )}
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

    const handleMeetingUpdated = (updatedMeeting: Meeting) => {
        setMeetings(prev => prev.map(m => m._id === updatedMeeting._id ? updatedMeeting : m));
        setDetailMeeting(updatedMeeting);
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

            <MeetingDetailSheet 
                meeting={detailMeeting} 
                open={!!detailMeeting} 
                onClose={() => setDetailMeeting(null)} 
                onMeetingUpdated={handleMeetingUpdated}
            />

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
