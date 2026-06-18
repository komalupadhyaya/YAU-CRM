import { useEffect, useState } from "react";
import api from "../api/api";
import {
    CalendarDays,
    Loader2,
    X,
    Plus,
    Clock,
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
    const [blockedDates, setBlockedDates] = useState<string[]>([]); // ISO date strings
    const [newBlockedDate, setNewBlockedDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

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
            })
            .catch(() => { setSchedule(defaultSchedule()); setBlockedDates([]); })
            .finally(() => setLoading(false));
    }, [user, open]);

    const toggleDay = (day: Day) => setSchedule(prev => {
        const currentlyEnabled = prev[day].enabled;
        const newSlots = !currentlyEnabled && (!prev[day].slots || prev[day].slots.length === 0)
            ? [{ start: '09:00', end: '17:00' }]
            : prev[day].slots;

        return {
            ...prev,
            [day]: {
                ...prev[day],
                enabled: !currentlyEnabled,
                slots: newSlots
            }
        };
    });

    const addSlot = (day: Day) => setSchedule(prev => {
        const slots = prev[day].slots || [];
        return {
            ...prev,
            [day]: {
                ...prev[day],
                slots: [...slots, { start: '', end: '' }]
            }
        };
    });

    const removeSlot = (day: Day, index: number) => setSchedule(prev => {
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

    const updateSlot = (day: Day, index: number, field: 'start' | 'end', value: string) => setSchedule(prev => {
        const slots = (prev[day].slots || []).map((s, i) => i === index ? { ...s, [field]: value } : s);
        return {
            ...prev,
            [day]: {
                ...prev[day],
                slots
            }
        };
    });

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
                    toast.error(`Please add at least one time slot for ${day.charAt(0).toUpperCase() + day.slice(1)} or disable it.`);
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
            <DialogContent className="sm:max-w-lg p-0 overflow-hidden flex flex-col max-h-[90vh]">
                <DialogHeader className="p-6 pb-4 border-b border-border">
                    <DialogTitle className="flex items-center gap-2 text-foreground">
                        <CalendarDays size={16} className="text-primary" />
                        Availability — {user.name || user.username}
                    </DialogTitle>
                    <DialogDescription>Set weekly working hours and blocked dates for meeting scheduling.</DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 size={24} className="animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {/* Weekly schedule */}
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Weekly Schedule</p>
                                <div className="space-y-2">
                                    {DAYS.map(day => (
                                        <div key={day} className={`flex items-start gap-3 p-2.5 rounded-lg border transition-colors ${schedule[day].enabled ? 'border-primary/30 bg-primary/5' : 'border-border bg-background'}`}>
                                            <button
                                                type="button"
                                                onClick={() => toggleDay(day)}
                                                className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors mt-1
                                                    ${schedule[day].enabled ? 'bg-primary border-primary' : 'border-border hover:border-primary/50'}`}
                                            >
                                                {schedule[day].enabled && <X size={10} className="text-primary-foreground" />}
                                            </button>
                                            <span className="text-sm font-medium w-24 capitalize shrink-0 text-foreground mt-0.5">{day}</span>
                                            {schedule[day].enabled ? (
                                                <div className="flex-1 space-y-2">
                                                    {(schedule[day].slots || []).map((slot, index) => (
                                                        <div key={index} className="flex items-center gap-2">
                                                            <div className="relative flex-1 flex items-center">
                                                                <input
                                                                    type="text"
                                                                    placeholder="09:00"
                                                                    value={slot.start}
                                                                    onChange={e => {
                                                                        const formatted = formatTimeInput(e.target.value);
                                                                        updateSlot(day, index, 'start', formatted);
                                                                    }}
                                                                    onBlur={e => {
                                                                        const normalized = normalizeTimeOnBlur(e.target.value);
                                                                        updateSlot(day, index, 'start', normalized);
                                                                    }}
                                                                    className="w-full text-center text-xs pl-2 pr-7 py-1 rounded border border-border bg-background text-foreground"
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
                                                                    className="absolute right-1.5 text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                                                                >
                                                                    <Clock size={12} />
                                                                </button>
                                                                <input
                                                                    type="time"
                                                                    value={slot.start}
                                                                    onChange={e => {
                                                                        updateSlot(day, index, 'start', e.target.value);
                                                                    }}
                                                                    className="opacity-0 absolute right-0 top-0 w-0 h-0 pointer-events-none"
                                                                />
                                                            </div>
                                                            <span className="text-xs text-muted-foreground shrink-0">to</span>
                                                            <div className="relative flex-1 flex items-center">
                                                                <input
                                                                    type="text"
                                                                    placeholder="17:00"
                                                                    value={slot.end}
                                                                    onChange={e => {
                                                                        const formatted = formatTimeInput(e.target.value);
                                                                        updateSlot(day, index, 'end', formatted);
                                                                    }}
                                                                    onBlur={e => {
                                                                        const normalized = normalizeTimeOnBlur(e.target.value);
                                                                        updateSlot(day, index, 'end', normalized);
                                                                    }}
                                                                    className="w-full text-center text-xs pl-2 pr-7 py-1 rounded border border-border bg-background text-foreground"
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
                                                                    className="absolute right-1.5 text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                                                                >
                                                                    <Clock size={12} />
                                                                </button>
                                                                <input
                                                                    type="time"
                                                                    value={slot.end}
                                                                    onChange={e => {
                                                                        updateSlot(day, index, 'end', e.target.value);
                                                                    }}
                                                                    className="opacity-0 absolute right-0 top-0 w-0 h-0 pointer-events-none"
                                                                />
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => removeSlot(day, index)}
                                                                className="text-muted-foreground hover:text-destructive shrink-0 p-1 rounded hover:bg-muted"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        onClick={() => addSlot(day)}
                                                        className="text-xs text-primary hover:underline flex items-center gap-1 font-medium pt-1"
                                                    >
                                                        <Plus size={12} /> Add time slot
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground mt-0.5">Not available</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Blocked dates */}
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Blocked Dates</p>
                                <p className="text-[11px] text-muted-foreground mb-2.5">Mark specific dates as fully unavailable (e.g. vacation, sick leave).</p>
                                <div className="flex gap-2">
                                    <input
                                        type="date"
                                        value={newBlockedDate}
                                        onChange={e => setNewBlockedDate(e.target.value)}
                                        className="flex-1 text-sm px-3 py-2 rounded-lg border border-border bg-background text-foreground [color-scheme:light] dark:[color-scheme:dark]"
                                    />
                                    <Button type="button" size="sm" variant="outline" onClick={addBlockedDate} disabled={!newBlockedDate}>
                                        <Plus size={14} />
                                    </Button>
                                </div>
                                {blockedDates.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                                        {blockedDates.map(d => (
                                            <span key={d} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-destructive/10 text-destructive text-xs border border-destructive/20">
                                                {new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                <button type="button" onClick={() => removeBlockedDate(d)} className="hover:opacity-70 ml-0.5">
                                                    <X size={10} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
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
