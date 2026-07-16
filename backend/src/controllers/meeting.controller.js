import Meeting from '../models/meeting.model.js';
import UserAvailability from '../models/userAvailability.model.js';
import Lead from '../models/lead.model.js';
import Candidate from '../models/candidate.model.js';
import User from '../models/user.model.js';
import { sendHRMeetingEmails, sendSchoolMeetingEmails } from '../services/mailer.js';
import { google } from 'googleapis';

const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

if (process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_REFRESH_TOKEN !== 'your_google_refresh_token_here') {
    oAuth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Formats a 24-hour time string like "09:00" to "9:00 AM".
 */
function format24hTimeTo12h(timeStr) {
    if (!timeStr) return '';
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return timeStr;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 === 0 ? 12 : h % 12;
    const displayMin = m.toString().padStart(2, '0');
    return `${displayHour}:${displayMin} ${ampm}`;
}

/**
 * Parses a date-time string as being strictly in the America/New_York (EST/EDT) timezone,
 * returning a standard JS Date object.
 */
function parseESTStringToDate(dateTimeStr) {
    if (!dateTimeStr) return null;
    if (dateTimeStr instanceof Date) return dateTimeStr;
    if (typeof dateTimeStr !== 'string') return new Date(dateTimeStr);
    
    if (dateTimeStr.endsWith('Z') || /([+-]\d{2}:\d{2})$/.test(dateTimeStr)) {
        return new Date(dateTimeStr);
    }
    
    const [datePart, timePart] = dateTimeStr.split('T');
    if (!datePart || !timePart) return new Date(dateTimeStr);
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);

    const testDate = new Date(Date.UTC(year, month - 1, day, hour, minute));

    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour12: false,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric'
    });
    const parts = formatter.formatToParts(testDate);
    const partMap = {};
    parts.forEach(p => { partMap[p.type] = p.value; });

    const nyYear = parseInt(partMap.year, 10);
    const nyMonth = parseInt(partMap.month, 10);
    const nyDay = parseInt(partMap.day, 10);
    const nyHour = parseInt(partMap.hour, 10);
    const nyMin = parseInt(partMap.minute, 10);

    const nyUtc = Date.UTC(nyYear, nyMonth - 1, nyDay, nyHour, nyMin);
    const testUtc = Date.UTC(year, month - 1, day, hour, minute);

    return new Date(testUtc - (nyUtc - testUtc));
}

/**
 * Converts a '09:00' time string to minutes since midnight.
 */
function timeToMinutes(timeStr) {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

/**
 * Checks if a given Date falls inside a user's weekly availability
 * AND doesn't conflict with any existing meeting for that user.
 *
 * Returns: { available: boolean, reason: string | null }
 */
function getESTDateParts(dateInput) {
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
    const partMap = {};
    parts.forEach(p => { partMap[p.type] = p.value; });
    return {
        weekday: partMap.weekday.toLowerCase(),
        year: parseInt(partMap.year, 10),
        month: parseInt(partMap.month, 10),
        day: parseInt(partMap.day, 10),
        hour: parseInt(partMap.hour, 10),
        minute: parseInt(partMap.minute, 10),
    };
}

function formatDateToESTString(dateInput) {
    const parts = getESTDateParts(dateInput);
    const mStr = parts.month.toString().padStart(2, '0');
    const dStr = parts.day.toString().padStart(2, '0');
    return `${parts.year}-${mStr}-${dStr}`;
}

/**
 * Checks if a given Date falls inside a user's weekly availability
 * AND doesn't conflict with any existing meeting for that user.
 *
 * Returns: { available: boolean, reason: string | null }
 */
async function checkSingleAttendee(userId, dateTime, durationMinutes, excludeMeetingId = null) {
    const estParts = getESTDateParts(dateTime);
    const meetingStartMin = estParts.hour * 60 + estParts.minute;
    const meetingEndMin = meetingStartMin + durationMinutes;

    const avail = await UserAvailability.findOne({ user_id: userId });

    if (avail) {
        // 1. Check blocked dates
        const meetingESTDateStr = formatDateToESTString(dateTime);
        const isBlocked = (avail.blocked_dates || []).some(bd => {
            const bdStr = (bd instanceof Date ? bd.toISOString() : new Date(bd).toISOString()).slice(0, 10);
            return bdStr === meetingESTDateStr;
        });

        if (isBlocked) {
            return { available: false, reason: 'This date is marked as unavailable (blocked day).' };
        }

        // 2. Check if new active date range flow is used
        if (avail.date_range_start && avail.date_range_end) {
            const meetingESTDateStr = formatDateToESTString(dateTime);
            if (meetingESTDateStr < avail.date_range_start || meetingESTDateStr > avail.date_range_end) {
                return {
                    available: false,
                    reason: `Outside active date range (${avail.date_range_start} to ${avail.date_range_end}).`
                };
            }

            const override = (avail.custom_schedule || []).find(cd => cd.date === meetingESTDateStr);
            if (!override || !override.enabled) {
                return { available: false, reason: `Unavailable / Closed on date ${meetingESTDateStr}.` };
            }

            const slots = override.slots || [];
            if (slots.length === 0) {
                return { available: false, reason: `No hours set for ${meetingESTDateStr}.` };
            }

            const fitsInSlot = slots.some(slot => {
                const startMin = timeToMinutes(slot.start);
                const endMin = timeToMinutes(slot.end);
                return startMin !== null && endMin !== null && meetingStartMin >= startMin && meetingEndMin <= endMin;
            });

            if (!fitsInSlot) {
                const formattedSlots = slots.map(s => `${format24hTimeTo12h(s.start)} – ${format24hTimeTo12h(s.end)}`).join(', ');
                return {
                    available: false,
                    reason: `Outside available hours (${formattedSlots} on customized date ${meetingESTDateStr}).`
                };
            }
        } else {
            // 3. Legacy Weekly schedule fallback
            const dayName = estParts.weekday;
            const daySchedule = avail.weekly_schedule?.[dayName];

            if (!daySchedule?.enabled) {
                return { available: false, reason: `Not available on ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}s.` };
            }

            // Determine available slots (supporting backward compatibility)
            let slots = [];
            if (daySchedule.slots && daySchedule.slots.length > 0) {
                slots = daySchedule.slots;
            } else if (daySchedule.start && daySchedule.end) {
                slots = [{ start: daySchedule.start, end: daySchedule.end }];
            }

            if (slots.length === 0) {
                return { available: false, reason: `No hours set for ${dayName}.` };
            }

            const fitsInSlot = slots.some(slot => {
                const startMin = timeToMinutes(slot.start);
                const endMin = timeToMinutes(slot.end);
                return startMin !== null && endMin !== null && meetingStartMin >= startMin && meetingEndMin <= endMin;
            });

            if (!fitsInSlot) {
                const formattedSlots = slots.map(s => `${format24hTimeTo12h(s.start)} – ${format24hTimeTo12h(s.end)}`).join(', ');
                return {
                    available: false,
                    reason: `Outside available hours (${formattedSlots} on ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}s).`
                };
            }
        }
    }

    // 3. Check for existing meeting conflicts
    const meetingStart = new Date(dateTime);
    const meetingEnd = new Date(dateTime.getTime() + durationMinutes * 60000);

    const conflictQuery = {
        status: { $in: ['scheduled', 'rescheduled'] },
        internal_attendees: userId,
        ...(excludeMeetingId ? { _id: { $ne: excludeMeetingId } } : {}),
        date_time: { $lt: meetingEnd },
        $expr: {
            $gt: [
                { $add: ['$date_time', { $multiply: ['$duration_minutes', 60000] }] },
                meetingStart
            ]
        }
    };

    // Simpler overlap query: find any meeting for this user where times overlap
    const existingMeetingConflict = await Meeting.findOne(conflictQuery)
        .populate('lead_id', 'name')
        .populate('candidate_id', 'name')
        .populate('candidate_ids', 'name');

    if (existingMeetingConflict) {
        const linkedName = existingMeetingConflict.lead_id?.name || 
            existingMeetingConflict.candidate_id?.name || 
            existingMeetingConflict.candidate_ids?.[0]?.name || 
            'another meeting';
        return {
            available: false,
            reason: `Already has a conflicting meeting: "${existingMeetingConflict.title}" with ${linkedName}.`
        };
    }

    return { available: true, reason: null };
}

/**
 * Synchronizes a meeting to Google Calendar.
 * Handles event creation, updates, and deletion (when canceled or deleted).
 */
async function syncMeetingToGoogleCalendar(meetingId, action) {
    if (!process.env.GOOGLE_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN === 'your_google_refresh_token_here') {
        return;
    }

    try {
        const meeting = await Meeting.findById(meetingId)
            .populate('lead_ids', 'name')
            .populate('lead_id', 'name')
            .populate('candidate_ids', 'name email')
            .populate('candidate_id', 'name email')
            .populate('internal_attendees', 'name email')
            .populate('cc_attendees', 'name email');

        if (!meeting) return;

        const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

        // If action is delete or meeting is canceled, remove from Google Calendar
        if (action === 'delete' || meeting.status === 'canceled') {
            if (meeting.google_event_id) {
                try {
                    await calendar.events.delete({
                        calendarId: 'primary',
                        eventId: meeting.google_event_id,
                        sendUpdates: 'all'
                    });
                    console.log(`✅ Google Calendar event deleted: ${meeting.google_event_id}`);
                } catch (err) {
                    console.error('Google Calendar Event Delete Error:', err.message);
                }
                if (action !== 'delete') {
                    meeting.google_event_id = null;
                    await meeting.save();
                }
            }
            return;
        }

        // Format dates
        const eventStartTime = new Date(meeting.date_time);
        const eventEndTime = new Date(eventStartTime.getTime() + meeting.duration_minutes * 60000);

        // Gather attendees
        const attendees = [];
        const addedEmails = new Set();

        const addAttendee = (email) => {
            if (!email) return;
            const normalized = email.trim().toLowerCase();
            if (normalized && !addedEmails.has(normalized)) {
                addedEmails.add(normalized);
                attendees.push({ email: email.trim() });
            }
        };

        // 1. Internal attendees
        if (meeting.internal_attendees) {
            meeting.internal_attendees.forEach(u => addAttendee(u.email));
        }

        // 2. CC attendees
        if (meeting.cc_attendees) {
            meeting.cc_attendees.forEach(u => addAttendee(u.email));
        }

        // 3. External emails
        if (meeting.external_emails) {
            meeting.external_emails.forEach(email => addAttendee(email));
        }

        // 4. Candidates (for HR meetings)
        if (meeting.category === 'hr') {
            const candidates = (meeting.candidate_ids && meeting.candidate_ids.length > 0)
                ? meeting.candidate_ids
                : (meeting.candidate_id ? [meeting.candidate_id] : []);
            candidates.forEach(c => addAttendee(c.email));
        }

        // 5. School Contacts (for School meetings)
        if (meeting.category === 'school') {
            const leads = (meeting.lead_ids && meeting.lead_ids.length > 0)
                ? meeting.lead_ids
                : (meeting.lead_id ? [meeting.lead_id] : []);
            if (leads.length > 0) {
                const leadIds = leads.map(l => l._id);
                const { Contact } = await import('../models/contact.model.js');
                const contacts = await Contact.find({ lead_id: { $in: leadIds } });
                contacts.forEach(c => addAttendee(c.email));
            }
        }

        // 6. Admin email
        if (process.env.ADMIN_EMAIL) {
            addAttendee(process.env.ADMIN_EMAIL);
        }

        // Description/Notes
        const descriptionParts = [];
        if (meeting.notes) descriptionParts.push(`Notes: ${meeting.notes}`);
        descriptionParts.push(`Category: ${meeting.category === 'hr' ? 'HR Meeting' : 'School Meeting'}`);
        if (meeting.meeting_type === 'online' && meeting.meeting_link) {
            descriptionParts.push(`Zoom / Online Link: ${meeting.meeting_link}`);
        } else if (meeting.meeting_type === 'in_person' && meeting.location) {
            descriptionParts.push(`Location / Address: ${meeting.location}`);
        } else if (meeting.meeting_type === 'phone') {
            descriptionParts.push(`Type: Phone Call`);
        }

        let linkedNames = '';
        if (meeting.category === 'school') {
            const leads = (meeting.lead_ids && meeting.lead_ids.length > 0) ? meeting.lead_ids : (meeting.lead_id ? [meeting.lead_id] : []);
            linkedNames = leads.map(l => l.name).join(', ');
        } else if (meeting.category === 'hr') {
            const candidates = (meeting.candidate_ids && meeting.candidate_ids.length > 0) ? meeting.candidate_ids : (meeting.candidate_id ? [meeting.candidate_id] : []);
            linkedNames = candidates.map(c => c.name).join(', ');
        }

        const summary = meeting.title + (linkedNames ? ` - ${linkedNames}` : '');

        const event = {
            summary,
            location: meeting.meeting_type === 'online' ? meeting.meeting_link : (meeting.meeting_type === 'in_person' ? meeting.location : 'Phone Call'),
            description: descriptionParts.join('\n'),
            start: {
                dateTime: eventStartTime.toISOString(),
                timeZone: 'America/New_York',
            },
            end: {
                dateTime: eventEndTime.toISOString(),
                timeZone: 'America/New_York',
            },
            attendees,
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 30 },
                    { method: 'popup', minutes: 15 },
                ],
            },
        };

        if (meeting.google_event_id) {
            // Update existing event
            await calendar.events.update({
                calendarId: 'primary',
                eventId: meeting.google_event_id,
                resource: event,
                sendUpdates: 'all'
            });
            console.log(`✅ Google Calendar event updated: ${meeting.google_event_id}`);
        } else {
            // Create new event
            const createdEvent = await calendar.events.insert({
                calendarId: 'primary',
                resource: event,
                sendUpdates: 'all'
            });
            meeting.google_event_id = createdEvent.data.id;
            await meeting.save();
            console.log(`✅ Google Calendar event created: ${createdEvent.data.id}`);
        }
    } catch (err) {
        console.error('❌ Google Calendar sync error:', err.message);
    }
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/meetings/check-availability
 * Pre-flight availability check — does NOT create a meeting.
 * Returns per-attendee availability results.
 *
 * Body: { attendee_ids: [userId], date_time, duration_minutes, exclude_meeting_id? }
 */
export const checkAvailability = async (req, res, next) => {
    try {
        const { attendee_ids, date_time, duration_minutes = 30, exclude_meeting_id } = req.body;

        if (!attendee_ids || !attendee_ids.length || !date_time) {
            res.status(400);
            throw new Error('attendee_ids and date_time are required.');
        }

        const dateTime = parseESTStringToDate(date_time);
        const results = {};

        await Promise.all(
            attendee_ids.map(async (userId) => {
                const user = await User.findById(userId).select('name email');
                const check = await checkSingleAttendee(userId, dateTime, duration_minutes, exclude_meeting_id);
                results[userId] = {
                    name: user?.name || 'Unknown',
                    email: user?.email || '',
                    ...check
                };
            })
        );

        const allAvailable = Object.values(results).every(r => r.available);

        res.json({ allAvailable, results });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/meetings/attendees-availability
 * Fetches schedules, blocked dates, and existing meetings for a list of attendees within a date range.
 * Body: { attendee_ids: [userId], start_date: ISO, end_date: ISO }
 */
export const getAttendeesAvailability = async (req, res, next) => {
    try {
        const { attendee_ids, start_date, end_date } = req.body;
        if (!attendee_ids || !attendee_ids.length || !start_date || !end_date) {
            res.status(400);
            throw new Error('attendee_ids, start_date, and end_date are required.');
        }

        const startDate = new Date(start_date);
        const endDate = new Date(end_date);

        // 1. Fetch weekly schedules & blocked dates
        const availabilities = await UserAvailability.find({ user_id: { $in: attendee_ids } });
        const schedules = {};
        for (const userId of attendee_ids) {
            const avail = availabilities.find(a => a.user_id.toString() === userId.toString());
            schedules[userId] = avail ? {
                weekly_schedule: avail.weekly_schedule,
                date_range_start: avail.date_range_start,
                date_range_end: avail.date_range_end,
                custom_schedule: avail.custom_schedule,
                blocked_dates: avail.blocked_dates
            } : {
                weekly_schedule: {
                    monday: { enabled: false },
                    tuesday: { enabled: false },
                    wednesday: { enabled: false },
                    thursday: { enabled: false },
                    friday: { enabled: false },
                    saturday: { enabled: false },
                    sunday: { enabled: false }
                },
                date_range_start: null,
                date_range_end: null,
                custom_schedule: [],
                blocked_dates: []
            };
        }

        // 2. Fetch existing meetings in range
        const meetings = await Meeting.find({
            status: { $in: ['scheduled', 'rescheduled'] },
            internal_attendees: { $in: attendee_ids },
            date_time: { $gte: startDate, $lte: endDate }
        }).select('_id title date_time duration_minutes internal_attendees');

        res.json({ schedules, meetings });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/meetings
 * List meetings, optionally filtered by category, status, date range.
 * Sales reps only see school meetings for their leads.
 */
export const getMeetings = async (req, res, next) => {
    try {
        const { category, status, from, to } = req.query;

        const filter = {};
        if (category) filter.category = category;
        if (status) filter.status = status;
        if (from || to) {
            filter.date_time = {};
            if (from) filter.date_time.$gte = new Date(from);
            if (to) filter.date_time.$lte = new Date(to);
        }

        // Sales reps: scope to meetings where they are an internal attendee
        if (req.currentUserRole === 'sales_rep') {
            filter.internal_attendees = req.user.id;
        }

        const meetings = await Meeting.find(filter)
            .populate('lead_id', 'name telephone')
            .populate('lead_ids', 'name telephone')
            .populate('candidate_id', 'name email applying_for')
            .populate('candidate_ids', 'name email applying_for')
            .populate('internal_attendees', 'name email role')
            .populate('cc_attendees', 'name email')
            .populate('created_by', 'name email')
            .sort({ date_time: 1 });

        res.json(meetings);
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/meetings/counts
 * Returns badge counts: { school: N, hr: N }
 * Used by sidebar badge context.
 */
export const getMeetingCounts = async (req, res, next) => {
    try {
        const baseFilter = { status: { $in: ['scheduled', 'rescheduled'] } };

        let schoolFilter = { ...baseFilter, category: 'school' };
        let hrFilter = { ...baseFilter, category: 'hr' };

        // Sales reps: only meetings they are attending
        if (req.currentUserRole === 'sales_rep') {
            schoolFilter.internal_attendees = req.user.id;
            hrFilter.internal_attendees = req.user.id;
        }

        const [schoolCount, hrCount] = await Promise.all([
            Meeting.countDocuments(schoolFilter),
            Meeting.countDocuments(hrFilter)
        ]);

        res.json({ school: schoolCount, hr: hrCount });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/meetings/:id
 * Get a single meeting's full detail.
 */
export const getMeetingById = async (req, res, next) => {
    try {
        const meeting = await Meeting.findById(req.params.id)
            .populate('lead_id', 'name telephone city')
            .populate('lead_ids', 'name telephone city')
            .populate('candidate_id', 'name email phone applying_for status')
            .populate('candidate_ids', 'name email phone applying_for status')
            .populate('internal_attendees', 'name email role')
            .populate('cc_attendees', 'name email')
            .populate('created_by', 'name email')
            .populate('change_log.by', 'name email');

        if (!meeting) {
            res.status(404);
            throw new Error('Meeting not found.');
        }

        // Access check for sales reps
        if (req.currentUserRole === 'sales_rep') {
            const isAttendee = meeting.internal_attendees.some(a => a._id.toString() === req.user.id);
            if (!isAttendee) {
                res.status(403);
                throw new Error('Access denied. You are not an attendee of this meeting.');
            }
        }

        res.json(meeting);
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/meetings
 * Create a new meeting after running availability check.
 */
export const createMeeting = async (req, res, next) => {
    try {
        const {
            title, category, lead_id, lead_ids: rawLeadIds,
            candidate_id, candidate_ids: rawCandidateIds,
            date_time, duration_minutes = 30,
            internal_attendees = [], cc_attendees = [], external_emails = [],
            notes, force = false,
            meeting_type: rawMeetingType, location = null
        } = req.body;

        const meeting_type = rawMeetingType || (category === 'hr' ? 'online' : 'in_person');

        // Normalize: if lead_ids array provided use it, otherwise fall back to single lead_id
        const lead_ids = Array.isArray(rawLeadIds) && rawLeadIds.length > 0
            ? rawLeadIds
            : (lead_id ? [lead_id] : []);
        const primaryLeadId = lead_ids[0] || null;

        // Normalize: if candidate_ids array provided use it, otherwise fall back to single candidate_id
        const candidate_ids = Array.isArray(rawCandidateIds) && rawCandidateIds.length > 0
            ? rawCandidateIds
            : (candidate_id ? [candidate_id] : []);
        const primaryCandidateId = candidate_ids[0] || null;

        // Validate required fields
        if (!title || !category || !date_time) {
            res.status(400);
            throw new Error('title, category, and date_time are required.');
        }

        if (!['school', 'hr'].includes(category)) {
            res.status(400);
            throw new Error('category must be "school" or "hr".');
        }

        if (category === 'school' && lead_ids.length === 0) {
            res.status(400);
            throw new Error('At least one lead is required for School meetings.');
        }

        // Validate all leads exist
        if (lead_ids.length > 0) {
            for (const lid of lead_ids) {
                const lead = await Lead.findById(lid);
                if (!lead) {
                    res.status(404);
                    throw new Error(`Lead not found: ${lid}`);
                }
                if (req.currentUserRole === 'sales_rep' && lead.assigned_to?.toString() !== req.user.id) {
                    res.status(403);
                    throw new Error('Access denied. You can only schedule meetings for leads assigned to you.');
                }
            }
        }

        const dateTime = parseESTStringToDate(date_time);

        // Run availability check for all internal attendees (unless force=true)
        if (internal_attendees.length > 0 && !force) {
            const conflicts = [];

            await Promise.all(
                internal_attendees.map(async (userId) => {
                    const user = await User.findById(userId).select('name');
                    const check = await checkSingleAttendee(userId, dateTime, duration_minutes);
                    if (!check.available) {
                        conflicts.push({ userId, name: user?.name || userId, reason: check.reason });
                    }
                })
            );

            if (conflicts.length > 0) {
                return res.status(409).json({
                    error: 'Scheduling conflict detected',
                    conflicts
                });
            }
        }

        let meeting_link = null;
        let zoom_start_url = null;
        let zoom_meeting_id = null;

        if (meeting_type === 'online') {
            try {
                // Find emails of all internal attendees to set them as alternative hosts
                const attendeeUsers = await User.find({ _id: { $in: internal_attendees } }).select('email');
                let emails = attendeeUsers.map(u => u.email).filter(Boolean);

                // Also include the creator's email if they have a Zoom account under the same organization
                if (req.user && req.user.email && !emails.includes(req.user.email)) {
                    emails.push(req.user.email);
                }

                const { createZoomMeeting } = await import('../services/zoom.service.js');
                const zoomRes = await createZoomMeeting({
                    title,
                    date_time: dateTime,
                    duration_minutes,
                    alternative_hosts: emails
                });
                meeting_link = zoomRes.join_url;
                zoom_start_url = zoomRes.start_url;
                zoom_meeting_id = zoomRes.id;
            } catch (zoomErr) {
                console.error('Failed to create Zoom meeting, continuing without it:', zoomErr.message);
            }
        }

        // All clear — create the meeting
        const meeting = await Meeting.create({
            title: title.trim(),
            category,
            lead_id: primaryLeadId,
            lead_ids,
            candidate_id: primaryCandidateId,
            candidate_ids,
            date_time: dateTime,
            duration_minutes,
            internal_attendees,
            cc_attendees,
            external_emails,
            notes: notes || '',
            meeting_type,
            meeting_link,
            zoom_start_url,
            zoom_meeting_id,
            location: meeting_type === 'in_person' ? location : null,
            created_by: req.user.id,
            change_log: [{
                action: 'created',
                by: req.user.id,
                at: new Date(),
                note: 'Meeting created.'
            }]
        });

        const populated = await Meeting.findById(meeting._id)
            .populate('lead_id', 'name telephone')
            .populate('lead_ids', 'name telephone')
            .populate('candidate_id', 'name email applying_for')
            .populate('candidate_ids', 'name email applying_for')
            .populate('internal_attendees', 'name email role')
            .populate('cc_attendees', 'name email')
            .populate('created_by', 'name email');

        if (category === 'hr') {
            sendHRMeetingEmails({ meeting: populated, actionType: 'created' }).catch(err => {
                console.error('Failed to trigger HR meeting emails:', err);
            });
        }

        if (category === 'school') {
            sendSchoolMeetingEmails({ meeting: populated, actionType: 'created' }).catch(err => {
                console.error('Failed to trigger School meeting emails:', err);
            });
        }

        // Sync to Google Calendar
        await syncMeetingToGoogleCalendar(meeting._id, 'create');

        // Re-fetch populated meeting to include updated google_event_id
        const finalPopulated = await Meeting.findById(meeting._id)
            .populate('lead_id', 'name telephone')
            .populate('lead_ids', 'name telephone')
            .populate('candidate_id', 'name email applying_for')
            .populate('candidate_ids', 'name email applying_for')
            .populate('internal_attendees', 'name email role')
            .populate('cc_attendees', 'name email')
            .populate('created_by', 'name email');

        res.status(201).json(finalPopulated);
    } catch (err) {
        next(err);
    }
};

/**
 * PUT /api/meetings/:id
 * Update a meeting. Re-runs availability check if date_time or attendees change.
 */
export const updateMeeting = async (req, res, next) => {
    try {
        const meeting = await Meeting.findById(req.params.id);
        if (!meeting) {
            res.status(404);
            throw new Error('Meeting not found.');
        }

        const {
            title, date_time, duration_minutes,
            internal_attendees, cc_attendees, external_emails,
            notes, status, lead_ids: rawUpdateLeadIds,
            candidate_ids: rawUpdateCandidateIds, candidate_id: rawUpdateCandidateId,
            force = false,
            meeting_type, location
        } = req.body;

        // Normalize lead_ids update
        const updateLeadIds = Array.isArray(rawUpdateLeadIds) && rawUpdateLeadIds.length > 0
            ? rawUpdateLeadIds : undefined;

        // Normalize candidate_ids update
        const updateCandidateIds = Array.isArray(rawUpdateCandidateIds)
            ? rawUpdateCandidateIds
            : (rawUpdateCandidateId ? [rawUpdateCandidateId] : undefined);

        const oldStatus = meeting.status;
        const dateTimeChanged = date_time && parseESTStringToDate(date_time).getTime() !== meeting.date_time.getTime();
        const attendeesChanged = internal_attendees &&
            JSON.stringify([...internal_attendees].sort()) !== JSON.stringify([...meeting.internal_attendees.map(a => a.toString())].sort());

        const newDateTime = date_time ? parseESTStringToDate(date_time) : meeting.date_time;
        const newDuration = duration_minutes ?? meeting.duration_minutes;
        const newAttendees = internal_attendees ?? meeting.internal_attendees.map(a => a.toString());

        // Re-run availability check if time or attendees changed
        if ((dateTimeChanged || attendeesChanged) && !force) {
            const conflicts = [];

            await Promise.all(
                newAttendees.map(async (userId) => {
                    const user = await User.findById(userId).select('name');
                    const check = await checkSingleAttendee(userId, newDateTime, newDuration, req.params.id);
                    if (!check.available) {
                        conflicts.push({ userId, name: user?.name || userId, reason: check.reason });
                    }
                })
            );

            if (conflicts.length > 0) {
                return res.status(409).json({
                    error: 'Scheduling conflict detected',
                    conflicts
                });
            }
        }

        // Apply updates
        if (title !== undefined) meeting.title = title.trim();
        if (date_time !== undefined) meeting.date_time = parseESTStringToDate(date_time);
        if (duration_minutes !== undefined) meeting.duration_minutes = duration_minutes;
        if (internal_attendees !== undefined) meeting.internal_attendees = internal_attendees;
        if (cc_attendees !== undefined) meeting.cc_attendees = cc_attendees;
        if (external_emails !== undefined) meeting.external_emails = external_emails;
        if (notes !== undefined) meeting.notes = notes;
        if (updateLeadIds !== undefined) {
            meeting.lead_ids = updateLeadIds;
            meeting.lead_id = updateLeadIds[0] || null;
        }
        if (updateCandidateIds !== undefined) {
            meeting.candidate_ids = updateCandidateIds;
            meeting.candidate_id = updateCandidateIds[0] || null;
        }

        if (status !== undefined && status !== oldStatus) {
            meeting.status = status;
            const logAction = status === 'rescheduled' ? 'rescheduled'
                : status === 'canceled' ? 'canceled'
                : 'status_changed';
            meeting.change_log.push({
                action: logAction,
                by: req.user.id,
                at: new Date(),
                note: `Status changed from ${oldStatus} to ${status}.`
            });
        }

        if (dateTimeChanged) {
            meeting.change_log.push({
                action: 'rescheduled',
                by: req.user.id,
                at: new Date(),
                note: `Rescheduled to ${parseESTStringToDate(date_time).toLocaleString('en-US', { timeZone: 'America/New_York' })}.`
            });
        }

        if (attendeesChanged) {
            meeting.change_log.push({
                action: 'attendee_changed',
                by: req.user.id,
                at: new Date(),
                note: 'Attendee list updated.'
            });
        }

        if (notes !== undefined && notes !== meeting.notes) {
            meeting.change_log.push({
                action: 'notes_updated',
                by: req.user.id,
                at: new Date(),
                note: 'Notes updated.'
            });
        }

        // Apply Zoom Updates
        const oldMeetingType = meeting.meeting_type;
        const oldLocation = meeting.location;
        const oldZoomMeetingId = meeting.zoom_meeting_id;

        const typeChanged = meeting_type !== undefined && meeting_type !== oldMeetingType;
        const locationChanged = location !== undefined && location !== oldLocation;

        if (meeting_type !== undefined) meeting.meeting_type = meeting_type;
        if (location !== undefined) meeting.location = meeting_type === 'in_person' ? location : null;

        const { updateZoomMeeting, createZoomMeeting, deleteZoomMeeting } = await import('../services/zoom.service.js');

        if (meeting.meeting_type === 'online') {
            const attendeeUsers = await User.find({ _id: { $in: newAttendees } }).select('email');
            let emails = attendeeUsers.map(u => u.email).filter(Boolean);
            if (req.user && req.user.email && !emails.includes(req.user.email)) {
                emails.push(req.user.email);
            }

            if (oldMeetingType === 'online' && oldZoomMeetingId) {
                const start_time = date_time ? parseESTStringToDate(date_time) : meeting.date_time;
                const duration = duration_minutes ?? meeting.duration_minutes;
                const zoomTitle = title ? title.trim() : meeting.title;
                updateZoomMeeting(oldZoomMeetingId, {
                    title: zoomTitle,
                    date_time: start_time,
                    duration_minutes: duration,
                    alternative_hosts: emails
                }).catch(err => {
                    console.error('Failed to update meeting in Zoom:', err);
                });
            } else if (oldMeetingType !== 'online' || !oldZoomMeetingId) {
                try {
                    const start_time = date_time ? parseESTStringToDate(date_time) : meeting.date_time;
                    const duration = duration_minutes ?? meeting.duration_minutes;
                    const zoomTitle = title ? title.trim() : meeting.title;
                    const zoomRes = await createZoomMeeting({
                        title: zoomTitle,
                        date_time: start_time,
                        duration_minutes: duration,
                        alternative_hosts: emails
                    });
                    meeting.meeting_link = zoomRes.join_url;
                    meeting.zoom_start_url = zoomRes.start_url;
                    meeting.zoom_meeting_id = zoomRes.id;
                } catch (zoomErr) {
                    console.error('Failed to create Zoom meeting for updated meeting:', zoomErr.message);
                }
            }
        } else {
            if (oldZoomMeetingId) {
                deleteZoomMeeting(oldZoomMeetingId).catch(err => {
                    console.error('Failed to delete Zoom meeting:', err);
                });
                meeting.meeting_link = null;
                meeting.zoom_start_url = null;
                meeting.zoom_meeting_id = null;
            }
        }

        if (status === 'canceled' && oldZoomMeetingId) {
            deleteZoomMeeting(oldZoomMeetingId).catch(err => {
                console.error('Failed to delete Zoom meeting on cancel:', err);
            });
            meeting.meeting_link = null;
            meeting.zoom_meeting_id = null;
        }

        await meeting.save();

        const populated = await Meeting.findById(meeting._id)
            .populate('lead_id', 'name telephone')
            .populate('lead_ids', 'name telephone')
            .populate('candidate_id', 'name email applying_for')
            .populate('candidate_ids', 'name email applying_for')
            .populate('internal_attendees', 'name email role')
            .populate('cc_attendees', 'name email')
            .populate('created_by', 'name email')
            .populate('change_log.by', 'name email');

        if (populated.category === 'hr') {
            if (status === 'canceled' || dateTimeChanged || typeChanged || locationChanged) {
                const actionType = status === 'canceled' ? 'canceled' : 'rescheduled';
                sendHRMeetingEmails({ meeting: populated, actionType }).catch(err => {
                    console.error('Failed to trigger HR meeting update emails:', err);
                });
            }
        }

        if (populated.category === 'school') {
            if (status === 'canceled' || dateTimeChanged || typeChanged || locationChanged) {
                const actionType = status === 'canceled' ? 'canceled' : 'rescheduled';
                sendSchoolMeetingEmails({ meeting: populated, actionType }).catch(err => {
                    console.error('Failed to trigger School meeting update emails:', err);
                });
            }
        }

        // Sync to Google Calendar
        await syncMeetingToGoogleCalendar(meeting._id, 'update');

        // Re-fetch updated meeting to include final google_event_id and change log details
        const finalPopulated = await Meeting.findById(meeting._id)
            .populate('lead_id', 'name telephone')
            .populate('lead_ids', 'name telephone')
            .populate('candidate_id', 'name email applying_for')
            .populate('candidate_ids', 'name email applying_for')
            .populate('internal_attendees', 'name email role')
            .populate('cc_attendees', 'name email')
            .populate('created_by', 'name email')
            .populate('change_log.by', 'name email');

        res.json(finalPopulated);
    } catch (err) {
        next(err);
    }
};

/**
 * DELETE /api/meetings/:id
 * Permanently delete a meeting. Admin and Manager only.
 */
export const deleteMeeting = async (req, res, next) => {
    try {
        const meeting = await Meeting.findById(req.params.id);
        if (!meeting) {
            res.status(404);
            throw new Error('Meeting not found.');
        }

        const populated = await Meeting.findById(req.params.id)
            .populate('lead_id', 'name telephone')
            .populate('lead_ids', 'name telephone')
            .populate('candidate_id', 'name email applying_for')
            .populate('candidate_ids', 'name email applying_for')
            .populate('internal_attendees', 'name email role')
            .populate('cc_attendees', 'name email')
            .populate('created_by', 'name email');

        if (populated) {
            if (populated.category === 'hr') {
                sendHRMeetingEmails({ meeting: populated, actionType: 'canceled' }).catch(err => {
                    console.error('Failed to trigger HR meeting deletion emails:', err);
                });
            } else if (populated.category === 'school') {
                sendSchoolMeetingEmails({ meeting: populated, actionType: 'canceled' }).catch(err => {
                    console.error('Failed to trigger School meeting deletion emails:', err);
                });
            }
        }

        if (meeting.zoom_meeting_id) {
            const { deleteZoomMeeting } = await import('../services/zoom.service.js');
            deleteZoomMeeting(meeting.zoom_meeting_id).catch(err => {
                console.error('Failed to delete Zoom meeting on deletion:', err);
            });
        }

        await syncMeetingToGoogleCalendar(meeting._id, 'delete');
        await Meeting.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Meeting deleted successfully.' });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/meetings/candidates
 * List all candidates for the HR meeting dropdown.
 */
export const getCandidates = async (req, res, next) => {
    try {
        const candidates = await Candidate.find()
            .select('name email phone applying_for status notes createdAt')
            .sort({ createdAt: -1 });
        res.json(candidates);
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/meetings/candidates
 * Create a new candidate record.
 */
export const createCandidate = async (req, res, next) => {
    try {
        const { name, email, phone, applying_for, notes } = req.body;
        if (!name) {
            res.status(400);
            throw new Error('Candidate name is required.');
        }
        const candidate = await Candidate.create({
            name: name.trim(),
            email: email?.trim() || '',
            phone: phone?.trim() || '',
            applying_for: applying_for?.trim() || '',
            notes: notes || '',
            created_by: req.user.id
        });
        res.status(201).json(candidate);
    } catch (err) {
        next(err);
    }
};

/**
 * PUT /api/meetings/candidates/:id
 * Update candidate details. Admin and manager only.
 */
export const updateCandidate = async (req, res, next) => {
    try {
        const { name, email, phone, applying_for, status, notes } = req.body;
        const candidate = await Candidate.findById(req.params.id);
        if (!candidate) {
            res.status(404);
            throw new Error('Candidate not found.');
        }
        if (name !== undefined) candidate.name = name.trim();
        if (email !== undefined) candidate.email = email.trim();
        if (phone !== undefined) candidate.phone = phone.trim();
        if (applying_for !== undefined) candidate.applying_for = applying_for.trim();
        if (status !== undefined) candidate.status = status;
        if (notes !== undefined) candidate.notes = notes || '';

        await candidate.save();
        res.json(candidate);
    } catch (err) {
        next(err);
    }
};

/**
 * DELETE /api/meetings/candidates/:id
 * Delete candidate. Admin and manager only.
 */
export const deleteCandidate = async (req, res, next) => {
    try {
        const candidate = await Candidate.findByIdAndDelete(req.params.id);
        if (!candidate) {
            res.status(404);
            throw new Error('Candidate not found.');
        }
        res.json({ success: true, message: 'Candidate deleted successfully.' });
    } catch (err) {
        next(err);
    }
};
