import mongoose from 'mongoose';
import Followup from '../models/followup.model.js';
import Lead from '../models/lead.model.js';
import Contact from '../models/contact.model.js';
import Note from '../models/note.model.js';
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
        const { date_time, type, notes, assigned_user, priority, contact_id, cc_emails, force } = req.body;
        
        if (!date_time) {
            res.status(400);
            throw new Error('date_time is required');
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
        const fu = await Followup.create({
            lead_id: req.params.schoolId,
            date_time: new Date(date_time),
            type: type || 'Task',
            notes: notes || '',
            assigned_user: assigned_user || null,
            priority: priority || 'Medium',
            cc_emails: ccArray
        });

        // Log to activity feed (Section 2D Requirement)
        await Note.create({
            lead_id: req.params.schoolId,
            type: type === 'Meeting' ? 'meeting' : 'note',
            content: `Scheduled ${type}: ${new Date(date_time).toLocaleString()}${notes ? `\nNotes: ${notes}` : ''}${ccArray.length > 0 ? `\nCC: ${ccArray.join(', ')}` : ''}`,
            metadata: { followup_id: fu._id, date_time, type, notes, cc_emails: ccArray }
        });

        // TIER 2: Google Calendar Integration - CREATE EVENT
        if (process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_REFRESH_TOKEN !== 'your_google_refresh_token_here') {
            try {
                const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
                
                const eventStartTime = new Date(date_time);
                const eventEndTime = new Date(eventStartTime.getTime() + 30 * 60000); // 30 min duration
                const leadInfo = await Lead.findById(req.params.schoolId);
                
                // Fetch client email (Primary Contact)
                let clientEmail = null;
                const primaryContact = await Contact.findOne({ lead_id: req.params.schoolId, is_primary: true });
                if (primaryContact?.email) {
                    clientEmail = primaryContact.email;
                } else if (contact_id) {
                    const contactInfo = await Contact.findById(contact_id);
                    clientEmail = contactInfo?.email;
                }

                const attendees = [];
                if (clientEmail) attendees.push({ email: clientEmail });
                
                // Add CC emails as attendees
                ccArray.forEach(email => {
                    attendees.push({ email });
                });

                // We add the admin email as an attendee to ensure they are on the list, 
                // though being the 'primary' calendar owner usually handles this.
                if (process.env.ADMIN_EMAIL) {
                    attendees.push({ email: process.env.ADMIN_EMAIL });
                }

                const event = {
                    summary: `Follow-up (${type}): ${leadInfo?.name || 'Lead'}`,
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
                    sendUpdates: type === 'Meeting' ? 'all' : 'none',
                });

                fu.google_event_id = createdEvent.data.id;
                await fu.save();

            } catch (calErr) {
                console.error("Google Calendar Error:", calErr.message);
                // Return a specific error if calendar fails, so the user knows
                return res.status(500).json({ 
                    error: 'Google Calendar Error', 
                    message: calErr.message,
                    details: calErr.response?.data 
                });
            }
        }

        res.json(fu);
    } catch (err) {
        next(err);
    }
};

export const completeFollowup = async (req, res, next) => {
    try {
        const fu = await Followup.findByIdAndUpdate(req.params.id, {
            status: 'done',
            completed_at: new Date()
        }, { new: true });

        if (!fu) {
            res.status(404);
            throw new Error('Follow-up not found');
        }

        // Auto update last_contacted
        await Lead.findByIdAndUpdate(
            fu.lead_id,
            { last_contacted: new Date() }
        );

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

export const getFollowupsBySchool = async (req, res, next) => {
    try {
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
            { $unwind: '$lead' },
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
