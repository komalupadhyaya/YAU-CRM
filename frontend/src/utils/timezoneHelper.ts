export interface ESTParts {
    weekday: string; // 'monday', 'tuesday', etc.
    year: number;
    month: number; // 1-12
    day: number;
    hour: number; // 0-23
    minute: number; // 0-59
}

export function getESTDateParts(dateInput: Date | string | number): ESTParts {
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?)?$/.test(dateInput)) {
        const parts = dateInput.split('T');
        const datePart = parts[0];
        const timePart = parts[1] || '00:00';
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute] = timePart.split(':').map(Number);
        if (!isNaN(year) && !isNaN(month) && !isNaN(day) && !isNaN(hour) && !isNaN(minute)) {
            const dateObj = new Date(year, month - 1, day, hour, minute);
            const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
            return {
                weekday,
                year,
                month,
                day,
                hour,
                minute
            };
        }
    }

    const date = new Date(dateInput);
    if (isNaN(date.getTime())) {
        return { weekday: 'monday', year: 2026, month: 1, day: 1, hour: 9, minute: 0 };
    }
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        weekday: 'long',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
    });
    const parts = formatter.formatToParts(date);
    const partMap: Record<string, string> = {};
    parts.forEach(p => { partMap[p.type] = p.value; });
    
    // weekday is long (e.g. 'Monday') -> lowercase 'monday'
    // hour is 'numeric' (e.g. '13')
    // minute is 'numeric' (e.g. '5')
    return {
        weekday: partMap.weekday.toLowerCase(),
        year: parseInt(partMap.year, 10),
        month: parseInt(partMap.month, 10),
        day: parseInt(partMap.day, 10),
        hour: parseInt(partMap.hour, 10),
        minute: parseInt(partMap.minute, 10),
    };
}

export function formatDateToESTString(dateInput: Date | string | number): string {
    const parts = getESTDateParts(dateInput);
    const mStr = parts.month.toString().padStart(2, '0');
    const dStr = parts.day.toString().padStart(2, '0');
    return `${parts.year}-${mStr}-${dStr}`;
}

export function timeToMinutes(timeStr: string): number {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 === 0 ? 12 : h % 12;
    const displayMin = m.toString().padStart(2, '0');
    return `${displayHour}:${displayMin} ${ampm}`;
}

export function format24hTimeTo12h(timeStr: string): string {
    if (!timeStr) return '';
    return minutesToTime(timeToMinutes(timeStr));
}

export function minutesTo24hString(mins: number): string {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
}

/**
 * Takes a naive "YYYY-MM-DDTHH:mm" string that the user entered treating it as
 * America/New_York (Eastern) time, and returns the correct UTC ISO-8601 string.
 *
 * Example: "2026-06-25T10:00" (user means 10:00 AM Eastern)
 *   → During EDT (UTC-4):  "2026-06-25T14:00:00.000Z"
 *   → During EST (UTC-5):  "2026-06-25T15:00:00.000Z"
 */
export function localESTToUTCIso(naiveLocalStr: string): string {
    if (!naiveLocalStr) return '';
    // Parse the parts directly to avoid browser's own local-TZ interpretation
    const [datePart, timePart = '00:00'] = naiveLocalStr.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return '';

    // Build an ISO string that the Intl API will interpret correctly for NY:
    // We use a trick: format a reference UTC instant in NY time and binary-search
    // for the offset. Simpler: use the known offset from Intl at a nearby date.
    const NY_TZ = 'America/New_York';

    // Create a UTC Date at midnight of the selected day, then use Intl to find
    // what offset NY is on that day.
    const utcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0);
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: NY_TZ,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
    });
    const refParts = formatter.formatToParts(new Date(utcMidnight));
    const pm: Record<string, number> = {};
    refParts.forEach(p => { if (p.type !== 'literal') pm[p.type] = parseInt(p.value, 10); });
    // NY offset (in minutes) relative to UTC at that moment
    // NY midnight in UTC vs local: the Intl formatter shows NY hour for UTC midnight
    // offset = NY_hour_at_UTC_midnight * 60 (this is how far ahead NY is from UTC, negative means behind)
    // NY is always behind UTC, e.g. EDT = UTC-4 means NY_hour = UTC_hour - 4
    const nyHourAtUtcMidnight = pm.hour === 24 ? 0 : pm.hour;
    // Correct offset: UTC - NY in minutes.
    // e.g. EDT (UTC-4): UTC 00:00 = NY 20:00 (prev evening), so offset = (0 - 20 + 24)*60 = 240 min
    // e.g. EST (UTC-5): UTC 00:00 = NY 19:00 (prev evening), so offset = (0 - 19 + 24)*60 = 300 min
    const offsetMinutes = ((0 - nyHourAtUtcMidnight + 24) % 24) * 60 - (pm.minute || 0);

    // NY local time in minutes from midnight
    const nyMinutesFromMidnight = hour * 60 + minute;
    // UTC = NY local + offset
    const utcMinutesFromMidnight = nyMinutesFromMidnight + offsetMinutes;

    const utcMs = utcMidnight + utcMinutesFromMidnight * 60000;

    return new Date(utcMs).toISOString();
}

/**
 * Takes a UTC ISO string (from the backend/DB) and formats it as Eastern time
 * for display in the UI.
 * e.g. "2026-06-25T14:00:00.000Z" → "Jun 25, 2026, 10:00 AM"
 */
export function formatAsEST(
    isoStr: string | Date | undefined | null,
    opts?: Intl.DateTimeFormatOptions
): string {
    if (!isoStr) return '';
    const date = new Date(isoStr as string);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        ...(opts ?? {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        }),
    });
}

/**
 * Takes a UTC ISO string and returns a naive "YYYY-MM-DDTHH:mm" string
 * representing the same instant in Eastern time — suitable for feeding
 * back into <DateTimePicker value={...} />.
 */
export function toESTDateTimeString(dateOrStr: string | Date | undefined | null): string {
    if (!dateOrStr) return '';
    const date = new Date(dateOrStr as string);
    if (isNaN(date.getTime())) return '';

    const parts = getESTDateParts(dateOrStr);
    const mStr = parts.month.toString().padStart(2, '0');
    const dStr = parts.day.toString().padStart(2, '0');
    const hStr = parts.hour.toString().padStart(2, '0');
    const minStr = parts.minute.toString().padStart(2, '0');
    return `${parts.year}-${mStr}-${dStr}T${hStr}:${minStr}`;
}

export function toESTDate(dateInput: Date | string | number | undefined | null): Date {
    if (!dateInput) return new Date();
    const parts = getESTDateParts(dateInput);
    return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
}
