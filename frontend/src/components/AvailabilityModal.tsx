import { useEffect, useState, useMemo, useCallback } from "react";
import api from "../api/api";
import {
    CalendarDays,
    Loader2,
    X,
    Plus,
    Clock,
    Edit2,
    RotateCcw,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { getESTDateParts, formatDateToESTString } from "../utils/timezoneHelper";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const formatTimeInput = (val: string) => {
    const cleaned = val.replace(/[^0-9:]/g, '');
    const parts = cleaned.split(':');
    if (parts.length > 1) {
        const hours = parts[0].slice(0, 2);
        const minutes = parts[1].slice(0, 2);
        return `${hours}:${minutes}`;
    }
    const digits = cleaned.replace(/:/g, '').slice(0, 4);
    if (digits.length <= 2) {
        return digits;
    } else {
        return `${digits.slice(0, 2)}:${digits.slice(2)}`;
    }
};

const normalizeTimeOnBlur = (val: string): string => {
    if (!val.trim()) return '';
    const cleaned = val.replace(/[^0-9:]/g, '');
    if (!cleaned) return '';
    
    let hours = 9;
    let minutes = 0;
    
    if (cleaned.includes(':')) {
        const [hrPart, minPart] = cleaned.split(':');
        hours = parseInt(hrPart, 10) || 0;
        if (minPart.length === 1) {
            minutes = parseInt(minPart + '0', 10);
        } else {
            minutes = parseInt(minPart, 10) || 0;
        }
    } else {
        if (cleaned.length <= 2) {
            hours = parseInt(cleaned, 10) || 0;
            minutes = 0;
        } else {
            const minStr = cleaned.slice(-2);
            const hrStr = cleaned.slice(0, -2);
            hours = parseInt(hrStr, 10) || 0;
            minutes = parseInt(minStr, 10) || 0;
        }
    }
    
    if (hours > 23) hours = 23;
    if (minutes > 59) minutes = 59;
    
    const hStr = hours.toString().padStart(2, '0');
    const mStr = minutes.toString().padStart(2, '0');
    return `${hStr}:${mStr}`;
};

const formatTimeTo12h = (timeStr: string) => {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    const hours24 = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours24) || isNaN(minutes)) return timeStr;
    const ampm = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 || 12;
    const minStr = minutes.toString().padStart(2, '0');
    return `${hours12}:${minStr} ${ampm}`;
};

const split12hTime = (timeStr12h: string): { hour: string; minute: string; period: 'AM' | 'PM' } => {
    const defaultVal = { hour: '09', minute: '00', period: 'AM' as const };
    if (!timeStr12h) return defaultVal;
    
    const parts = timeStr12h.trim().split(/\s+/);
    if (parts.length < 2) {
        const clean = timeStr12h.toUpperCase();
        const period = clean.endsWith('PM') || clean.includes('PM') ? 'PM' : 'AM';
        const timePart = clean.replace(/[A-Z\s]/g, '');
        const subParts = timePart.split(':');
        if (subParts.length < 2) return defaultVal;
        let hr = parseInt(subParts[0], 10);
        let min = parseInt(subParts[1], 10);
        if (isNaN(hr) || hr < 1 || hr > 12) hr = 9;
        if (isNaN(min) || min < 0 || min > 59) min = 0;
        
        min = Math.round(min / 5) * 5;
        if (min >= 60) min = 55;
        
        const hourStr = hr.toString().padStart(2, '0');
        const minStr = min.toString().padStart(2, '0');
        return { hour: hourStr, minute: minStr, period };
    }
    
    const timePart = parts[0];
    const period = parts[1].toUpperCase() === 'PM' ? 'PM' : 'AM';
    const subParts = timePart.split(':');
    if (subParts.length < 2) return defaultVal;
    
    let hr = parseInt(subParts[0], 10);
    let min = parseInt(subParts[1], 10);
    if (isNaN(hr) || hr < 1 || hr > 12) hr = 9;
    if (isNaN(min) || min < 0 || min > 59) min = 0;
    
    min = Math.round(min / 5) * 5;
    if (min >= 60) min = 55;
    
    const hourStr = hr.toString().padStart(2, '0');
    const minStr = min.toString().padStart(2, '0');
    
    return { hour: hourStr, minute: minStr, period };
};

const parseTimeTo24h = (val: string): string => {
    if (!val.trim()) return '';
    
    let clean = val.trim().toUpperCase();
    
    // Check AM / PM
    const isPM = clean.endsWith('PM') || clean.includes('PM');
    const isAM = clean.endsWith('AM') || clean.includes('AM');
    
    clean = clean.replace(/[A-Z\s]/g, '');
    
    if (!clean) return '';
    
    let hours = 9;
    let minutes = 0;
    
    if (clean.includes(':')) {
        const [hrPart, minPart] = clean.split(':');
        hours = parseInt(hrPart, 10) || 0;
        minutes = parseInt(minPart, 10) || 0;
    } else {
        if (clean.length <= 2) {
            hours = parseInt(clean, 10) || 0;
            minutes = 0;
        } else {
            const minStr = clean.slice(-2);
            const hrStr = clean.slice(0, -2);
            hours = parseInt(hrStr, 10) || 0;
            minutes = parseInt(minStr, 10) || 0;
        }
    }
    
    if (isPM && hours < 12) {
        hours += 12;
    } else if (isAM && hours === 12) {
        hours = 0;
    }
    
    if (hours > 23) hours = 23;
    if (minutes > 59) minutes = 59;
    
    const hStr = hours.toString().padStart(2, '0');
    const mStr = minutes.toString().padStart(2, '0');
    return `${hStr}:${mStr}`;
};

const TIME_OPTIONS = [
    "12:00 AM", "12:30 AM", "1:00 AM", "1:30 AM", "2:00 AM", "2:30 AM", "3:00 AM", "3:30 AM", "4:00 AM", "4:30 AM", "5:00 AM", "5:30 AM", "6:00 AM", "6:30 AM", "7:00 AM", "7:30 AM", "8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
    "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM", "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM", "8:00 PM", "8:30 PM", "9:00 PM", "9:30 PM", "10:00 PM", "10:30 PM", "11:00 PM", "11:30 PM"
];

const getValidTimeValue = (val: string): string => {
    const regex = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;
    return regex.test(val) ? val : "";
};

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
type Day = typeof DAYS[number];

interface TimeSlot {
    start: string;
    end: string;
}

interface CustomDayOverride {
    date: string;
    enabled: boolean;
    slots: TimeSlot[];
}

interface DaySchedule {
    enabled: boolean;
    slots: TimeSlot[];
}

interface WeeklySchedule {
    monday: DaySchedule;
    tuesday: DaySchedule;
    wednesday: DaySchedule;
    thursday: DaySchedule;
    friday: DaySchedule;
    saturday: DaySchedule;
    sunday: DaySchedule;
}

export interface AvailabilityUser {
    _id: string;
    name?: string;
    username: string;
}

const defaultDaySchedule = (): DaySchedule => ({ enabled: false, slots: [] });
const defaultSchedule = (): WeeklySchedule => DAYS.reduce((acc, d) => ({ ...acc, [d]: defaultDaySchedule() }), {} as WeeklySchedule);

interface TimePickerPopoverProps {
    tempText: string;
    setTempText: (val: string) => void;
    onConfirm: () => void;
    onCancel: () => void;
}

function TimePickerPopover({ tempText, setTempText, onConfirm, onCancel }: TimePickerPopoverProps) {
    const [openHour, setOpenHour] = useState(false);
    const [openMin, setOpenMin] = useState(false);
    const [openPeriod, setOpenPeriod] = useState(false);
    
    const parsed = split12hTime(tempText);
    
    const hours = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
    const minutes = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];
    const periods = ["AM", "PM"];

    return (
        <div
            className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-popover border border-border/80 rounded-xl shadow-xl z-50 p-3 min-w-[220px] flex flex-col gap-2"
            onMouseDown={e => e.preventDefault()}
        >
            <div className="text-center text-xs font-bold py-1 border-b border-border text-foreground flex flex-col gap-0.5">
                <span className="text-[9px] font-normal text-muted-foreground uppercase tracking-wider">Selected Time</span>
                <span className="text-sm font-black text-primary">{tempText}</span>
            </div>
            
            <div className="flex gap-2 justify-center">
                {/* Hour Selector */}
                <div className="relative flex flex-col gap-1 text-center flex-1">
                    <span className="text-[9px] font-semibold text-muted-foreground uppercase">Hour</span>
                    <button
                        type="button"
                        onClick={() => {
                            setOpenHour(!openHour);
                            setOpenMin(false);
                            setOpenPeriod(false);
                        }}
                        className="w-full flex items-center justify-between bg-background text-foreground border border-border text-xs rounded-lg px-2 py-1 font-bold focus:outline-none h-8 transition-colors hover:border-primary/50"
                    >
                        <span>{parsed.hour}</span>
                        <ChevronDown size={11} className="text-muted-foreground shrink-0 ml-0.5" />
                    </button>
                    {openHour && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border/80 rounded-lg shadow-xl max-h-36 overflow-y-auto z-50 py-1 custom-scrollbar">
                            {hours.map(h => (
                                <button
                                    key={h}
                                    type="button"
                                    onClick={() => {
                                        setTempText(`${h}:${parsed.minute} ${parsed.period}`);
                                        setOpenHour(false);
                                    }}
                                    className={`w-full text-center px-1.5 py-1 text-xs hover:bg-muted text-foreground transition-colors ${parsed.hour === h ? 'bg-primary/10 text-primary font-bold' : ''}`}
                                >
                                    {h}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Minute Selector */}
                <div className="relative flex flex-col gap-1 text-center flex-1">
                    <span className="text-[9px] font-semibold text-muted-foreground uppercase">Min</span>
                    <button
                        type="button"
                        onClick={() => {
                            setOpenMin(!openMin);
                            setOpenHour(false);
                            setOpenPeriod(false);
                        }}
                        className="w-full flex items-center justify-between bg-background text-foreground border border-border text-xs rounded-lg px-2 py-1 font-bold focus:outline-none h-8 transition-colors hover:border-primary/50"
                    >
                        <span>{parsed.minute}</span>
                        <ChevronDown size={11} className="text-muted-foreground shrink-0 ml-0.5" />
                    </button>
                    {openMin && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border/80 rounded-lg shadow-xl max-h-36 overflow-y-auto z-50 py-1 custom-scrollbar">
                            {minutes.map(m => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => {
                                        setTempText(`${parsed.hour}:${m} ${parsed.period}`);
                                        setOpenMin(false);
                                    }}
                                    className={`w-full text-center px-1.5 py-1 text-xs hover:bg-muted text-foreground transition-colors ${parsed.minute === m ? 'bg-primary/10 text-primary font-bold' : ''}`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* AM/PM Selector */}
                <div className="relative flex flex-col gap-1 text-center flex-1">
                    <span className="text-[9px] font-semibold text-muted-foreground uppercase">AM/PM</span>
                    <button
                        type="button"
                        onClick={() => {
                            setOpenPeriod(!openPeriod);
                            setOpenHour(false);
                            setOpenMin(false);
                        }}
                        className="w-full flex items-center justify-between bg-background text-foreground border border-border text-xs rounded-lg px-2 py-1 font-bold focus:outline-none h-8 transition-colors hover:border-primary/50"
                    >
                        <span>{parsed.period}</span>
                        <ChevronDown size={11} className="text-muted-foreground shrink-0 ml-0.5" />
                    </button>
                    {openPeriod && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border/80 rounded-lg shadow-xl z-50 py-1">
                            {periods.map(p => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => {
                                        setTempText(`${parsed.hour}:${parsed.minute} ${p}`);
                                        setOpenPeriod(false);
                                    }}
                                    className={`w-full text-center px-1.5 py-1 text-xs hover:bg-muted text-foreground transition-colors ${parsed.period === p ? 'bg-primary/10 text-primary font-bold' : ''}`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            
            <div className="flex gap-1.5 pt-1.5 border-t border-border mt-1">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 text-[10px] font-bold py-1 px-2 border border-border hover:bg-muted text-muted-foreground rounded transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={onConfirm}
                    className="flex-1 text-[10px] font-bold py-1 px-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded transition-colors"
                >
                    Confirm
                </button>
            </div>
        </div>
    );
}

export default function AvailabilityModal({ user, open, onClose }: { user: AvailabilityUser | null; open: boolean; onClose: () => void }) {
    const [schedule, setSchedule] = useState<WeeklySchedule>(defaultSchedule());
    const [blockedDates, setBlockedDates] = useState<string[]>([]); // ISO date strings
    const [newBlockedDate, setNewBlockedDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [activeInput, setActiveInput] = useState<{ type: 'calendar_override' | 'weekly'; day?: Day; index: number; field: 'start' | 'end' } | null>(null);
    const [tempText, setTempText] = useState<string>('');

    // Date range & custom day overrides (stored locally, processed in EST)
    const [dateRangeStart, setDateRangeStart] = useState<string>('');
    const [dateRangeEnd, setDateRangeEnd] = useState<string>('');
    const [customDays, setCustomDays] = useState<CustomDayOverride[]>([]);
    const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());
    const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(() => {
        return formatDateToESTString(new Date());
    }); 

    const DEFAULT_SLOTS = [{ start: '09:00', end: '17:00' }];

    const optionsToRender = useMemo(() => {
        if (!tempText.trim()) return TIME_OPTIONS;
        const cleanText = tempText.replace(/[\s:]/g, '').toLowerCase();
        
        const matches = TIME_OPTIONS.filter(opt => {
            const cleanOpt = opt.replace(/[\s:]/g, '').toLowerCase();
            return cleanOpt.includes(cleanText);
        });
        return matches.length > 0 ? matches : TIME_OPTIONS;
    }, [tempText]);

    const updateCustomDaysForWeekday = useCallback((day: Day, enabled: boolean, slots: TimeSlot[]) => {
        if (!dateRangeStart || !dateRangeEnd) return;
        
        if (enabled) {
            setCustomDays(prev => {
                const updated = [...prev];
                const start = new Date(dateRangeStart + 'T12:00:00');
                const end = new Date(dateRangeEnd + 'T12:00:00');
                const current = new Date(start);
                while (current <= end) {
                    const dStr = formatDateToESTString(current);
                    const est = getESTDateParts(current);
                    if (est.weekday === day) {
                        if (!updated.some(cd => cd.date === dStr)) {
                            updated.push({
                                date: dStr,
                                enabled: true,
                                slots: slots.map(s => ({ ...s }))
                            });
                        }
                    }
                    current.setDate(current.getDate() + 1);
                }
                return updated.sort((a, b) => a.date.localeCompare(b.date));
            });
        } else {
            setCustomDays(prev => {
                return prev.filter(cd => {
                    const parts = cd.date.split('-');
                    const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                    const est = getESTDateParts(dateObj);
                    return est.weekday !== day;
                });
            });
        }
    }, [dateRangeStart, dateRangeEnd]);

    useEffect(() => {
        if (!activeInput) return;
        const handleOutsideClick = (e: MouseEvent) => {
            const targetId = activeInput.type === 'weekly' 
                ? `weekly-${activeInput.day}-${activeInput.field}-${activeInput.index}`
                : `caloverride-${activeInput.field}-${activeInput.index}`;
            const inputEl = document.getElementById(targetId);
            const container = inputEl?.parentElement;
            if (container && !container.contains(e.target as Node)) {
                const targetTagName = (e.target as HTMLElement).tagName;
                if (targetTagName === "OPTION" || targetTagName === "SELECT") {
                    return;
                }
                
                const normalized = parseTimeTo24h(tempText);
                if (getValidTimeValue(normalized)) {
                    if (activeInput.type === 'weekly' && activeInput.day) {
                        const day = activeInput.day;
                        const idx = activeInput.index;
                        const field = activeInput.field;
                        setSchedule(prev => {
                            const slots = prev[day].slots.map((s, i) => i === idx ? { ...s, [field]: normalized } : s);
                            return { ...prev, [day]: { ...prev[day], slots } };
                        });
                        
                        // Also update customDays of this weekday to match the new slot time
                        setCustomDays(prev => {
                            return prev.map(cd => {
                                const parts = cd.date.split('-');
                                const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                                const est = getESTDateParts(dateObj);
                                if (est.weekday === day) {
                                    const slots = cd.slots.map((s, i) => i === idx ? { ...s, [field]: normalized } : s);
                                    return { ...cd, slots };
                                }
                                return cd;
                            });
                        });
                    } else if (activeInput.type === 'calendar_override') {
                        updateCalendarOverrideSlot(activeInput.index, activeInput.field, normalized);
                    }
                }
                setActiveInput(null);
            }
        };
        document.addEventListener("mousedown", handleOutsideClick);
        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
        };
    }, [activeInput, tempText, customDays, selectedCalendarDate]);

    // Sync date range and weekly schedule changes with customDays
    useEffect(() => {
        if (!dateRangeStart || !dateRangeEnd) return;
        setCustomDays(prev => {
            // 1. Filter out days outside of the range or belonging to disabled weekdays
            let updated = prev.filter(cd => {
                if (!isWithinRange(cd.date, dateRangeStart, dateRangeEnd)) return false;
                const parts = cd.date.split('-');
                const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                const est = getESTDateParts(dateObj);
                const wDay = est.weekday as Day;
                return schedule[wDay]?.enabled;
            });
            
            // 2. Add missing dates matching enabled weekdays in the new range
            const start = new Date(dateRangeStart + 'T12:00:00');
            const end = new Date(dateRangeEnd + 'T12:00:00');
            const current = new Date(start);
            while (current <= end) {
                const dStr = formatDateToESTString(current);
                const est = getESTDateParts(current);
                const wDay = est.weekday as Day;
                const weeklySched = schedule[wDay];
                
                if (weeklySched && weeklySched.enabled && weeklySched.slots && weeklySched.slots.length > 0) {
                    if (!updated.some(cd => cd.date === dStr)) {
                        updated.push({
                            date: dStr,
                            enabled: true,
                            slots: weeklySched.slots.map(s => ({ ...s }))
                        });
                    }
                }
                current.setDate(current.getDate() + 1);
            }
            return updated.sort((a, b) => a.date.localeCompare(b.date));
        });
    }, [dateRangeStart, dateRangeEnd, schedule]);

    useEffect(() => {
        if (!user || !open) return;
        setLoading(true);
        api.get(`/availability/${user._id}`)
            .then(res => {
                const avail = res.data;
                const sched: WeeklySchedule = defaultSchedule();

                DAYS.forEach(d => {
                    if (avail.weekly_schedule?.[d]) {
                        const dayData = avail.weekly_schedule[d];
                        let slots: TimeSlot[] = [];
                        
                        if (dayData.slots && dayData.slots.length > 0) {
                            slots = dayData.slots.map((s: any) => ({
                                start: s.start || '09:00',
                                end: s.end || '17:00'
                            }));
                        } else if (dayData.start && dayData.end) {
                            slots = [{ start: dayData.start, end: dayData.end }];
                        }

                        sched[d] = {
                            enabled: dayData.enabled ?? false,
                            slots
                        };
                    }
                });
                
                setSchedule(sched);
                setBlockedDates((avail.blocked_dates || []).map((d: string) => new Date(d).toISOString().slice(0, 10)));
                
                // Load range & overrides from database (or local storage fallback)
                let startVal = avail.date_range_start || '';
                let endVal = avail.date_range_end || '';
                let loadedCustomDays: CustomDayOverride[] = [];

                if (avail.custom_schedule && avail.custom_schedule.length > 0) {
                    loadedCustomDays = avail.custom_schedule.map((cs: any) => ({
                        date: cs.date,
                        enabled: cs.enabled ?? false,
                        slots: (cs.slots || []).map((s: any) => ({ start: s.start, end: s.end }))
                    }));
                } else {
                    const rangeStr = localStorage.getItem(`availability_range_${user._id}`);
                    if (rangeStr) {
                        try {
                            const parsedRange = JSON.parse(rangeStr);
                            if (!startVal) startVal = parsedRange.start || '';
                            if (!endVal) endVal = parsedRange.end || '';
                        } catch {
                            // ignore
                        }
                    }
                    
                    const customStr = localStorage.getItem(`availability_custom_${user._id}`);
                    if (customStr) {
                        try {
                            loadedCustomDays = JSON.parse(customStr) || [];
                        } catch {
                            // ignore
                        }
                    }
                }

                setDateRangeStart(startVal);
                setDateRangeEnd(endVal);
                
                // If loadedCustomDays is empty but we have a range and weekly schedule in DB, pre-populate it
                if (loadedCustomDays.length === 0 && startVal && endVal) {
                    const start = new Date(startVal + 'T12:00:00');
                    const end = new Date(endVal + 'T12:00:00');
                    const current = new Date(start);
                    while (current <= end) {
                        const dStr = formatDateToESTString(current);
                        const est = getESTDateParts(current);
                        const wDay = est.weekday as Day;
                        const weeklySched = sched[wDay];
                        if (weeklySched && weeklySched.enabled && weeklySched.slots && weeklySched.slots.length > 0) {
                            loadedCustomDays.push({
                                date: dStr,
                                enabled: true,
                                slots: weeklySched.slots.map(s => ({ ...s }))
                            });
                        }
                        current.setDate(current.getDate() + 1);
                    }
                }
                setCustomDays(loadedCustomDays);
            })
            .catch(() => { 
                setSchedule(defaultSchedule()); 
                setBlockedDates([]); 
                setDateRangeStart('');
                setDateRangeEnd('');
                setCustomDays([]);
            })
            .finally(() => setLoading(false));
    }, [user, open]);

    const updateCalendarOverrideSlot = (index: number, field: 'start' | 'end', value: string) => {
        setCustomDays(prev => {
            return prev.map(cd => {
                if (cd.date === selectedCalendarDate) {
                    const slots = cd.slots.map((s, i) => i === index ? { ...s, [field]: value } : s);
                    return { ...cd, slots };
                }
                return cd;
            });
        });
    };

    const addCalendarOverrideSlot = () => {
        setCustomDays(prev => {
            return prev.map(cd => {
                if (cd.date === selectedCalendarDate) {
                    return { ...cd, slots: [...cd.slots, { start: '09:00', end: '17:00' }] };
                }
                return cd;
            });
        });
    };

    const removeCalendarOverrideSlot = (index: number) => {
        setCustomDays(prev => {
            return prev.map(cd => {
                if (cd.date === selectedCalendarDate) {
                    const slots = cd.slots.filter((_, i) => i !== index);
                    return { ...cd, slots };
                }
                return cd;
            });
        });
    };

    const toggleCalendarOverride = (checked: boolean) => {
        if (checked) {
            setCustomDays(prev => {
                if (prev.some(cd => cd.date === selectedCalendarDate)) return prev;
                return [...prev, { date: selectedCalendarDate, enabled: true, slots: DEFAULT_SLOTS.map(s => ({ ...s })) }];
            });
        } else {
            setCustomDays(prev => prev.filter(cd => cd.date !== selectedCalendarDate));
        }
    };

    const toggleCalendarOverrideEnabled = (enabled: boolean) => {
        setCustomDays(prev => {
            return prev.map(cd => {
                if (cd.date === selectedCalendarDate) {
                    return {
                        ...cd,
                        enabled,
                        slots: enabled ? (cd.slots.length > 0 ? cd.slots : DEFAULT_SLOTS.map(s => ({ ...s }))) : []
                    };
                }
                return cd;
            });
        });
    };

    const isWithinRange = (dateStr: string, start: string, end: string) => {
        if (start && dateStr < start) return false;
        if (end && dateStr > end) return false;
        return true;
    };

    const addBlockedDate = () => {
        if (!newBlockedDate || blockedDates.includes(newBlockedDate)) return;
        setBlockedDates(prev => [...prev, newBlockedDate].sort());
        if (newBlockedDate === selectedCalendarDate) {
            setSelectedCalendarDate(dateRangeStart || '');
        }
        setNewBlockedDate('');
    };

    const removeBlockedDate = (date: string) => setBlockedDates(prev => prev.filter(d => d !== date));

    const handleSave = async () => {
        if (!user) return;

        // Validation:
        if (dateRangeStart && dateRangeEnd && dateRangeStart > dateRangeEnd) {
            toast.error('Start Date cannot be after End Date.');
            return;
        }

        // Validate weekly schedule slots
        for (const day of DAYS) {
            const daySched = schedule[day];
            if (daySched.enabled) {
                if (!daySched.slots || daySched.slots.length === 0) {
                    toast.error(`Please add at least one time slot for ${day.charAt(0).toUpperCase() + day.slice(1)}.`);
                    return;
                }
                for (let i = 0; i < daySched.slots.length; i++) {
                    const slot = daySched.slots[i];
                    if (!slot.start || !slot.end) {
                        toast.error(`Please fill both start and end times for all slots on ${day.charAt(0).toUpperCase() + day.slice(1)}.`);
                        return;
                    }
                    if (slot.start >= slot.end) {
                        toast.error(`Start time must be before end time for slot ${i + 1} on ${day.charAt(0).toUpperCase() + day.slice(1)}.`);
                        return;
                    }
                }
            }
        }

        // Validate custom overrides directly
        for (const cd of customDays) {
            if (cd.enabled) {
                if (!cd.slots || cd.slots.length === 0) {
                    toast.error(`Please add at least one time slot for customized date ${cd.date}.`);
                    return;
                }
                for (let i = 0; i < cd.slots.length; i++) {
                    const slot = cd.slots[i];
                    if (!slot.start || !slot.end) {
                        toast.error(`Please fill both start and end times for all slots on customized date ${cd.date}.`);
                        return;
                    }
                    if (slot.start >= slot.end) {
                        toast.error(`Start time must be before end time for slot ${i + 1} on customized date ${cd.date}.`);
                        return;
                    }
                }
            }
        }

        setSaving(true);
        try {
            await api.put(`/availability/${user._id}`, {
                weekly_schedule: schedule,
                blocked_dates: blockedDates,
                date_range_start: dateRangeStart || null,
                date_range_end: dateRangeEnd || null,
                custom_schedule: customDays.map(cd => ({
                    date: cd.date,
                    enabled: cd.enabled,
                    slots: cd.slots.map(s => ({ start: s.start, end: s.end }))
                }))
            });
            // Save date range and custom overrides to local storage
            localStorage.setItem(`availability_range_${user._id}`, JSON.stringify({ start: dateRangeStart, end: dateRangeEnd }));
            localStorage.setItem(`availability_custom_${user._id}`, JSON.stringify(customDays));
            toast.success('Availability saved');
            onClose();
        } catch {
            toast.error('Failed to save availability');
        } finally {
            setSaving(false);
        }
    };

    if (!open || !user) return null;

    const dParts = selectedCalendarDate.split('-');
    const dateObj = new Date(parseInt(dParts[0], 10), parseInt(dParts[1], 10) - 1, parseInt(dParts[2], 10));
    const formattedLabel = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    const selectedOverride = customDays.find(cd => cd.date === selectedCalendarDate);
    const hasOverride = !!selectedOverride;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent aria-describedby={undefined} className="sm:max-w-5xl p-0 overflow-hidden flex flex-col max-h-[92vh]">
                <DialogHeader className="p-6 pb-4 border-b border-border">
                    <DialogTitle className="flex items-center gap-2 text-foreground">
                        <CalendarDays size={16} className="text-primary" />
                        Availability — {user.name || user.username}
                    </DialogTitle>
                    <DialogDescription>Configure availability date range and customize specific dates.</DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 size={24} className="animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                            {/* Left Column: Date Range & Weekly Availability */}
                            <div className="space-y-6">
                                {/* Step 1: Set Active Date Range */}
                                <div className="space-y-3">
                                    <div>
                                        <h4 className="text-sm font-bold text-foreground">1. Set Active Date Range</h4>
                                        <p className="text-xs text-muted-foreground">Restrict your availability strictly within this date range.</p>
                                    </div>
                                    <div className="border border-border/60 bg-muted/10 rounded-xl p-4 space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Start Date</label>
                                                <input
                                                    type="date"
                                                    value={dateRangeStart}
                                                    max={dateRangeEnd || undefined}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        setDateRangeStart(val);
                                                        if (val) {
                                                            setSelectedCalendarDate(val);
                                                            setCalendarMonth(new Date(val + 'T12:00:00'));
                                                        }
                                                    }}
                                                    className="w-full text-xs px-2.5 py-1.5 h-9 rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">End Date</label>
                                                <input
                                                    type="date"
                                                    value={dateRangeEnd}
                                                    min={dateRangeStart || undefined}
                                                    onChange={e => setDateRangeEnd(e.target.value)}
                                                    className="w-full text-xs px-2.5 py-1.5 h-9 rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Step 2: Weekly Availability */}
                                <div className="space-y-3">
                                    <div>
                                        <h4 className="text-sm font-bold text-foreground">2. Weekly Availability</h4>
                                        <p className="text-xs text-muted-foreground">Select days you are standardly available each week and set default timeslots.</p>
                                    </div>
                                    <div className="border border-border/60 bg-muted/10 rounded-xl p-4 space-y-3">
                                        {DAYS.map(day => {
                                            const daySched = schedule[day] || { enabled: false, slots: [] };
                                            const enabled = daySched.enabled;
                                            return (
                                                <div key={day} className="flex flex-col gap-2 pb-2 border-b border-border/40 last:border-b-0 last:pb-0">
                                                    <div className="flex items-center justify-between">
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={enabled}
                                                                onChange={(e) => {
                                                                    const checked = e.target.checked;
                                                                    setSchedule(prev => ({
                                                                        ...prev,
                                                                        [day]: {
                                                                            ...prev[day],
                                                                            enabled: checked,
                                                                            slots: checked && prev[day].slots.length === 0 ? [{ start: '09:00', end: '17:00' }] : prev[day].slots
                                                                        }
                                                                    }));

                                                                    if (!checked) {
                                                                        const parts = selectedCalendarDate.split('-');
                                                                        if (parts.length === 3) {
                                                                            const selDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                                                                            const est = getESTDateParts(selDate);
                                                                            if (est.weekday === day) {
                                                                                setSelectedCalendarDate(dateRangeStart || '');
                                                                            }
                                                                        }
                                                                    }
                                                                }}
                                                                className="rounded border-border bg-background text-primary focus:ring-primary focus:ring-offset-background h-4 w-4"
                                                            />
                                                            <span className="text-xs font-bold text-foreground capitalize w-20">{day}</span>
                                                        </label>
                                                        
                                                        {enabled ? (
                                                            <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                                                                Active
                                                            </span>
                                                        ) : (
                                                            <span className="bg-zinc-500/5 text-muted-foreground/60 border border-border/40 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                                                                Closed
                                                            </span>
                                                        )}
                                                    </div>
                                                    
                                                    {enabled && (
                                                        <div className="pl-6 space-y-2">
                                                            {(daySched.slots || []).map((slot, idx) => {
                                                                const isStartActive = activeInput && activeInput.type === "weekly" && activeInput.day === day && activeInput.index === idx && activeInput.field === "start";
                                                                const isEndActive = activeInput && activeInput.type === "weekly" && activeInput.day === day && activeInput.index === idx && activeInput.field === "end";
                                                                return (
                                                                    <div key={idx} className="flex items-center gap-1.5">
                                                                        <div className="relative flex-1 flex items-center">
                                                                            <input
                                                                                id={`weekly-${day}-start-${idx}`}
                                                                                name={`weekly-${day}-start-${idx}`}
                                                                                type="text"
                                                                                placeholder="09:00 AM"
                                                                                value={isStartActive ? tempText : formatTimeTo12h(slot.start)}
                                                                                onFocus={() => {
                                                                                    setActiveInput({ type: "weekly", day, index: idx, field: "start" });
                                                                                    setTempText(formatTimeTo12h(slot.start) || "09:00 AM");
                                                                                }}
                                                                                onChange={e => setTempText(e.target.value)}
                                                                                className="w-full text-center text-xs pl-2 pr-7 py-1 h-7 rounded-lg border border-border bg-background text-foreground focus:outline-none"
                                                                            />
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => document.getElementById('weekly-' + day + '-start-' + idx)?.focus()}
                                                                                className="absolute right-2 text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                                                                            >
                                                                                <Clock size={11} />
                                                                            </button>
                                                                            {isStartActive && (
                                                                                <TimePickerPopover
                                                                                    tempText={tempText}
                                                                                    setTempText={setTempText}
                                                                                    onCancel={() => setActiveInput(null)}
                                                                                    onConfirm={() => {
                                                                                        const normalized = parseTimeTo24h(tempText);
                                                                                        if (getValidTimeValue(normalized)) {
                                                                                            setSchedule(prev => {
                                                                                                const slots = prev[day].slots.map((s, i) => i === idx ? { ...s, start: normalized } : s);
                                                                                                return { ...prev, [day]: { ...prev[day], slots } };
                                                                                            });
                                                                                        }
                                                                                        setActiveInput(null);
                                                                                    }}
                                                                                />
                                                                            )}
                                                                        </div>
                                                                        <span className="text-xs text-muted-foreground shrink-0">to</span>
                                                                        <div className="relative flex-1 flex items-center">
                                                                            <input
                                                                                id={`weekly-${day}-end-${idx}`}
                                                                                name={`weekly-${day}-end-${idx}`}
                                                                                type="text"
                                                                                placeholder="05:00 PM"
                                                                                value={isEndActive ? tempText : formatTimeTo12h(slot.end)}
                                                                                onFocus={() => {
                                                                                    setActiveInput({ type: "weekly", day, index: idx, field: "end" });
                                                                                    setTempText(formatTimeTo12h(slot.end) || "05:00 PM");
                                                                                }}
                                                                                onChange={e => setTempText(e.target.value)}
                                                                                className="w-full text-center text-xs pl-2 pr-7 py-1 h-7 rounded-lg border border-border bg-background text-foreground focus:outline-none"
                                                                            />
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => document.getElementById('weekly-' + day + '-end-' + idx)?.focus()}
                                                                                className="absolute right-2 text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                                                                            >
                                                                                <Clock size={11} />
                                                                            </button>
                                                                            {isEndActive && (
                                                                                <TimePickerPopover
                                                                                    tempText={tempText}
                                                                                    setTempText={setTempText}
                                                                                    onCancel={() => setActiveInput(null)}
                                                                                    onConfirm={() => {
                                                                                        const normalized = parseTimeTo24h(tempText);
                                                                                        if (getValidTimeValue(normalized)) {
                                                                                            setSchedule(prev => {
                                                                                                const slots = prev[day].slots.map((s, i) => i === idx ? { ...s, end: normalized } : s);
                                                                                                return { ...prev, [day]: { ...prev[day], slots } };
                                                                                            });
                                                                                        }
                                                                                        setActiveInput(null);
                                                                                    }}
                                                                                />
                                                                            )}
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setSchedule(prev => {
                                                                                    const slots = prev[day].slots.filter((_, i) => i !== idx);
                                                                                    return {
                                                                                        ...prev,
                                                                                        [day]: {
                                                                                            ...prev[day],
                                                                                            slots,
                                                                                            enabled: slots.length > 0 ? prev[day].enabled : false
                                                                                        }
                                                                                    };
                                                                                });
                                                                            }}
                                                                            className="text-muted-foreground hover:text-destructive shrink-0 p-1 rounded hover:bg-muted transition-colors"
                                                                        >
                                                                            <X size={12} />
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })}
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setSchedule(prev => ({
                                                                        ...prev,
                                                                        [day]: {
                                                                            ...prev[day],
                                                                            slots: [...prev[day].slots, { start: '09:00', end: '17:00' }]
                                                                        }
                                                                    }));
                                                                }}
                                                                className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold pt-0.5"
                                                            >
                                                                <Plus size={11} /> Add slot
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Customize Hours, Blocked Dates & Calendar View */}
                            <div className="space-y-6">
                                {/* Step 3: Calendar View */}
                                <div className="space-y-3">
                                    <div>
                                        <h4 className="text-sm font-bold text-foreground">3. Calendar View</h4>
                                        <p className="text-xs text-muted-foreground">Select a date inside your range to customize specific slots.</p>
                                    </div>

                                    {!dateRangeStart || !dateRangeEnd ? (
                                        <div className="border border-dashed border-border/80 bg-muted/5 rounded-xl p-6 text-center text-xs text-muted-foreground">
                                            ⚠️ Please select a Start and End date range in Step 1 to open the calendar.
                                        </div>
                                    ) : (
                                        <div className="border border-border/80 bg-muted/10 rounded-xl p-4">
                                            <div className="flex items-center justify-between px-1 mb-3">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-foreground">
                                                        {calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })} (EST)
                                                    </span>
                                                    {dateRangeStart && dateRangeEnd && (
                                                        <span className="text-[10px] text-primary font-bold">
                                                            Active Range: {new Date(dateRangeStart + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to {new Date(dateRangeEnd + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                                                        className="p-1 border border-border bg-background rounded hover:bg-muted text-muted-foreground transition-colors"
                                                    >
                                                        <ChevronLeft size={13} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                                                        className="p-1 border border-border bg-background rounded hover:bg-muted text-muted-foreground transition-colors"
                                                    >
                                                        <ChevronRight size={13} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-7 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-t border-l border-border/80 bg-muted/10">
                                                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(w => (
                                                    <span key={w} className="py-1.5 border-r border-b border-border/80">{w}</span>
                                                ))}
                                            </div>

                                            <div className="grid grid-cols-7 border-l border-border/80 bg-background">
                                                {(() => {
                                                    const calendarYear = calendarMonth.getFullYear();
                                                    const calendarMonthIndex = calendarMonth.getMonth();
                                                    
                                                    const firstDay = new Date(calendarYear, calendarMonthIndex, 1);
                                                    const startDay = firstDay.getDay();
                                                    const gridStart = new Date(firstDay);
                                                    gridStart.setDate(gridStart.getDate() - startDay);

                                                    const lastDay = new Date(calendarYear, calendarMonthIndex + 1, 0);
                                                    const endDay = lastDay.getDay();
                                                    const gridEnd = new Date(lastDay);
                                                    gridEnd.setDate(gridEnd.getDate() + (6 - endDay));

                                                    const monthGridDays: Date[] = [];
                                                    let curDate = new Date(gridStart);
                                                    while (curDate <= gridEnd) {
                                                        monthGridDays.push(new Date(curDate));
                                                        curDate.setDate(curDate.getDate() + 1);
                                                    }

                                                    return monthGridDays.map((d, idx) => {
                                                        const dStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
                                                        const isCurrentMonth = d.getMonth() === calendarMonthIndex;
                                                        const inRange = isWithinRange(dStr, dateRangeStart, dateRangeEnd);
                                                        const isSelected = dStr === selectedCalendarDate;
                                                        
                                                        const override = customDays.find(cd => cd.date === dStr);
                                                        const isBlocked = blockedDates.includes(dStr);
                                                        const est = getESTDateParts(d);
                                                        const wDay = est.weekday as Day;
                                                        const isWeekdayEnabled = schedule[wDay]?.enabled;

                                                        let dayClass = "h-11 w-full text-xs font-bold transition-all flex flex-col items-center justify-center relative border-r border-b border-border/80 rounded-none ";
                                                        if (isSelected) {
                                                            dayClass += "bg-transparent text-foreground font-bold ring-2 ring-primary ring-inset z-10";
                                                        } else if (!inRange || !isWeekdayEnabled) {
                                                            dayClass += "text-muted-foreground/30 cursor-not-allowed bg-transparent";
                                                        } else if (isBlocked) {
                                                            dayClass += "bg-destructive/20 text-destructive/60 cursor-not-allowed opacity-50";
                                                        } else if (override) {
                                                            if (override.enabled) {
                                                                dayClass += "bg-transparent text-foreground font-bold hover:bg-accent/40";
                                                            } else {
                                                                dayClass += "bg-destructive/10 text-destructive hover:bg-destructive/15";
                                                            }
                                                        } else {
                                                            dayClass += "text-foreground font-bold bg-transparent hover:bg-accent/40";
                                                        }

                                                        if (!isCurrentMonth && inRange && !isSelected) {
                                                            dayClass += " opacity-80";
                                                        }

                                                        return (
                                                            <button
                                                                key={idx}
                                                                type="button"
                                                                disabled={!inRange || isBlocked || !isWeekdayEnabled}
                                                                onClick={() => setSelectedCalendarDate(dStr)}
                                                                className={dayClass}
                                                            >
                                                                <span>{d.getDate()}</span>
                                                                {!isSelected && (
                                                                    <span className="absolute bottom-1 flex gap-0.5">
                                                                        {override && !override.enabled && (
                                                                            <span className="w-1 h-1 rounded-full bg-destructive"></span>
                                                                        )}
                                                                        {isBlocked && (
                                                                            <span className="w-1 h-1 rounded-full bg-destructive"></span>
                                                                        )}
                                                                    </span>
                                                                )}
                                                            </button>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Step 3: Date Settings (Integrated in Calendar View) */}
                                <div className="space-y-3">
                                    <div>
                                        <h4 className="text-sm font-bold text-foreground">Customize working hours specifically for the selected date</h4>
                                        <p className="text-xs text-muted-foreground">Select a date inside the active range on the calendar to configure custom hours.</p>
                                    </div>

                                    {selectedCalendarDate && (
                                        <div className="border border-border/80 bg-muted/5 rounded-xl p-4 space-y-4">
                                            <div>
                                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Selected Date</p>
                                                <h5 className="text-xs font-bold text-foreground">{formattedLabel}</h5>
                                            </div>

                                            {isWithinRange(selectedCalendarDate, dateRangeStart, dateRangeEnd) ? (
                                                <div className="space-y-4">
                                                    <div className="flex flex-col gap-2">
                                                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Date Settings Options</span>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    toggleCalendarOverride(false);
                                                                }}
                                                                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all hover:bg-muted/10 h-16 ${!hasOverride || (hasOverride && !selectedOverride.enabled) ? 'border-destructive bg-destructive/10 text-destructive font-black shadow-sm' : 'border-border bg-background text-muted-foreground'}`}
                                                            >
                                                                <span className="text-xs font-bold">Closed / Unavailable</span>
                                                                <span className="text-[9px] font-normal opacity-70 mt-0.5">No slots / Holiday</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (!hasOverride) {
                                                                        toggleCalendarOverride(true);
                                                                    } else {
                                                                        toggleCalendarOverrideEnabled(true);
                                                                    }
                                                                }}
                                                                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all hover:bg-primary/5 h-16 ${hasOverride && selectedOverride.enabled ? 'border-primary bg-primary/10 text-primary font-black shadow-sm' : 'border-border bg-background text-muted-foreground'}`}
                                                            >
                                                                <span className="text-xs font-bold">Customize / Custom Hours</span>
                                                                <span className="text-[9px] font-normal opacity-70 mt-0.5">Enter active slots</span>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {hasOverride && selectedOverride.enabled ? (
                                                        <div className="space-y-2.5 pt-3 border-t border-border/60">
                                                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Enter configured slots:</span>
                                                            <div className="space-y-2.5">
                                                                {selectedOverride.slots.map((slot, idx) => {
                                                                    const isOverStartActive = activeInput && activeInput.type === "calendar_override" && activeInput.index === idx && activeInput.field === "start";
                                                                    const isOverEndActive = activeInput && activeInput.type === "calendar_override" && activeInput.index === idx && activeInput.field === "end";
                                                                    return (
                                                                        <div key={idx} className="flex items-center gap-1.5">
                                                                            <div className="relative flex-1 flex items-center">
                                                                                <input
                                                                                    id={'caloverride-start-' + idx}
                                                                                    name={'caloverride-start-' + idx}
                                                                                    type="text"
                                                                                    placeholder="09:00 AM"
                                                                                    value={isOverStartActive ? tempText : formatTimeTo12h(slot.start)}
                                                                                    onFocus={() => {
                                                                                        setActiveInput({ type: "calendar_override", index: idx, field: "start" });
                                                                                        setTempText(formatTimeTo12h(slot.start) || "09:00 AM");
                                                                                    }}
                                                                                    onChange={e => setTempText(e.target.value)}
                                                                                    className="w-full text-center text-xs pl-2 pr-7 py-1.5 h-8 rounded-lg border border-border bg-background text-foreground focus:outline-none"
                                                                                />
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => document.getElementById('caloverride-start-' + idx)?.focus()}
                                                                                    className="absolute right-2 text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                                                                                >
                                                                                    <Clock size={11} />
                                                                                </button>
                                                                                {isOverStartActive && (
                                                                                    <TimePickerPopover
                                                                                        tempText={tempText}
                                                                                        setTempText={setTempText}
                                                                                        onCancel={() => setActiveInput(null)}
                                                                                        onConfirm={() => {
                                                                                            const normalized = parseTimeTo24h(tempText);
                                                                                            if (getValidTimeValue(normalized)) {
                                                                                                updateCalendarOverrideSlot(idx, "start", normalized);
                                                                                            }
                                                                                            setActiveInput(null);
                                                                                        }}
                                                                                    />
                                                                                )}
                                                                            </div>
                                                                            <span className="text-xs text-muted-foreground shrink-0">to</span>
                                                                            <div className="relative flex-1 flex items-center">
                                                                                <input
                                                                                    id={'caloverride-end-' + idx}
                                                                                    name={'caloverride-end-' + idx}
                                                                                    type="text"
                                                                                    placeholder="05:00 PM"
                                                                                    value={isOverEndActive ? tempText : formatTimeTo12h(slot.end)}
                                                                                    onFocus={() => {
                                                                                        setActiveInput({ type: "calendar_override", index: idx, field: "end" });
                                                                                        setTempText(formatTimeTo12h(slot.end) || "05:00 PM");
                                                                                    }}
                                                                                    onChange={e => setTempText(e.target.value)}
                                                                                    className="w-full text-center text-xs pl-2 pr-7 py-1.5 h-8 rounded-lg border border-border bg-background text-foreground focus:outline-none"
                                                                                />
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => document.getElementById('caloverride-end-' + idx)?.focus()}
                                                                                    className="absolute right-2 text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                                                                                    >
                                                                                    <Clock size={11} />
                                                                                </button>
                                                                                {isOverEndActive && (
                                                                                    <TimePickerPopover
                                                                                        tempText={tempText}
                                                                                        setTempText={setTempText}
                                                                                        onCancel={() => setActiveInput(null)}
                                                                                        onConfirm={() => {
                                                                                            const normalized = parseTimeTo24h(tempText);
                                                                                            if (getValidTimeValue(normalized)) {
                                                                                                updateCalendarOverrideSlot(idx, "end", normalized);
                                                                                            }
                                                                                            setActiveInput(null);
                                                                                        }}
                                                                                    />
                                                                                )}
                                                                            </div>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => removeCalendarOverrideSlot(idx)}
                                                                                className="text-muted-foreground hover:text-destructive shrink-0 p-1.5 rounded hover:bg-muted transition-colors"
                                                                            >
                                                                                <X size={13} />
                                                                            </button>
                                                                        </div>
                                                                    );
                                                                })}
                                                                <button
                                                                    type="button"
                                                                    onClick={addCalendarOverrideSlot}
                                                                    className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold pt-1"
                                                                >
                                                                    <Plus size={13} /> Add slot
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-center text-xs text-muted-foreground py-4 border-t border-border/40">
                                                            Unavailable / Closed by default. Select Customize option above to configure working hours for this date.
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-center text-xs text-muted-foreground py-4 border-t border-border/40">
                                                    ⚠️ This date is outside the active range. Please select a date inside the range.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Step 4: Blocked Dates */}
                                <div className="space-y-3">
                                    <div>
                                        <h4 className="text-sm font-bold text-foreground">4. Blocked Dates</h4>
                                        <p className="text-xs text-muted-foreground">Mark specific holidays or vacation dates as fully unavailable.</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            id="avail-blocked-date"
                                            name="avail-blocked-date"
                                            type="date"
                                            value={newBlockedDate}
                                            onChange={e => setNewBlockedDate(e.target.value)}
                                            className="flex-1 text-xs px-3 py-1.5 h-8 rounded-lg border border-border bg-background text-foreground [color-scheme:light] dark:[color-scheme:dark] focus:outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={addBlockedDate}
                                            disabled={!newBlockedDate}
                                            className="h-8 px-3 text-xs bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1 shrink-0"
                                        >
                                            <Plus size={13} /> Add
                                        </button>
                                    </div>
                                    {blockedDates.length > 0 && (
                                        <div className="space-y-2 max-h-36 overflow-y-auto custom-scrollbar pr-1 pt-1">
                                            {blockedDates.map(d => (
                                                <div key={d} className="flex items-center gap-1.5">
                                                    <div className="flex-1 flex items-center justify-between text-xs px-3 py-1.5 h-8 rounded-lg border border-border bg-muted/20 text-foreground font-semibold">
                                                        <span>{new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                                        <span className="text-[9px] font-extrabold uppercase bg-destructive/10 text-destructive border border-destructive/20 rounded px-1.5 py-0.5">Blocked</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeBlockedDate(d)}
                                                        className="text-muted-foreground hover:text-destructive shrink-0 p-1.5 rounded hover:bg-muted transition-colors h-8 w-8 flex items-center justify-center border border-border bg-background"
                                                    >
                                                        <X size={13} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 pt-4 border-t border-border gap-2">
                    <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving || loading} className="gap-2">
                        {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><CalendarDays size={14} /> Save Availability</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
