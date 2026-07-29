import mongoose from 'mongoose';
import Followup from '../models/followup.model.js';
import Task from '../models/tasks.model.js';
import Lead from '../models/lead.model.js';
import Contact from '../models/contact.model.js';
import Note from '../models/note.model.js';
import Candidate from '../models/candidate.model.js';
import User from '../models/user.model.js';
import { google } from 'googleapis';

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

if (process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_REFRESH_TOKEN !== 'your_google_refresh_token_here') {
  oAuth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
}

export const createFollowup = async (req, res, next) => {
    try {
        const { title, date_time, type, notes, assigned_user, priority, contact_id, cc_emails, force, send_invite } = req.body;
        
        if (!date_time) {
            res.status(400);
            throw new Error('date_time is required');
        }

        // Sales Rep lead assignment check
        const lead = await Lead.findById(req.params.schoolId).select('assigned_to name');
        if (!lead) {
            res.status(404);
            throw new Error('Lead not found');
        }
        if (req.currentUserRole === 'sales_rep' && (!lead.assigned_to || lead.assigned_to.toString() !== req.user.id)) {
            res.status(403);
            throw new Error('Access denied. You can only create followups for leads assigned to you.');
        }

        // Handle CC emails: convert comma string to array if needed
        let ccArray = [];
        if (Array.isArray(cc_emails)) {
            ccArray = cc_emails;
        } else if (typeof cc_emails === 'string' && cc_emails.trim()) {
            ccArray = cc_emails.split(',').map(e => e.trim()).filter(Boolean);
        }

        // TIER 2: Google Calendar Integration - CHECK FOR CONFLICTS FIRST (Section 2D Requirement)
        if (process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_REFRESH_TOKEN !== 'your_google_refresh_token_here') {
            try {
                const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
                
                const eventStartTime = new Date(date_time);
                const eventEndTime = new Date(eventStartTime.getTime() + 30 * 60000); // 30 min duration
                
                if (!force) {
                    const conflicts = await calendar.events.list({
                        calendarId: 'primary',
                        timeMin: eventStartTime.toISOString(),
                        timeMax: eventEndTime.toISOString(),
                        singleEvents: true,
                    });

                    if (conflicts.data.items && conflicts.data.items.length > 0) {
                        return res.status(409).json({
                            error: 'Conflict detected',
                            conflicts: conflicts.data.items.map(item => ({
                                summary: item.summary,
                                start: item.start.dateTime || item.start.date,
                                end: item.end.dateTime || item.end.date
                            }))
                        });
                    }
                }
            } catch (err) {
                console.error('Google Calendar Conflict Check Error:', err);
                // Continue if error is just about auth/etc, but if it's a real logic error we might want to know
            }
        }

        // ONLY NOW create database records
        if (type && type.toLowerCase() === 'task') {
            let assignedToId = req.user.id;
            if (assigned_user && assigned_user !== 'self') {
                const user = await User.findOne({
                    $or: [
                        { username: assigned_user },
                        { email: assigned_user },
                        { name: assigned_user }
                    ]
                });
                if (user) {
                    assignedToId = user._id;
                }
            }

            const taskTitle = title || notes || `Task for ${lead.name}`;

            const task = await Task.create({
                title: taskTitle,
                description: notes || '',
                status: 'pending',
                priority: (priority || 'medium').toLowerCase(),
                dueDate: new Date(date_time),
                assignedTo: assignedToId,
                createdBy: req.user.id,
                lead_id: req.params.schoolId
            });

            // Log to activity feed (Section 2D Requirement)
            await Note.create({
                lead_id: req.params.schoolId,
                type: 'note',
                content: `Created Task: ${taskTitle}\nDue Date: ${new Date(date_time).toLocaleString()}${notes ? `\nNotes: ${notes}` : ''}`,
                metadata: { task_id: task._id, date_time, type: 'Task', notes }
            });

            // Google Calendar integration for Task
            if (process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_REFRESH_TOKEN !== 'your_google_refresh_token_here') {
                try {
                    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
                    
                    const eventStartTime = new Date(date_time);
                    const eventEndTime = new Date(eventStartTime.getTime() + 30 * 60000); // 30 min duration
                    
                    const attendees = [];
                    
                    ccArray.forEach(email => {
                        attendees.push({ email });
                    });

                    if (process.env.ADMIN_EMAIL) {
                        attendees.push({ email: process.env.ADMIN_EMAIL });
                    }

                    const event = {
                        summary: `Follow-up (Task): ${lead?.name || 'Lead'}`,
                        description: `Priority: ${priority}\nNotes: ${notes}${ccArray.length > 0 ? `\n\nCC Recipients: ${ccArray.join(', ')}` : ''}`,
                        start: {
                            dateTime: eventStartTime.toISOString(),
                            timeZone: 'America/New_York',
                        },
                        end: {
                            dateTime: eventEndTime.toISOString(),
                            timeZone: 'America/New_York',
                        },
                        attendees: attendees,
                        reminders: {
                            useDefault: false,
                            overrides: [
                                { method: 'email', minutes: 30 },
                                { method: 'popup', minutes: 15 },
                            ],
                        },
                    };

                    const createdEvent = await calendar.events.insert({
                        calendarId: 'primary',
                        resource: event,
                        sendUpdates: 'none',
                    });

                    task.google_event_id = createdEvent.data.id;
                    await task.save();

                } catch (calErr) {
                    console.error("Google Calendar Error for Task:", calErr.message);
                }
            }

            return res.json(task);
        }

        const fu = await Followup.create({
            lead_id: req.params.schoolId,
            title: title || '',
            date_time: new Date(date_time),
            type: type || 'Task',
            notes: notes || '',
            assigned_user: assigned_user || null,
            priority: priority || null,
            cc_emails: ccArray,
            created_by: req.user.id,
            send_invite: send_invite || false
        });

        // Log to activity feed (Section 2D Requirement)
        await Note.create({
            lead_id: req.params.schoolId,
            type: type === 'Meeting' ? 'meeting' : 'note',
            content: `Scheduled ${type}: ${new Date(date_time).toLocaleString()}${notes ? `\nNotes: ${notes}` : ''}${ccArray.length > 0 ? `\nCC: ${ccArray.join(', ')}` : ''}`,
            metadata: { followup_id: fu._id, date_time, type, notes, cc_emails: ccArray }
        });

        // TIER 2: Google Calendar Integration - CREATE EVENT
        // Meetings ALWAYS get a calendar event (they are real meeting invites).
        // Other follow-up types only sync when a priority has been selected.
        const shouldCreateCalendarEvent = type === 'Meeting' || priority;
        if (shouldCreateCalendarEvent && process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_REFRESH_TOKEN !== 'your_google_refresh_token_here') {
            try {
                const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
                
                const eventStartTime = new Date(date_time);
                const eventEndTime = new Date(eventStartTime.getTime() + 30 * 60000); // 30 min duration
                const leadInfo = await Lead.findById(req.params.schoolId);
                
                const attendees = [];

                let clientEmail = null;
                if (fu.send_invite) {
                    const primaryContact = await Contact.findOne({ lead_id: req.params.schoolId, is_primary: true });
                    if (primaryContact?.email) {
                        clientEmail = primaryContact.email;
                    } else if (contact_id) {
                        const contactInfo = await Contact.findById(contact_id);
                        clientEmail = contactInfo?.email;
                    }
                    if (clientEmail) {
                        attendees.push({ email: clientEmail });
                    }
                }
                
                // Add CC emails as attendees
                ccArray.forEach(email => {
                    attendees.push({ email });
                });

                // We add the admin email as an attendee to ensure they are on the list, 
                // though being the 'primary' calendar owner usually handles this.
                if (process.env.ADMIN_EMAIL) {
                    attendees.push({ email: process.env.ADMIN_EMAIL });
                }

                // Add assigned user email as an attendee
                if (leadInfo?.assigned_to) {
                    const assignedUser = await User.findById(leadInfo.assigned_to);
                    if (assignedUser?.email) {
                        const emailLower = assignedUser.email.toLowerCase();
                        if (
                            (!clientEmail || clientEmail.toLowerCase() !== emailLower) &&
                            (!process.env.ADMIN_EMAIL || process.env.ADMIN_EMAIL.toLowerCase() !== emailLower) &&
                            !ccArray.some(e => e.toLowerCase() === emailLower)
                        ) {
                            attendees.push({ email: assignedUser.email });
                        }
                    }
                }

                const descriptionParts = [];
                if (priority) descriptionParts.push(`Priority: ${priority}`);
                if (notes) descriptionParts.push(`Notes: ${notes}`);
                if (ccArray.length > 0) descriptionParts.push(`\nCC Recipients: ${ccArray.join(', ')}`);

                const event = {
                    summary: title ? `${title} (${type}) - ${leadInfo?.name || 'Lead'}` : `Follow-up (${type}): ${leadInfo?.name || 'Lead'}`,
                    description: descriptionParts.join('\n'),
                    start: {
                        dateTime: eventStartTime.toISOString(),
                        timeZone: 'America/New_York',
                    },
                    end: {
                        dateTime: eventEndTime.toISOString(),
                        timeZone: 'America/New_York',
                    },
                    attendees: attendees,
                    reminders: {
                        useDefault: false,
                        overrides: [
                            { method: 'email', minutes: 30 },
                            { method: 'popup', minutes: 15 },
                        ],
                    },
                };

                const createdEvent = await calendar.events.insert({
                    calendarId: 'primary',
                    resource: event,
                    sendUpdates: type === 'Meeting' ? 'all' : 'none',
                });

                fu.google_event_id = createdEvent.data.id;
                await fu.save();

            } catch (calErr) {
                // Non-fatal: log the error but still return the saved follow-up record
                console.error("Google Calendar Error:", calErr.message);
            }
        }


        res.json(fu);
    } catch (err) {
        next(err);
    }
};

export const completeFollowup = async (req, res, next) => {
    try {
        const fu = await Followup.findById(req.params.id);
        if (!fu) {
            res.status(404);
            throw new Error('Follow-up not found');
        }

        // Sales Rep lead assignment check
        const lead = await Lead.findById(fu.lead_id).select('assigned_to');
        if (req.currentUserRole === 'sales_rep' && (!lead || !lead.assigned_to || lead.assigned_to.toString() !== req.user.id)) {
            res.status(403);
            throw new Error('Access denied. You can only complete followups for leads assigned to you.');
        }

        fu.status = 'done';
        fu.completed_at = new Date();
        await fu.save();

        // Auto update last_contacted
        if (lead) {
            lead.last_contacted = new Date();
            await lead.save();
        }

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

export const getFollowupsBySchool = async (req, res, next) => {
    try {
        const lead = await Lead.findById(req.params.schoolId).select('assigned_to');
        if (!lead) {
            res.status(404);
            throw new Error('Lead not found');
        }
        if (req.currentUserRole === 'sales_rep' && (!lead.assigned_to || lead.assigned_to.toString() !== req.user.id)) {
            res.status(403);
            throw new Error('Access denied. This lead is not assigned to you.');
        }

        const followups = await Followup.find({ lead_id: req.params.schoolId })
            .populate({
                path: 'lead_id',
                select: 'name telephone campaign_id',
                populate: { path: 'campaign_id', select: 'name' }
            })
            .sort({ date_time: 1 });

        const flatFollowups = followups.map(f => {
            const data = f.toJSON();
            return {
                ...data,
                lead_name: data.lead_id?.name, // school_name -> lead_name
                telephone: data.lead_id?.telephone,
                campaign_name: data.lead_id?.campaign_id?.name
            };
        });

        res.json(flatFollowups);
    } catch (err) {
        next(err);
    }
};

export const getGroupedFollowups = async (req, res, next) => {
    try {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

        const { campaignId, schoolId } = req.query;

        // Base match: only pending follow-ups
        const matchStage = { status: 'pending' };

        if (schoolId && schoolId.match(/^[0-9a-fA-F]{24}$/)) {
            matchStage.lead_id = new mongoose.Types.ObjectId(schoolId);
        }

        let dbUser = null;
        if (req.currentUserRole === 'sales_rep') {
            dbUser = await User.findById(req.user.id).lean();
        }

        const pipeline = [
            { $match: matchStage },
            // Join lead info
            {
                $lookup: {
                    from: 'leads',
                    localField: 'lead_id',
                    foreignField: '_id',
                    as: 'lead'
                }
            },
            {
                $unwind: {
                    path: '$lead',
                    preserveNullAndEmptyArrays: true
                }
            },
            // Join candidate info
            {
                $lookup: {
                    from: 'candidates',
                    localField: 'candidate_id',
                    foreignField: '_id',
                    as: 'candidate'
                }
            },
            {
                $unwind: {
                    path: '$candidate',
                    preserveNullAndEmptyArrays: true
                }
            },
            // Optional sales_rep filter
            ...(req.currentUserRole === 'sales_rep' && dbUser ? [
                {
                    $match: {
                        $or: [
                            // 1. Lead is assigned to the sales rep
                            { 'lead.assigned_to': dbUser._id },
                            // 2. Follow-up is explicitly assigned to them
                            { assigned_user: { $in: [dbUser.username, dbUser.email, dbUser.name, dbUser._id.toString()] } },
                            // 3. Follow-up was created by them and has no specific assignment (or "self")
                            {
                                $and: [
                                    { created_by: dbUser._id },
                                    { $or: [ { assigned_user: null }, { assigned_user: 'self' }, { assigned_user: '' } ] }
                                ]
                            }
                        ]
                    }
                }
            ] : []),
            // Optional campaign filter
            ...(campaignId && campaignId.match(/^[0-9a-fA-F]{24}$/) ? [
                { $match: { 'lead.campaign_id': new mongoose.Types.ObjectId(campaignId) } }
            ] : []),

            // Join campaign info
            {
                $lookup: {
                    from: 'campaigns',
                    localField: 'lead.campaign_id',
                    foreignField: '_id',
                    as: 'campaign'
                }
            },
            {
                $unwind: {
                    path: '$campaign',
                    preserveNullAndEmptyArrays: true
                }
            },
            // Determine the bucket using date_time
            {
                $addFields: {
                    lead_name: { $ifNull: ['$lead.name', '$candidate.name'] },
                    lead_id_val: '$lead._id',
                    candidate_id_val: '$candidate._id',
                    telephone: { $ifNull: ['$lead.telephone', '$candidate.phone'] },
                    campaign_name: { $ifNull: ['$campaign.name', 'HC Candidates'] },
                    campaign_id_val: { $ifNull: ['$campaign._id', 'candidate'] },
                    bucket: {
                        $switch: {
                            branches: [
                                { case: { $lt: ['$date_time', startOfToday] }, then: 'overdue' },
                                { case: { $and: [ { $gte: ['$date_time', startOfToday] }, { $lt: ['$date_time', endOfToday] } ] }, then: 'dueToday' },
                                { case: { $gte: ['$date_time', endOfToday] }, then: 'upcoming' }
                            ],
                            default: 'unknown'
                        }
                    }
                }
            },
            {
                $facet: {
                    overdue: [
                        { $match: { bucket: 'overdue' } },
                        { $sort: { date_time: 1 } }
                    ],
                    dueToday: [
                        { $match: { bucket: 'dueToday' } },
                        { $sort: { date_time: 1 } }
                    ],
                    upcoming: [
                        { $match: { bucket: 'upcoming' } },
                        { $sort: { date_time: 1 } }
                    ]
                }
            }
        ];

        const [result] = await Followup.aggregate(pipeline);
        
        // Also map dueToday into `due` because the frontend uses `due` instead of `dueToday` in some places.
        // Wait, Dashboard expects `due` and `overdue` and `upcoming` arrays in getDetailedFollowups route, wait no, let's look at frontend Dashboard.tsx:
        // `resDetailedFollowups.data` -> `rawData.due`, `rawData.overdue`, `rawData.upcoming`.
        const responseData = {
            overdue: result?.overdue || [],
            due: result?.dueToday || [],
            dueToday: result?.dueToday || [],
            upcoming: result?.upcoming || [],
            all: [ ...(result?.overdue || []), ...(result?.dueToday || []), ...(result?.upcoming || []) ]
        };
        res.json(responseData);
    } catch (err) {
        next(err);
    }
};

export const getDashboardFollowups = async (req, res, next) => {
   // getGroupedFollowups is handling dashboard followups logic in the current implementation
    getGroupedFollowups(req, res, next);
};

export const updateFollowup = async (req, res, next) => {
    try {
        const fu = await Followup.findById(req.params.id);
        if (!fu) {
            res.status(404);
            throw new Error('Follow-up not found');
        }

        // Ownership check: sales_rep can only edit follow-ups they created
        if (req.currentUserRole === 'sales_rep') {
            if (!fu.created_by || fu.created_by.toString() !== req.user.id) {
                res.status(403);
                throw new Error('Access denied. You can only edit follow-ups that you created.');
            }
        }

        const lead = await Lead.findById(fu.lead_id).select('assigned_to name');

        const { title, notes, date_time, type, assigned_user, priority, status, cc_emails, send_invite } = req.body;

        const oldStatus = fu.status;

        if (title !== undefined) fu.title = title;
        if (notes !== undefined) fu.notes = notes;
        if (date_time !== undefined) fu.date_time = new Date(date_time);
        if (type !== undefined) fu.type = type;
        if (assigned_user !== undefined) fu.assigned_user = assigned_user;
        if (priority !== undefined) fu.priority = priority;
        if (status !== undefined) {
            fu.status = status;
            if (status === 'done' && oldStatus !== 'done') {
                fu.completed_at = new Date();
                if (lead) {
                    lead.last_contacted = new Date();
                    await lead.save();
                }
            } else if (status === 'pending') {
                fu.completed_at = undefined;
            }
        }
        
        let ccArray = [];
        if (cc_emails !== undefined) {
            if (Array.isArray(cc_emails)) {
                ccArray = cc_emails;
            } else if (typeof cc_emails === 'string' && cc_emails.trim()) {
                ccArray = cc_emails.split(',').map(e => e.trim()).filter(Boolean);
            }
            fu.cc_emails = ccArray;
        } else {
            ccArray = fu.cc_emails || [];
        }

        if (send_invite !== undefined) fu.send_invite = send_invite;

        await fu.save();

        // Google Calendar integration
        if (process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_REFRESH_TOKEN !== 'your_google_refresh_token_here') {
            const hasPriority = fu.priority && fu.priority !== 'None' && fu.priority !== '';
            // Meetings ALWAYS keep their calendar event; other types only sync when priority is set.
            const shouldSyncCalendar = fu.type === 'Meeting' || hasPriority;
            
            if (shouldSyncCalendar) {
                try {
                    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
                    
                    const eventStartTime = new Date(fu.date_time);
                    const eventEndTime = new Date(eventStartTime.getTime() + 30 * 60000); // 30 min duration
                    
                    const attendees = [];
                    
                    let clientEmail = null;
                    if (fu.send_invite) {
                        if (fu.lead_id) {
                            const primaryContact = await Contact.findOne({ lead_id: fu.lead_id, is_primary: true });
                            if (primaryContact?.email) {
                                clientEmail = primaryContact.email;
                            }
                        } else if (fu.candidate_id) {
                            const candidate = await Candidate.findById(fu.candidate_id);
                            if (candidate?.email) {
                                clientEmail = candidate.email;
                            }
                        }
                        if (clientEmail) {
                            attendees.push({ email: clientEmail });
                        }
                    }

                    ccArray.forEach(email => attendees.push({ email }));
                    if (process.env.ADMIN_EMAIL) attendees.push({ email: process.env.ADMIN_EMAIL });

                    // Add assigned user email as an attendee
                    if (lead?.assigned_to) {
                        const assignedUser = await User.findById(lead.assigned_to);
                        if (assignedUser?.email) {
                            const emailLower = assignedUser.email.toLowerCase();
                            if (
                                (!clientEmail || clientEmail.toLowerCase() !== emailLower) &&
                                (!process.env.ADMIN_EMAIL || process.env.ADMIN_EMAIL.toLowerCase() !== emailLower) &&
                                !ccArray.some(e => e.toLowerCase() === emailLower)
                            ) {
                                attendees.push({ email: assignedUser.email });
                            }
                        }
                    }

                    // Build description without showing "Priority: null" or "Priority: "
                    const descParts = [];
                    if (hasPriority) descParts.push(`Priority: ${fu.priority}`);
                    if (fu.notes) descParts.push(`Notes: ${fu.notes}`);
                    if (ccArray.length > 0) descParts.push(`\nCC Recipients: ${ccArray.join(', ')}`);

                    const event = {
                        summary: fu.title ? `${fu.title} (${fu.type}) - ${lead?.name || 'Lead'}` : `Follow-up (${fu.type}): ${lead?.name || 'Lead'}`,
                        description: descParts.join('\n'),
                        start: {
                            dateTime: eventStartTime.toISOString(),
                            timeZone: 'America/New_York',
                        },
                        end: {
                            dateTime: eventEndTime.toISOString(),
                            timeZone: 'America/New_York',
                        },
                        attendees: attendees,
                        reminders: {
                            useDefault: false,
                            overrides: [
                                { method: 'email', minutes: 30 },
                                { method: 'popup', minutes: 15 },
                            ],
                        },
                    };

                    if (fu.google_event_id) {
                        // Update existing event
                        await calendar.events.update({
                            calendarId: 'primary',
                            eventId: fu.google_event_id,
                            resource: event,
                            sendUpdates: fu.type === 'Meeting' ? 'all' : 'none',
                        });
                    } else {
                        // Create new event since priority was added
                        const createdEvent = await calendar.events.insert({
                            calendarId: 'primary',
                            resource: event,
                            sendUpdates: fu.type === 'Meeting' ? 'all' : 'none',
                        });
                        fu.google_event_id = createdEvent.data.id;
                        await fu.save();
                    }
                } catch (calErr) {
                    console.error("Google Calendar Update/Insert Error:", calErr.message);
                }
            } else if (fu.google_event_id) {
                // Priority was removed for a non-Meeting follow-up: delete the calendar event
                try {
                    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
                    await calendar.events.delete({
                        calendarId: 'primary',
                        eventId: fu.google_event_id,
                        sendUpdates: 'none',
                    });
                    fu.google_event_id = undefined;
                    await fu.save();
                } catch (calErr) {
                    console.error("Google Calendar Delete on Update Error:", calErr.message);
                }
            }
        }

        res.json(fu);
    } catch (err) {
        next(err);
    }
};

export const deleteFollowup = async (req, res, next) => {
    try {
        const fu = await Followup.findById(req.params.id);
        if (!fu) {
            res.status(404);
            throw new Error('Follow-up not found');
        }

        // Sales Rep lead assignment check
        const lead = await Lead.findById(fu.lead_id).select('assigned_to');
        if (req.currentUserRole === 'sales_rep' && (!lead || !lead.assigned_to || lead.assigned_to.toString() !== req.user.id)) {
            res.status(403);
            throw new Error('Access denied. You can only delete followups for leads assigned to you.');
        }

        // Google Calendar integration
        if (fu.google_event_id && process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_REFRESH_TOKEN !== 'your_google_refresh_token_here') {
            try {
                const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
                await calendar.events.delete({
                    calendarId: 'primary',
                    eventId: fu.google_event_id,
                    sendUpdates: fu.type === 'Meeting' ? 'all' : 'none',
                });
            } catch (calErr) {
                console.error("Google Calendar Delete Error:", calErr.message);
            }
        }

        await Followup.findByIdAndDelete(req.params.id);

        res.json({ success: true, message: 'Follow-up deleted successfully' });
    } catch (err) {
        next(err);
    }
};

export const getFollowupsByCandidate = async (req, res, next) => {
    try {
        const followups = await Followup.find({ candidate_id: req.params.candidateId })
            .populate('candidate_id', 'name email phone')
            .sort({ date_time: 1 });
        res.json(followups);
    } catch (err) {
        next(err);
    }
};

export const createCandidateFollowup = async (req, res, next) => {
    try {
        const { title, date_time, type, notes, assigned_user, priority, cc_emails, force, send_invite } = req.body;
        
        if (!date_time) {
            res.status(400);
            throw new Error('date_time is required');
        }

        const candidate = await Candidate.findById(req.params.candidateId);
        if (!candidate) {
            res.status(404);
            throw new Error('Candidate not found');
        }

        // CC emails
        let ccArray = [];
        if (Array.isArray(cc_emails)) {
            ccArray = cc_emails;
        } else if (typeof cc_emails === 'string' && cc_emails.trim()) {
            ccArray = cc_emails.split(',').map(e => e.trim()).filter(Boolean);
        }

        // ── DB-level conflict check (works without Google Calendar) ──────────
        if (!force) {
            const eventStartTime = new Date(date_time);
            const windowStart = new Date(eventStartTime.getTime() - 30 * 60000); // -30 min
            const windowEnd   = new Date(eventStartTime.getTime() + 30 * 60000); // +30 min

            const existingConflict = await Followup.findOne({
                candidate_id: req.params.candidateId,
                date_time: { $gte: windowStart, $lte: windowEnd },
                status: { $ne: 'done' }
            });

            if (existingConflict) {
                return res.status(409).json({
                    error: 'Conflict detected',
                    message: `A follow-up is already scheduled at this time (${existingConflict.type} – ${new Date(existingConflict.date_time).toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true, month: 'short', day: 'numeric' })})`,
                    conflicts: [{
                        summary: `${existingConflict.type} – ${existingConflict.notes?.substring(0, 60) || 'Follow-up'}`,
                        start: existingConflict.date_time,
                        end: new Date(new Date(existingConflict.date_time).getTime() + 30 * 60000)
                    }]
                });
            }
        }

        // ── Google Calendar conflict check (only if configured) ──────────────
        if (process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_REFRESH_TOKEN !== 'your_google_refresh_token_here') {
            try {
                const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
                const eventStartTime = new Date(date_time);
                const eventEndTime = new Date(eventStartTime.getTime() + 30 * 60000);
                
                if (!force) {
                    const conflicts = await calendar.events.list({
                        calendarId: 'primary',
                        timeMin: eventStartTime.toISOString(),
                        timeMax: eventEndTime.toISOString(),
                        singleEvents: true,
                    });

                    if (conflicts.data.items && conflicts.data.items.length > 0) {
                        return res.status(409).json({
                            error: 'Conflict detected',
                            conflicts: conflicts.data.items.map(item => ({
                                summary: item.summary,
                                start: item.start.dateTime || item.start.date,
                                end: item.end.dateTime || item.end.date
                            }))
                        });
                    }
                }
            } catch (err) {
                console.error('Google Calendar Conflict Check Error:', err);
            }
        }


        const fu = await Followup.create({
            candidate_id: req.params.candidateId,
            title: title || '',
            date_time: new Date(date_time),
            type: type || 'Call',
            notes: notes || '',
            assigned_user: assigned_user || null,
            priority: priority || null,
            cc_emails: ccArray,
            created_by: req.user.id,
            send_invite: send_invite || false
        });

        // Google Calendar Event
        const shouldCreateCalendarEvent = type === 'Meeting' || priority;
        if (shouldCreateCalendarEvent && process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_REFRESH_TOKEN !== 'your_google_refresh_token_here') {
            try {
                const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
                const eventStartTime = new Date(date_time);
                const eventEndTime = new Date(eventStartTime.getTime() + 30 * 60000);
                
                const attendees = [];
                if (fu.send_invite && candidate.email) {
                    attendees.push({ email: candidate.email });
                }
                ccArray.forEach(email => attendees.push({ email }));
                if (process.env.ADMIN_EMAIL) attendees.push({ email: process.env.ADMIN_EMAIL });

                const descriptionParts = [];
                if (priority) descriptionParts.push(`Priority: ${priority}`);
                if (notes) descriptionParts.push(`Notes: ${notes}`);
                if (ccArray.length > 0) descriptionParts.push(`\nCC Recipients: ${ccArray.join(', ')}`);

                const event = {
                    summary: title ? `${title} (${type}) - ${candidate.name}` : `Follow-up (${type}): ${candidate.name}`,
                    description: descriptionParts.join('\n'),
                    start: {
                        dateTime: eventStartTime.toISOString(),
                        timeZone: 'America/New_York',
                    },
                    end: {
                        dateTime: eventEndTime.toISOString(),
                        timeZone: 'America/New_York',
                    },
                    attendees: attendees,
                    reminders: {
                        useDefault: false,
                        overrides: [
                            { method: 'email', minutes: 30 },
                            { method: 'popup', minutes: 15 },
                        ],
                    },
                };

                const createdEvent = await calendar.events.insert({
                    calendarId: 'primary',
                    resource: event,
                    sendUpdates: type === 'Meeting' ? 'all' : 'none',
                });

                fu.google_event_id = createdEvent.data.id;
                await fu.save();
            } catch (calErr) {
                console.error("Google Calendar Error for Candidate Followup:", calErr.message);
            }
        }

        res.json(fu);
    } catch (err) {
        next(err);
    }
};
