import { useEffect, useState } from "react";
import api from "../api/api";
import {
    CalendarDays,
    Loader2,
    X,
    Plus,
    Clock,
    Edit2,
    RotateCcw,
} from "lucide-react";
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

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
type Day = typeof DAYS[number];

interface TimeSlot {
    start: string;
    end: string;
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

export default function AvailabilityModal({ user, open, onClose }: { user: AvailabilityUser | null; open: boolean; onClose: () => void }) {
    const [schedule, setSchedule] = useState<WeeklySchedule>(defaultSchedule());
    const [globalSlots, setGlobalSlots] = useState<TimeSlot[]>([{ start: '09:00', end: '17:00' }]);
    const [blockedDates, setBlockedDates] = useState<string[]>([]); // ISO date strings
    const [newBlockedDate, setNewBlockedDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [editingDay, setEditingDay] = useState<Day | null>(null);
    const [customizedDays, setCustomizedDays] = useState<Day[]>([]);

    useEffect(() => {
        if (!user || !open) return;
        setLoading(true);
        api.get(`/availability/${user._id}`)
            .then(res => {
                const avail = res.data;
                const sched: WeeklySchedule = defaultSchedule();
                let firstFoundSlots: TimeSlot[] = [];

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

                        if (dayData.enabled && firstFoundSlots.length === 0 && slots.length > 0) {
                            firstFoundSlots = [...slots];
                        }
                    }
                });
                
                setSchedule(sched);
                setBlockedDates((avail.blocked_dates || []).map((d: string) => new Date(d).toISOString().slice(0, 10)));
                
                if (firstFoundSlots.length > 0) {
                    setGlobalSlots(firstFoundSlots);
                } else {
                    setGlobalSlots([{ start: '09:00', end: '17:00' }]);
                }

                // Detect custom days loaded from database
                const customized: Day[] = [];
                DAYS.forEach(d => {
                    const daySched = sched[d];
                    if (daySched.enabled && firstFoundSlots.length > 0) {
                        const matchesTemplate = daySched.slots && daySched.slots.length === firstFoundSlots.length &&
                            daySched.slots.every((s, idx) => s.start === firstFoundSlots[idx].start && s.end === firstFoundSlots[idx].end);
                        if (!matchesTemplate) {
                            customized.push(d);
                        }
                    }
                });
                setCustomizedDays(customized);
            })
            .catch(() => { 
                setSchedule(defaultSchedule()); 
                setBlockedDates([]); 
                setGlobalSlots([{ start: '09:00', end: '17:00' }]);
                setCustomizedDays([]);
            })
            .finally(() => setLoading(false));
    }, [user, open]);

    const addGlobalSlot = () => {
        const newSlots = [...globalSlots, { start: '09:00', end: '17:00' }];
        setGlobalSlots(newSlots);
        
        setSchedule(prev => {
            const updated = { ...prev };
            DAYS.forEach(d => {
                if (updated[d].enabled && !customizedDays.includes(d)) {
                    updated[d].slots = newSlots.map(s => ({ ...s }));
                }
            });
            return updated;
        });
    };

    const removeGlobalSlot = (index: number) => {
        const newSlots = globalSlots.filter((_, i) => i !== index);
        setGlobalSlots(newSlots);
        
        setSchedule(prev => {
            const updated = { ...prev };
            DAYS.forEach(d => {
                if (updated[d].enabled && !customizedDays.includes(d)) {
                    updated[d].slots = newSlots.map(s => ({ ...s }));
                    if (newSlots.length === 0) {
                        updated[d].enabled = false;
                    }
                }
            });
            return updated;
        });
    };

    const updateGlobalSlot = (index: number, field: 'start' | 'end', value: string) => {
        const newSlots = globalSlots.map((s, i) => i === index ? { ...s, [field]: value } : s);
        setGlobalSlots(newSlots);
        
        setSchedule(prev => {
            const updated = { ...prev };
            DAYS.forEach(d => {
                if (updated[d].enabled && !customizedDays.includes(d)) {
                    updated[d].slots = newSlots.map(s => ({ ...s }));
                }
            });
            return updated;
        });
    };

    const toggleDay = (day: Day) => {
        setSchedule(prev => {
            const currentlyEnabled = prev[day].enabled;
            if (currentlyEnabled) {
                setCustomizedDays(c => c.filter(d => d !== day));
                if (editingDay === day) setEditingDay(null);
            } else {
                setCustomizedDays(c => c.filter(d => d !== day));
            }
            return {
                ...prev,
                [day]: {
                    enabled: !currentlyEnabled,
                    slots: !currentlyEnabled ? globalSlots.map(s => ({ ...s })) : []
                }
            };
        });
    };

    const addDaySlot = (day: Day) => {
        setSchedule(prev => {
            const slots = prev[day].slots || [];
            return {
                ...prev,
                [day]: {
                    ...prev[day],
                    slots: [...slots, { start: '09:00', end: '17:00' }]
                }
            };
        });
        if (!customizedDays.includes(day)) {
            setCustomizedDays(prev => [...prev, day]);
        }
    };

    const removeDaySlot = (day: Day, index: number) => {
        setSchedule(prev => {
            const slots = (prev[day].slots || []).filter((_, i) => i !== index);
            return {
                ...prev,
                [day]: {
                    ...prev[day],
                    slots: slots,
                    enabled: slots.length > 0 ? prev[day].enabled : false
                }
            };
        });
        if (!customizedDays.includes(day)) {
            setCustomizedDays(prev => [...prev, day]);
        }
    };

    const updateDaySlot = (day: Day, index: number, field: 'start' | 'end', value: string) => {
        setSchedule(prev => {
            const slots = (prev[day].slots || []).map((s, i) => i === index ? { ...s, [field]: value } : s);
            return {
                ...prev,
                [day]: {
                    ...prev[day],
                    slots
                }
            };
        });
        if (!customizedDays.includes(day)) {
            setCustomizedDays(prev => [...prev, day]);
        }
    };

    const resetDayToGlobal = (day: Day) => {
        setSchedule(prev => ({
            ...prev,
            [day]: {
                ...prev[day],
                slots: globalSlots.map(s => ({ ...s }))
            }
        }));
        setCustomizedDays(prev => prev.filter(d => d !== day));
        if (editingDay === day) {
            setEditingDay(null);
        }
        toast.info(`${day.charAt(0).toUpperCase() + day.slice(1)} reset to default template hours`);
    };

    const addBlockedDate = () => {
        if (!newBlockedDate || blockedDates.includes(newBlockedDate)) return;
        setBlockedDates(prev => [...prev, newBlockedDate].sort());
        setNewBlockedDate('');
    };

    const removeBlockedDate = (date: string) => setBlockedDates(prev => prev.filter(d => d !== date));

    const handleSave = async () => {
        if (!user) return;

        // Validation:
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

        setSaving(true);
        try {
            await api.put(`/availability/${user._id}`, {
                weekly_schedule: schedule,
                blocked_dates: blockedDates
            });
            toast.success('Availability saved');
            onClose();
        } catch {
            toast.error('Failed to save availability');
        } finally {
            setSaving(false);
        }
    };

    if (!open || !user) return null;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-4xl p-0 overflow-hidden flex flex-col max-h-[92vh]">
                <DialogHeader className="p-6 pb-4 border-b border-border">
                    <DialogTitle className="flex items-center gap-2 text-foreground">
                        <CalendarDays size={16} className="text-primary" />
                        Availability — {user.name || user.username}
                    </DialogTitle>
                    <DialogDescription>Set weekly working hours and blocked dates for meeting scheduling.</DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 size={24} className="animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                            {/* Left Column: Configurator */}
                            <div className="space-y-6">
                                {/* Time Slots Configurator */}
                                <div className="space-y-3">
                                    <div>
                                        <h4 className="text-sm font-bold text-foreground">1. Set Active Time Slots</h4>
                                        <p className="text-xs text-muted-foreground">Define the working hours that apply to your selected days.</p>
                                    </div>
                                    
                                    <div className="space-y-3 border border-border/60 bg-muted/10 rounded-xl p-4">
                                        {globalSlots.map((slot, index) => (
                                            <div key={index} className="flex items-center gap-2">
                                                <div className="relative flex-1 flex items-center">
                                                    <input
                                                        id={`avail-start-${index}`}
                                                        name={`avail-start-${index}`}
                                                        type="text"
                                                        placeholder="09:00"
                                                        value={slot.start}
                                                        onChange={e => {
                                                            const formatted = formatTimeInput(e.target.value);
                                                            updateGlobalSlot(index, 'start', formatted);
                                                        }}
                                                        onBlur={e => {
                                                            const normalized = normalizeTimeOnBlur(e.target.value);
                                                            updateGlobalSlot(index, 'start', normalized);
                                                        }}
                                                        className="w-full text-center text-xs pl-2 pr-7 py-1.5 h-9 rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={e => {
                                                            const hiddenInput = e.currentTarget.parentElement?.querySelector('input[type="time"]') as HTMLInputElement;
                                                            if (hiddenInput) {
                                                                try {
                                                                    hiddenInput.showPicker();
                                                                } catch (err) {
                                                                    hiddenInput.focus();
                                                                    hiddenInput.click();
                                                                }
                                                            }
                                                        }}
                                                        className="absolute right-2 text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                                                    >
                                                        <Clock size={13} />
                                                    </button>
                                                    <input
                                                        id={`avail-start-time-picker-${index}`}
                                                        name={`avail-start-time-picker-${index}`}
                                                        type="time"
                                                        value={slot.start}
                                                        onChange={e => {
                                                            updateGlobalSlot(index, 'start', e.target.value);
                                                        }}
                                                        className="opacity-0 absolute right-0 top-0 w-0 h-0 pointer-events-none"
                                                    />
                                                </div>
                                                <span className="text-xs text-muted-foreground shrink-0 font-medium">to</span>
                                                <div className="relative flex-1 flex items-center">
                                                    <input
                                                        id={`avail-end-${index}`}
                                                        name={`avail-end-${index}`}
                                                        type="text"
                                                        placeholder="17:00"
                                                        value={slot.end}
                                                        onChange={e => {
                                                            const formatted = formatTimeInput(e.target.value);
                                                            updateGlobalSlot(index, 'end', formatted);
                                                        }}
                                                        onBlur={e => {
                                                            const normalized = normalizeTimeOnBlur(e.target.value);
                                                            updateGlobalSlot(index, 'end', normalized);
                                                        }}
                                                        className="w-full text-center text-xs pl-2 pr-7 py-1.5 h-9 rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={e => {
                                                            const hiddenInput = e.currentTarget.parentElement?.querySelector('input[type="time"]') as HTMLInputElement;
                                                            if (hiddenInput) {
                                                                try {
                                                                    hiddenInput.showPicker();
                                                                } catch (err) {
                                                                    hiddenInput.focus();
                                                                    hiddenInput.click();
                                                                }
                                                            }
                                                        }}
                                                        className="absolute right-2 text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                                                    >
                                                        <Clock size={13} />
                                                    </button>
                                                    <input
                                                        id={`avail-end-time-picker-${index}`}
                                                        name={`avail-end-time-picker-${index}`}
                                                        type="time"
                                                        value={slot.end}
                                                        onChange={e => {
                                                            updateGlobalSlot(index, 'end', e.target.value);
                                                        }}
                                                        className="opacity-0 absolute right-0 top-0 w-0 h-0 pointer-events-none"
                                                    />
                                                </div>
                                                {globalSlots.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeGlobalSlot(index)}
                                                        className="text-muted-foreground hover:text-destructive shrink-0 p-1.5 rounded hover:bg-muted transition-colors"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={addGlobalSlot}
                                            className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold pt-1"
                                        >
                                            <Plus size={13} /> Add another time slot
                                        </button>
                                    </div>
                                </div>

                                {/* Days Selector */}
                                <div className="space-y-3">
                                    <div>
                                        <h4 className="text-sm font-bold text-foreground">2. Select Active Days</h4>
                                        <p className="text-xs text-muted-foreground">Select the days to apply your configured time slots.</p>
                                    </div>
                                    <div className="grid grid-cols-7 gap-1.5">
                                        {DAYS.map(day => {
                                            const enabled = schedule[day].enabled;
                                            const shortName = day.slice(0, 3).charAt(0).toUpperCase() + day.slice(1, 3);
                                            return (
                                                <button
                                                    key={day}
                                                    type="button"
                                                    onClick={() => toggleDay(day)}
                                                    className={`h-11 rounded-lg border text-xs font-bold transition-all flex flex-col items-center justify-center relative
                                                        ${enabled 
                                                            ? 'border-primary bg-primary/10 text-primary shadow-sm' 
                                                            : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:bg-accent/40'}`}
                                                >
                                                    {shortName}
                                                    {enabled && (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-primary absolute bottom-1"></span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Visual Summary & Blocked Dates */}
                            <div className="space-y-6">
                                {/* Summary Card */}
                                <div className="space-y-3">
                                    <div>
                                        <h4 className="text-sm font-bold text-foreground">Weekly Availability Summary</h4>
                                        <p className="text-xs text-muted-foreground">This is your configured work schedule.</p>
                                    </div>
                                    
                                    <div className="border border-border/80 bg-muted/20 rounded-xl p-4 space-y-3">
                                        {DAYS.map(day => {
                                            const daySched = schedule[day];
                                            const enabled = daySched.enabled;
                                            const isCustom = customizedDays.includes(day);
                                            const isEditing = editingDay === day;

                                            return (
                                                <div key={day} className="py-1.5 border-b border-border/40 last:border-b-0">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold text-foreground capitalize w-20">{day}</span>
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
                                                        
                                                        <div className="flex items-center gap-3">
                                                            {enabled && (
                                                                <div className="flex items-center gap-1.5 mr-1 shrink-0">
                                                                    {isCustom && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => resetDayToGlobal(day)}
                                                                            className="text-muted-foreground hover:text-primary transition-colors p-0.5 rounded"
                                                                            title="Reset to default template hours"
                                                                        >
                                                                            <RotateCcw size={11} />
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setEditingDay(isEditing ? null : day)}
                                                                        className={`transition-colors p-0.5 rounded ${isEditing ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                                                                        title="Customize hours for this day"
                                                                    >
                                                                        <Edit2 size={11} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                            
                                                            {!isEditing && (
                                                                <div className="flex-1 text-right">
                                                                    {enabled && daySched.slots && daySched.slots.length > 0 ? (
                                                                        <div className="space-y-1">
                                                                            {daySched.slots.map((s, idx) => (
                                                                                <div key={idx} className="text-xs text-foreground font-semibold flex items-center justify-end gap-1">
                                                                                    <Clock size={10} className="text-muted-foreground/75" />
                                                                                    <span>{formatTimeTo12h(s.start)}</span>
                                                                                    <span className="text-muted-foreground/60 mx-0.5">-</span>
                                                                                    <span>{formatTimeTo12h(s.end)}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-xs text-muted-foreground/50 italic">Unavailable</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {enabled && isEditing && (
                                                        <div className="mt-2 pl-3 py-2 border-l-2 border-primary/45 space-y-2 bg-background/50 rounded-r-lg">
                                                            <p className="text-[10px] font-bold text-primary uppercase tracking-wider text-left">Customize Hours</p>
                                                            {daySched.slots.map((slot, idx) => (
                                                                <div key={idx} className="flex items-center gap-1.5">
                                                                    <div className="relative flex-1 flex items-center">
                                                                        <input
                                                                            id={`custom-start-${day}-${idx}`}
                                                                            name={`custom-start-${day}-${idx}`}
                                                                            type="text"
                                                                            placeholder="09:00"
                                                                            value={slot.start}
                                                                            onChange={e => {
                                                                                const formatted = formatTimeInput(e.target.value);
                                                                                updateDaySlot(day, idx, 'start', formatted);
                                                                            }}
                                                                            onBlur={e => {
                                                                                const normalized = normalizeTimeOnBlur(e.target.value);
                                                                                updateDaySlot(day, idx, 'start', normalized);
                                                                            }}
                                                                            className="w-full text-center text-[10px] pl-1 pr-5 py-0.5 h-7 border border-border rounded bg-background text-foreground focus:outline-none"
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            onClick={e => {
                                                                                const hiddenInput = e.currentTarget.parentElement?.querySelector('input[type="time"]') as HTMLInputElement;
                                                                                if (hiddenInput) {
                                                                                    try {
                                                                                        hiddenInput.showPicker();
                                                                                    } catch (err) {
                                                                                        hiddenInput.focus();
                                                                                        hiddenInput.click();
                                                                                    }
                                                                                }
                                                                            }}
                                                                            className="absolute right-1 text-muted-foreground p-0.5 rounded"
                                                                        >
                                                                            <Clock size={10} />
                                                                        </button>
                                                                        <input
                                                                            type="time"
                                                                            value={slot.start}
                                                                            onChange={e => updateDaySlot(day, idx, 'start', e.target.value)}
                                                                            className="opacity-0 absolute right-0 top-0 w-0 h-0 pointer-events-none"
                                                                        />
                                                                    </div>
                                                                    <span className="text-[10px] text-muted-foreground">to</span>
                                                                    <div className="relative flex-1 flex items-center">
                                                                        <input
                                                                            id={`custom-end-${day}-${idx}`}
                                                                            name={`custom-end-${day}-${idx}`}
                                                                            type="text"
                                                                            placeholder="17:00"
                                                                            value={slot.end}
                                                                            onChange={e => {
                                                                                const formatted = formatTimeInput(e.target.value);
                                                                                updateDaySlot(day, idx, 'end', formatted);
                                                                            }}
                                                                            onBlur={e => {
                                                                                const normalized = normalizeTimeOnBlur(e.target.value);
                                                                                updateDaySlot(day, idx, 'end', normalized);
                                                                            }}
                                                                            className="w-full text-center text-[10px] pl-1 pr-5 py-0.5 h-7 border border-border rounded bg-background text-foreground focus:outline-none"
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            onClick={e => {
                                                                                const hiddenInput = e.currentTarget.parentElement?.querySelector('input[type="time"]') as HTMLInputElement;
                                                                                if (hiddenInput) {
                                                                                    try {
                                                                                        hiddenInput.showPicker();
                                                                                    } catch (err) {
                                                                                        hiddenInput.focus();
                                                                                        hiddenInput.click();
                                                                                    }
                                                                                }
                                                                            }}
                                                                            className="absolute right-1 text-muted-foreground p-0.5 rounded"
                                                                        >
                                                                            <Clock size={10} />
                                                                        </button>
                                                                        <input
                                                                            type="time"
                                                                            value={slot.end}
                                                                            onChange={e => updateDaySlot(day, idx, 'end', e.target.value)}
                                                                            className="opacity-0 absolute right-0 top-0 w-0 h-0 pointer-events-none"
                                                                        />
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeDaySlot(day, idx)}
                                                                        className="text-muted-foreground hover:text-destructive p-0.5 rounded hover:bg-muted"
                                                                    >
                                                                        <X size={12} />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                            <div className="flex items-center justify-between pt-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => addDaySlot(day)}
                                                                    className="text-[10px] text-primary hover:underline flex items-center gap-0.5 font-bold"
                                                                >
                                                                    <Plus size={10} /> Add slot
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setEditingDay(null)}
                                                                    className="text-[10px] bg-primary/10 hover:bg-primary/20 text-primary px-2 py-0.5 rounded font-bold"
                                                                >
                                                                    Done
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Blocked Dates */}
                                <div className="space-y-3">
                                    <div>
                                        <h4 className="text-sm font-bold text-foreground">Blocked Dates</h4>
                                        <p className="text-xs text-muted-foreground">Mark specific dates as fully unavailable (e.g. holidays).</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            id="avail-blocked-date"
                                            name="avail-blocked-date"
                                            type="date"
                                            value={newBlockedDate}
                                            onChange={e => setNewBlockedDate(e.target.value)}
                                            className="flex-1 text-xs px-3 py-1.5 h-9 rounded-lg border border-border bg-background text-foreground [color-scheme:light] dark:[color-scheme:dark]"
                                        />
                                        <Button type="button" size="sm" variant="outline" className="h-9 w-9 p-0 rounded-lg" onClick={addBlockedDate} disabled={!newBlockedDate}>
                                            <Plus size={14} />
                                        </Button>
                                    </div>
                                    {blockedDates.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                                            {blockedDates.map(d => (
                                                <span key={d} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[11px] font-semibold border border-destructive/20">
                                                    {new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    <button type="button" onClick={() => removeBlockedDate(d)} className="hover:opacity-75 ml-0.5">
                                                        <X size={10} />
                                                    </button>
                                                </span>
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
