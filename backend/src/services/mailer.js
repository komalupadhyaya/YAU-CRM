/**
 * mailer.js — Shared Gmail API mailer service
 *
 * Reuses the same Google OAuth2 client as email.controller.js.
 * Reads HTML templates from src/emails/, fills placeholders, and sends via Gmail API.
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── OAuth2 client ─────────────────────────────────────────────────────────────
const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

if (process.env.GOOGLE_REFRESH_TOKEN) {
    oAuth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
}

// ── Template helper ───────────────────────────────────────────────────────────
/**
 * Load an HTML template from src/emails/ and replace all {{KEY}} placeholders.
 * @param {string} templateName - filename without path, e.g. 'admin-new-member.html'
 * @param {Record<string, string>} vars - placeholder values
 * @returns {string} rendered HTML
 */
function renderTemplate(templateName, vars) {
    const templatePath = path.resolve(__dirname, '../emails', templateName);
    let html = fs.readFileSync(templatePath, 'utf-8');

    for (const [key, value] of Object.entries(vars)) {
        // Replace ALL occurrences of {{KEY}}
        html = html.replaceAll(`{{${key}}}`, value ?? '');
    }
    return html;
}

// ── Core send function ────────────────────────────────────────────────────────
/**
 * Send an HTML email via the Gmail API.
 * @param {{ to: string, subject: string, html: string }} options
 */
async function sendMail({ to, subject, html, from, icsContent, icsFilename = 'invite.ics' }) {
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
    const boundary = '____boundary_yau_crm____';

    const headers = [];
    if (from) {
        headers.push(`From: ${from}`);
    }
    headers.push(`To: ${to}`);
    headers.push(`Subject: ${utf8Subject}`);
    headers.push('MIME-Version: 1.0');

    let rawParts = '';

    if (icsContent) {
        headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
        
        rawParts = [
            ...headers,
            '',
            `--${boundary}`,
            'Content-Type: text/html; charset=utf-8',
            'Content-Transfer-Encoding: 7bit',
            '',
            html,
            '',
            `--${boundary}`,
            `Content-Type: text/calendar; charset=utf-8; method=REQUEST; name="${icsFilename}"`,
            'Content-Transfer-Encoding: base64',
            `Content-Disposition: inline; filename="${icsFilename}"`,
            '',
            Buffer.from(icsContent).toString('base64'),
            '',
            `--${boundary}--`
        ].join('\r\n');
    } else {
        headers.push('Content-Type: text/html; charset=utf-8');
        rawParts = [
            ...headers,
            '',
            html,
        ].join('\r\n');
    }

    const encoded = Buffer.from(rawParts)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encoded },
    });
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * HOW EMAIL SENDING IS NON-BLOCKING (fire-and-forget)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every exported function here is called WITHOUT `await` in the controller:
 *
 *   sendNewMemberEmails({ ... });      ← no await
 *   sendDeactivationEmail({ ... });    ← no await
 *
 * This means:
 *   ✅ The API responds instantly — the HTTP request is NOT held open
 *   ✅ The user/admin gets the response (201 Created, etc.) immediately
 *   ✅ Emails are dispatched in the background by Node's event loop
 *   ✅ If the Gmail API fails or throws, the error is CAUGHT inside each
 *      try/catch block below and logged to console — it NEVER reaches the
 *      controller's error handler or crashes the server
 *
 * The trade-off: you can't tell the frontend whether the email succeeded.
 * For this use case (notifications) that is perfectly acceptable.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── High-level mailers ────────────────────────────────────────────────────────

/**
 * Send two emails when a new team member is created:
 *  1. Admin notification  → ADMIN_EMAIL
 *  2. Welcome email       → new member's email (with temp password)
 *
 * Called WITHOUT await — fully non-blocking fire-and-forget.
 *
 * @param {{ name: string, email: string, role: string, password: string, createdAt: string }} memberDetails
 */
export async function sendNewMemberEmails({ name, email, role, password, createdAt }) {
    const crmUrl    = process.env.FRONTEND_URL || 'http://localhost:8080';
    const adminEmail = process.env.ADMIN_EMAIL  || 'admin@yaucrm.com';
    const year      = new Date().getFullYear().toString();
    const formattedDate = new Date(createdAt).toLocaleString('en-US', {
        dateStyle: 'long',
        timeStyle: 'short',
    });

    const sharedVars = { NAME: name, EMAIL: email, ROLE: role, CRM_URL: crmUrl, YEAR: year };

    // ── 1. Admin notification ────────────────────────────────────────────────
    try {
        const adminHtml = renderTemplate('admin-new-member.html', {
            ...sharedVars,
            CREATED_AT: formattedDate,
        });

        await sendMail({
            to: adminEmail,
            subject: `[YAU CRM] New team member added — ${name}`,
            html: adminHtml,
        });

        console.log(`✅ Admin notification sent to ${adminEmail}`);
    } catch (err) {
        console.error('❌ Failed to send admin notification email:', err.message);
        // Non-fatal — do NOT re-throw. Controller is already done responding.
    }

    // ── 2. Welcome email to new member ───────────────────────────────────────
    try {
        const memberHtml = renderTemplate('team-member-welcome.html', {
            ...sharedVars,
            PASSWORD: password,
            ADMIN_EMAIL: adminEmail,
        });

        await sendMail({
            to: email,
            subject: `Welcome to YAU CRM — your account is ready 🎉`,
            html: memberHtml,
        });

        console.log(`✅ Welcome email sent to ${email}`);
    } catch (err) {
        console.error('❌ Failed to send welcome email:', err.message);
        // Non-fatal — do NOT re-throw. Controller is already done responding.
    }
}

/**
 * Send a deactivation notification email to a team member when their
 * account is disabled by an admin.
 *
 * Called WITHOUT await — fully non-blocking fire-and-forget.
 * If the Gmail API throws, the error is caught and logged — the toggle
 * API response is NEVER blocked or affected.
 *
 * @param {{ name: string, email: string, role: string, deactivatedBy: string }} details
 */
export async function sendDeactivationEmail({ name, email, role, deactivatedBy }) {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@yaucrm.com';
    const year       = new Date().getFullYear().toString();

    try {
        const html = renderTemplate('account-deactivated.html', {
            NAME:            name,
            EMAIL:           email,
            ROLE:            role,
            DEACTIVATED_BY:  deactivatedBy,
            ADMIN_EMAIL:     adminEmail,
            YEAR:            year,
        });

        await sendMail({
            to: email,
            subject: `[YAU CRM] Your account has been deactivated 🔒`,
            html,
        });

        console.log(`✅ Deactivation email sent to ${email}`);
    } catch (err) {
        console.error('❌ Failed to send deactivation email:', err.message);
        // Non-fatal — do NOT re-throw. Controller is already done responding.
    }
}

/**
 * Send a reactivation notification email to a team member when their
 * account is re-enabled by an admin.
 *
 * Called WITHOUT await — fully non-blocking fire-and-forget.
 * If the Gmail API throws, the error is caught and logged.
 *
 * @param {{ name: string, email: string, role: string, activatedBy: string }} details
 */
export async function sendReactivationEmail({ name, email, role, activatedBy }) {
    const crmUrl     = process.env.FRONTEND_URL || 'http://localhost:8080';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@yaucrm.com';
    const year       = new Date().getFullYear().toString();

    try {
        const html = renderTemplate('account-reactivated.html', {
            NAME:            name,
            EMAIL:           email,
            ROLE:            role,
            ACTIVATED_BY:    activatedBy,
            CRM_URL:         crmUrl,
            ADMIN_EMAIL:     adminEmail,
            YEAR:            year,
        });

        await sendMail({
            to: email,
            subject: `[YAU CRM] Your account has been reactivated ✅`,
            html,
        });

        console.log(`✅ Reactivation email sent to ${email}`);
    } catch (err) {
        console.error('❌ Failed to send reactivation email:', err.message);
        // Non-fatal — do NOT re-throw. Controller is already done responding.
    }
}

/**
 * Send a deletion notification email to a team member when their
 * account is permanently deleted by an admin.
 *
 * Called WITHOUT await — fully non-blocking fire-and-forget.
 * If the Gmail API throws, the error is caught and logged.
 *
 * @param {{ name: string, email: string, role: string, deletedBy: string }} details
 */
export async function sendDeletionEmail({ name, email, role, deletedBy }) {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@yaucrm.com';
    const year       = new Date().getFullYear().toString();

    try {
        const html = renderTemplate('account-deleted.html', {
            NAME:            name,
            EMAIL:           email,
            ROLE:            role,
            DELETED_BY:      deletedBy,
            ADMIN_EMAIL:     adminEmail,
            YEAR:            year,
        });

        await sendMail({
            to: email,
            subject: `[YAU CRM] Your account has been permanently deleted 🗑️`,
            html,
        });

        console.log(`✅ Deletion email sent to ${email}`);
    } catch (err) {
        console.error('❌ Failed to send deletion email:', err.message);
        // Non-fatal — do NOT re-throw. Controller is already done responding.
    }
}

/**
 * Send a gorgeous daily summary email containing follow-ups due today
 * and overdue pending follow-ups.
 *
 * Called WITHOUT await — fully non-blocking fire-and-forget.
 *
 * @param {{ followups: Array, overdueFollowups: Array, to: string }} details
 */
export async function sendDailySummaryEmail({ followups = [], overdueFollowups = [], to }) {
    const crmUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@yaucrm.com';
    const year = new Date().getFullYear().toString();

    const todayStr = new Date().toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const totalCount = followups.length;
    const highPriority = followups.filter(f => f.priority === 'High').length;
    const meetingCount = followups.filter(f => f.type === 'Meeting').length;

    // Badge styling helpers
    const getTypeBadge = (type) => {
        const colors = {
            Call: { text: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)' },
            Email: { text: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.2)' },
            Meeting: { text: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
            Task: { text: '#71717a', bg: 'rgba(113,113,122,0.1)', border: 'rgba(113,113,122,0.2)' }
        };
        const style = colors[type] || colors.Task;
        return `<span style="display:inline-block;font-size:11px;font-weight:700;color:${style.text};background:${style.bg};border:1px solid ${style.border};border-radius:20px;padding:2px 8px;text-transform:capitalize;">${type}</span>`;
    };

    const getPriorityBadge = (priority) => {
        const colors = {
            High: { text: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' },
            Medium: { text: '#f97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.2)' },
            Low: { text: '#22c55e', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.2)' }
        };
        const style = colors[priority] || colors.Medium;
        return `<span style="display:inline-block;font-size:11px;font-weight:700;color:${style.text};background:${style.bg};border:1px solid ${style.border};border-radius:20px;padding:2px 8px;text-transform:capitalize;">${priority}</span>`;
    };

    const formatTimeNY = (date) => {
        return new Date(date).toLocaleTimeString('en-US', {
            timeZone: 'America/New_York',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    const formatDateNY = (date) => {
        return new Date(date).toLocaleDateString('en-US', {
            timeZone: 'America/New_York',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    // Render today's rows
    let followupRows = '';
    if (followups.length === 0) {
        followupRows = `
            <tr>
              <td colspan="5" style="padding:24px;text-align:center;color:#71717a;font-size:13px;border-bottom:1px solid #1f1f23;">
                No follow-ups scheduled for today. Enjoy your day!
              </td>
            </tr>
        `;
    } else {
        followupRows = followups.map(f => {
            const timeStr = formatTimeNY(f.date_time);
            const leadName = f.lead_id?.name || 'N/A';
            const notesStr = f.notes || '—';
            return `
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid #1f1f23;font-size:13px;color:#ffffff;font-weight:500;">${timeStr}</td>
                  <td style="padding:12px 16px;border-bottom:1px solid #1f1f23;white-space:nowrap;">${getTypeBadge(f.type)}</td>
                  <td style="padding:12px 16px;border-bottom:1px solid #1f1f23;white-space:nowrap;"><strong style="color:#ffffff;font-size:13px;">${leadName}</strong></td>
                  <td style="padding:12px 16px;border-bottom:1px solid #1f1f23;white-space:nowrap;">${getPriorityBadge(f.priority)}</td>
                  <td style="padding:12px 16px;border-bottom:1px solid #1f1f23;"><span style="color:#a1a1aa;font-size:12px;display:block;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${notesStr.replace(/"/g, '&quot;')}">${notesStr}</span></td>
                </tr>
            `;
        }).join('');
    }

    // Render overdue section if applicable
    let overdueSectionHtml = '';
    if (overdueFollowups.length > 0) {
        const overdueRows = overdueFollowups.map(f => {
            const dateStr = formatDateNY(f.date_time);
            const leadName = f.lead_id?.name || 'N/A';
            const notesStr = f.notes || '—';
            return `
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid rgba(239,68,68,0.15);font-size:13px;color:#fca5a5;font-weight:500;">${dateStr}</td>
                  <td style="padding:12px 16px;border-bottom:1px solid rgba(239,68,68,0.15);white-space:nowrap;">${getTypeBadge(f.type)}</td>
                  <td style="padding:12px 16px;border-bottom:1px solid rgba(239,68,68,0.15);white-space:nowrap;"><strong style="color:#ffffff;font-size:13px;">${leadName}</strong></td>
                  <td style="padding:12px 16px;border-bottom:1px solid rgba(239,68,68,0.15);white-space:nowrap;">${getPriorityBadge(f.priority)}</td>
                  <td style="padding:12px 16px;border-bottom:1px solid rgba(239,68,68,0.15);"><span style="color:#a1a1aa;font-size:12px;display:block;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${notesStr.replace(/"/g, '&quot;')}">${notesStr}</span></td>
                </tr>
            `;
        }).join('');

        overdueSectionHtml = `
            <div style="margin-bottom:32px;">
              <h2 style="margin:0 0 12px;font-size:15px;font-weight:700;color:#ef4444;text-transform:uppercase;letter-spacing:0.5px;display:flex;align-items:center;">
                ⚠️ Overdue Pending Items (${overdueFollowups.length})
              </h2>
              <div style="background:#09090b;border:1px solid rgba(239,68,68,0.25);border-radius:12px;overflow:hidden;">
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <thead>
                    <tr style="background:#1c1012;border-bottom:1px solid rgba(239,68,68,0.25);">
                      <th style="padding:12px 16px;font-size:11px;font-weight:700;color:#fca5a5;text-transform:uppercase;text-align:left;letter-spacing:0.5px;width:20%;">Date/Time</th>
                      <th style="padding:12px 16px;font-size:11px;font-weight:700;color:#fca5a5;text-transform:uppercase;text-align:left;letter-spacing:0.5px;width:15%;">Type</th>
                      <th style="padding:12px 16px;font-size:11px;font-weight:700;color:#fca5a5;text-transform:uppercase;text-align:left;letter-spacing:0.5px;width:25%;">Lead</th>
                      <th style="padding:12px 16px;font-size:11px;font-weight:700;color:#fca5a5;text-transform:uppercase;text-align:left;letter-spacing:0.5px;width:15%;">Priority</th>
                      <th style="padding:12px 16px;font-size:11px;font-weight:700;color:#fca5a5;text-transform:uppercase;text-align:left;letter-spacing:0.5px;width:25%;">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${overdueRows}
                  </tbody>
                </table>
              </div>
            </div>
        `;
    }

    try {
        const html = renderTemplate('daily-summary.html', {
            DATE:            todayStr,
            TOTAL_COUNT:     totalCount.toString(),
            HIGH_PRIORITY:    highPriority.toString(),
            MEETING_COUNT:    meetingCount.toString(),
            FOLLOWUP_ROWS:   followupRows,
            OVERDUE_SECTION: overdueSectionHtml,
            CRM_URL:         crmUrl,
            ADMIN_EMAIL:     adminEmail,
            YEAR:            year,
        });

        const finalTo = to || adminEmail;
        await sendMail({
            to: finalTo,
            subject: `[YAU CRM] Daily Summary — ${todayStr} ☀️`,
            html,
        });

        console.log(`✅ Daily summary email sent successfully to ${finalTo}`);
    } catch (err) {
        console.error('❌ Failed to send daily summary email:', err.message);
    }
}

/**
 * Send a 30-minute reminder email for a Task or Follow-up.
 *
 * Called WITHOUT await — fully non-blocking fire-and-forget.
 * If Gmail API throws, error is caught and logged — cron loop is never blocked.
 *
 * @param {{ to: string, userName: string, title: string, type: string, dueAt: Date }} details
 */
export async function sendReminderEmail({ to, userName, title, type, dueAt }) {
    const crmUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    const year   = new Date().getFullYear().toString();

    const formattedDue = new Date(dueAt).toLocaleString('en-US', {
        weekday: 'short',
        month:   'short',
        day:     'numeric',
        year:    'numeric',
        hour:    'numeric',
        minute:  '2-digit',
        hour12:  true,
    });

    try {
        const html = renderTemplate('task-reminder.html', {
            USER_NAME:  userName || 'Team Member',
            ITEM_TITLE: title,
            ITEM_TYPE:  type,
            DUE_AT:     formattedDue,
            CRM_URL:    crmUrl,
            YEAR:       year,
        });

        await sendMail({
            to,
            subject: `⏰ Reminder: "${title}" is due in 30 minutes`,
            html,
        });

        console.log(`✅ Reminder email sent to ${to} for "${title}"`);
    } catch (err) {
        console.error('❌ Failed to send reminder email:', err.message);
        // Non-fatal — do NOT re-throw.
    }
}

function formatICSDate(date) {
    const d = new Date(date);
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function generateICS(meeting) {
    const startTime = new Date(meeting.date_time);
    const endTime = new Date(startTime.getTime() + meeting.duration_minutes * 60000);

    const startStr = formatICSDate(startTime);
    const endStr = formatICSDate(endTime);
    const createdStr = formatICSDate(new Date());

    const title = meeting.title || 'Meeting';
    let location = 'Phone Call';
    if (meeting.meeting_type === 'online') {
        location = meeting.meeting_link || 'Zoom Meeting';
    } else if (meeting.meeting_type === 'in_person') {
        location = meeting.location || 'In-Person';
    }

    const description = meeting.notes ? meeting.notes.replace(/\n/g, '\\n') : '';

    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//YAU CRM//Meeting Scheduler//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:REQUEST',
        'BEGIN:VEVENT',
        `UID:${meeting._id}-${startTime.getTime()}`,
        `DTSTAMP:${createdStr}`,
        `DTSTART:${startStr}`,
        `DTEND:${endStr}`,
        `SUMMARY:${title}`,
        `DESCRIPTION:${description}`,
        `LOCATION:${location}`,
        'STATUS:CONFIRMED',
        'SEQUENCE:0',
        'TRANSP:OPAQUE',
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');
}

/**
 * Send email notifications for an HR meeting.
 * Called WITHOUT await — fully non-blocking fire-and-forget.
 *
 * @param {{
 *   meeting: any,
 *   actionType: 'created' | 'rescheduled' | 'canceled'
 * }} options
 */
export async function sendHRMeetingEmails({ meeting, actionType }) {
    const crmUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    const year = new Date().getFullYear().toString();
    
    const statusLabel = actionType === 'created' ? 'Scheduled' : actionType === 'rescheduled' ? 'Rescheduled' : 'Canceled';
    const formattedDate = new Date(meeting.date_time).toLocaleString('en-US', {
        dateStyle: 'long',
        timeStyle: 'short',
    });

    // Subtitles for candidate & internal templates depending on the action
    let subtitleInternal = 'An HR meeting has been scheduled. Please review the details below.';
    let subtitleCandidate = 'You have a scheduled meeting. Please find the details below.';

    if (actionType === 'rescheduled') {
        subtitleInternal = 'An HR meeting has been rescheduled. Please review the updated details below.';
        subtitleCandidate = 'Your meeting has been rescheduled. Please review the updated details below.';
    } else if (actionType === 'canceled') {
        subtitleInternal = 'IMPORTANT: This scheduled HR meeting has been canceled.';
        subtitleCandidate = `Please note: The meeting that was scheduled for ${formattedDate} has been canceled.`;
    }

    // Determine candidates list
    const candidates = (meeting.candidate_ids && meeting.candidate_ids.length > 0)
        ? meeting.candidate_ids
        : (meeting.candidate_id ? [meeting.candidate_id] : []);

    const candidateNames = candidates.map(c => c.name).join(', ') || 'Candidate';
    const candidateEmails = candidates.map(c => c.email).filter(Boolean).join(', ') || '';
    const candidateRoles = candidates.map(c => c.applying_for).filter(Boolean).join(', ') || 'N/A';

    // 1. Send to internal attendees
    const attendeesList = meeting.internal_attendees?.map(a => `${a.name} (${a.email})`).join('\n') || '';

    const locationHtml = getLocationSectionHtml(meeting, '#6366f1');

    const internalHtml = renderTemplate('hr-meeting-internal.html', {
        STATUS: statusLabel,
        SUBTITLE: subtitleInternal,
        TITLE: meeting.title,
        CANDIDATE_NAME: candidateNames,
        CANDIDATE_EMAIL: candidateEmails,
        CANDIDATE_ROLE: candidateRoles,
        DATE_TIME: formattedDate,
        DURATION: meeting.duration_minutes.toString(),
        ATTENDEES_LIST: attendeesList,
        NOTES: meeting.notes || 'None',
        CRM_URL: crmUrl,
        YEAR: year
    }).replace('{LOCATION_SECTION}', locationHtml);

    const subjectInternal = `[HR Meeting] ${meeting.title} — ${statusLabel}`;
    const icsContent = actionType !== 'canceled' ? generateICS(meeting) : null;

    // Send to each internal attendee
    if (meeting.internal_attendees && meeting.internal_attendees.length > 0) {
        for (const attendee of meeting.internal_attendees) {
            if (attendee.email) {
                try {
                    await sendMail({
                        to: attendee.email,
                        subject: subjectInternal,
                        html: internalHtml,
                        icsContent
                    });
                    console.log(`✅ HR Meeting internal email sent to ${attendee.email}`);
                } catch (err) {
                    console.error(`❌ Failed to send HR Meeting internal email to ${attendee.email}:`, err.message);
                }
            }
        }
    }

    // 2. Send to CC emails (external_emails contains manually typed CC emails)
    if (meeting.external_emails && meeting.external_emails.length > 0) {
        for (const email of meeting.external_emails) {
            try {
                await sendMail({
                    to: email,
                    subject: subjectInternal,
                    html: internalHtml,
                    icsContent
                });
                console.log(`✅ HR Meeting CC email sent to ${email}`);
            } catch (err) {
                console.error(`❌ Failed to send HR Meeting CC email to ${email}:`, err.message);
            }
        }
    }

    // 3. Send to each candidate
    for (const candidate of candidates) {
        if (candidate.email) {
            try {
                const notesHtml = meeting.notes
                    ? `<tr>
                        <td style="padding:10px 0;">
                          <span style="font-size:12px;color:#71717a;display:block;margin-bottom:4px;">Notes</span>
                          <div style="font-size:13px;color:#d4d4d8;background:#18181b;border:1px solid #27272a;border-radius:8px;padding:12px;margin-top:4px;line-height:1.5;white-space:pre-wrap;">${meeting.notes}</div>
                        </td>
                      </tr>`
                    : '';

                const candidateHtml = renderTemplate('hr-meeting-candidate.html', {
                    STATUS: statusLabel,
                    SUBTITLE: subtitleCandidate,
                    TITLE: meeting.title,
                    DATE_TIME: formattedDate,
                    DURATION: meeting.duration_minutes.toString(),
                    TEAM_MEMBERS: attendeesList || 'None',
                    YEAR: year
                }).replace('{LOCATION_SECTION}', locationHtml).replace('{NOTES_SECTION}', notesHtml);

                const subjectCandidate = `Meeting Invitation: ${meeting.title} — ${statusLabel}`;

                await sendMail({
                    to: candidate.email,
                    subject: subjectCandidate,
                    html: candidateHtml,
                    icsContent
                });
                console.log(`✅ HR Meeting candidate email sent to ${candidate.email}`);
            } catch (err) {
                console.error(`❌ Failed to send HR Meeting candidate email to ${candidate.email}:`, err.message);
            }
        }
    }
}

/**
 * Send email notifications for a School meeting.
 * Called WITHOUT await — fully non-blocking fire-and-forget.
 *
 * @param {{
 *   meeting: any,
 *   actionType: 'created' | 'rescheduled' | 'canceled'
 * }} options
 */
export async function sendSchoolMeetingEmails({ meeting, actionType }) {
    const crmUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    const year = new Date().getFullYear().toString();
    
    const statusLabel = actionType === 'created' ? 'Scheduled' : actionType === 'rescheduled' ? 'Rescheduled' : 'Canceled';
    const formattedDate = new Date(meeting.date_time).toLocaleString('en-US', {
        dateStyle: 'long',
        timeStyle: 'short',
    });

    // Subtitles for lead & internal templates depending on the action
    let subtitleInternal = 'A school meeting has been scheduled. Please review the details below.';
    let subtitleLead = 'A meeting has been scheduled for your school. Please find the details below.';

    if (actionType === 'rescheduled') {
        subtitleInternal = 'A school meeting has been rescheduled. Please review the updated details below.';
        subtitleLead = 'Your school meeting has been rescheduled. Please review the updated details below.';
    } else if (actionType === 'canceled') {
        subtitleInternal = 'IMPORTANT: This scheduled school meeting has been canceled.';
        subtitleLead = `Please note: The school meeting that was scheduled for ${formattedDate} has been canceled.`;
    }

    // Determine schools/leads list
    const leads = (meeting.lead_ids && meeting.lead_ids.length > 0)
        ? meeting.lead_ids
        : (meeting.lead_id ? [meeting.lead_id] : []);
    
    const schoolsList = leads.map(l => l.name).join('\n') || 'None';

    // Format internal attendees list
    const attendeesList = meeting.internal_attendees?.map(a => `${a.name} (${a.email})`).join('\n') || 'None';

    // 1. Send to internal attendees
    const locationHtml = getLocationSectionHtml(meeting, '#10b981');

    const internalHtml = renderTemplate('school-meeting-internal.html', {
        STATUS: statusLabel,
        SUBTITLE: subtitleInternal,
        TITLE: meeting.title,
        SCHOOLS_LIST: schoolsList,
        DATE_TIME: formattedDate,
        DURATION: meeting.duration_minutes.toString(),
        ATTENDEES_LIST: attendeesList,
        NOTES: meeting.notes || 'None',
        CRM_URL: crmUrl,
        YEAR: year
    }).replace('{LOCATION_SECTION}', locationHtml);

    const subjectInternal = `[School Meeting] ${meeting.title} — ${statusLabel}`;
    const icsContent = actionType !== 'canceled' ? generateICS(meeting) : null;

    if (meeting.internal_attendees && meeting.internal_attendees.length > 0) {
        for (const attendee of meeting.internal_attendees) {
            if (attendee.email) {
                try {
                    await sendMail({
                        to: attendee.email,
                        subject: subjectInternal,
                        html: internalHtml,
                        icsContent
                    });
                    console.log(`✅ School Meeting internal email sent to ${attendee.email}`);
                } catch (err) {
                    console.error(`❌ Failed to send School Meeting internal email to ${attendee.email}:`, err.message);
                }
            }
        }
    }

    // 2. Send to CC emails
    if (meeting.external_emails && meeting.external_emails.length > 0) {
        for (const email of meeting.external_emails) {
            try {
                await sendMail({
                    to: email,
                    subject: subjectInternal,
                    html: internalHtml,
                    icsContent
                });
                console.log(`✅ School Meeting CC email sent to ${email}`);
            } catch (err) {
                console.error(`❌ Failed to send School Meeting CC email to ${email}:`, err.message);
            }
        }
    }

    // 3. Send to all contacts associated with the selected leads/schools
    if (leads.length > 0) {
        try {
            // Retrieve dynamic import of Contact model inside function to avoid circular dependencies
            const { Contact } = await import('../models/contact.model.js');
            const leadIds = leads.map(l => l._id);
            const contacts = await Contact.find({ lead_id: { $in: leadIds } });
            
            const contactEmails = contacts.map(c => c.email?.trim()).filter(Boolean);
            const uniqueEmails = [...new Set(contactEmails)];

            if (uniqueEmails.length > 0) {
                const notesHtml = meeting.notes
                    ? `<tr>
                        <td style="padding:10px 0;">
                          <span style="font-size:12px;color:#71717a;display:block;margin-bottom:4px;">Notes</span>
                          <div style="font-size:13px;color:#d4d4d8;background:#18181b;border:1px solid #27272a;border-radius:8px;padding:12px;margin-top:4px;line-height:1.5;white-space:pre-wrap;">${meeting.notes}</div>
                        </td>
                      </tr>`
                    : '';

                const leadHtml = renderTemplate('school-meeting-lead.html', {
                    STATUS: statusLabel,
                    SUBTITLE: subtitleLead,
                    TITLE: meeting.title,
                    DATE_TIME: formattedDate,
                    DURATION: meeting.duration_minutes.toString(),
                    TEAM_MEMBERS: attendeesList,
                    YEAR: year
                }).replace('{LOCATION_SECTION}', locationHtml).replace('{NOTES_SECTION}', notesHtml);

                const subjectLead = `Meeting Invitation: ${meeting.title} — ${statusLabel}`;

                for (const email of uniqueEmails) {
                    try {
                        await sendMail({
                            to: email,
                            subject: subjectLead,
                            html: leadHtml,
                            icsContent
                        });
                        console.log(`✅ School Meeting lead email sent to ${email}`);
                    } catch (err) {
                        console.error(`❌ Failed to send School Meeting lead email to ${email}:`, err.message);
                    }
                }
            }
        } catch (err) {
            console.error('❌ Failed to retrieve school contacts or send lead emails:', err.message);
        }
    }
}

/**
 * Generates the HTML location section row based on the meeting type.
 */
function getLocationSectionHtml(meeting, color) {
    const type = meeting.meeting_type || 'online';
    let label = 'Location';
    let value = '';
    
    if (type === 'online') {
        label = 'Meeting Link';
        value = meeting.meeting_link 
            ? `<a href="${meeting.meeting_link}" style="color:${color};text-decoration:underline;font-weight:600;">Zoom / Online Meeting Link</a>`
            : 'Zoom / Online';
        return `<tr>
                  <td style="padding:10px 0;border-bottom:1px solid #1f1f23;">
                    <span style="font-size:12px;color:#71717a;display:block;margin-bottom:4px;">${label}</span>
                    <span style="font-size:14px;font-weight:600;color:#ffffff;line-height:1.5;display:block;">${value}</span>
                  </td>
                </tr>`;
    } else if (type === 'in_person') {
        label = 'Location';
        const address = meeting.location || 'In-Person';
        if (address !== 'In-Person') {
            const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
            return `<tr>
                      <td style="padding:12px 0;border-bottom:1px solid #1f1f23;">
                        <span style="font-size:12px;color:#71717a;display:block;margin-bottom:8px;">${label}</span>
                        <div style="background-color: #111113; border: 1px solid #27272a; border-radius: 12px; overflow: hidden; margin-top: 4px;">
                          <!-- Card Header -->
                          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #18181b; border-bottom: 1px solid #27272a;">
                            <tr>
                              <td style="padding: 10px 16px; font-size: 11px; font-weight: 700; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.5px;">
                                📍 In-Person Meeting Venue
                              </td>
                            </tr>
                          </table>
                          <!-- Card Body -->
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding: 16px;">
                                <div style="font-size: 14px; font-weight: 700; color: #ffffff; margin-bottom: 14px; line-height: 1.4;">${address}</div>
                                <a href="${mapsLink}" target="_blank" style="display: inline-block; background-color: ${color}; color: #ffffff; text-decoration: none; font-size: 12px; font-weight: 700; padding: 10px 18px; border-radius: 8px; text-align: center;">
                                  🗺️ Open Google Maps / Get Directions
                                </a>
                              </td>
                            </tr>
                          </table>
                        </div>
                      </td>
                    </tr>`;
        } else {
            return `<tr>
                      <td style="padding:10px 0;border-bottom:1px solid #1f1f23;">
                        <span style="font-size:12px;color:#71717a;display:block;margin-bottom:4px;">${label}</span>
                        <span style="font-size:14px;font-weight:600;color:#ffffff;line-height:1.5;display:block;">${address}</span>
                      </td>
                    </tr>`;
        }
    } else if (type === 'phone') {
        label = 'Location';
        value = 'Phone Call';
    } else {
        value = meeting.location || 'N/A';
    }
    return `<tr>
              <td style="padding:10px 0;border-bottom:1px solid #1f1f23;">
                <span style="font-size:12px;color:#71717a;display:block;margin-bottom:4px;">${label}</span>
                <span style="font-size:14px;font-weight:600;color:#ffffff;line-height:1.5;display:block;">${value}</span>
              </td>
            </tr>`;
}

/**
 * Send welcome email to EA Lead (Phase 3)
 * Non-blocking, fire-and-forget helper
 */
export async function sendEAWelcomeEmail({ name, email }) {
    try {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333333; line-height: 1.6;">
                <p>Hey ${name},</p>
                <p>Thank you for reaching out! We're so excited about your interest in Youth Athlete University.</p>
                <p>We'd love to tell you more about our programs and how we can help your athlete grow. Click below to learn more:<br/>
                <a href="https://youthathleteuniversity.org/love/" style="display: inline-block; background-color: #3b82f6; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px; font-weight: bold;">Learn More About Our Programs</a></p>
                <p>If you have any questions, please call us on 800-293-0354.</p>
                <p>Talk soon,<br/>
                The YAU Team</p>
            </div>
        `;

        await sendMail({
            from: 'Team@YAUSport.com',
            to: email,
            subject: "We're Here For You and Your Child's Sport!",
            html,
        });

        console.log(`✅ Welcome email sent to ${email}`);
    } catch (err) {
        console.error('❌ Failed to send welcome email:', err.message);
    }
}

/**
 * Send email notification for a new voicemail.
 * Non-blocking, fire-and-forget helper.
 */
export async function sendVoicemailEmailNotification({ to, fromNumber, duration, recordingUrl }) {
    const crmUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    const year = new Date().getFullYear().toString();
    
    // Format duration
    const durationSec = Number(duration) || 0;
    const minutes = Math.floor(durationSec / 60);
    const seconds = durationSec % 60;
    const durationStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

    try {
        const html = renderTemplate('voicemail-notification.html', {
            FROM_NUMBER: fromNumber || 'Unknown Caller',
            DURATION: durationStr,
            PLAYBACK_URL: recordingUrl,
            CRM_URL: crmUrl,
            YEAR: year,
        });

        await sendMail({
            to,
            subject: `📼 New Voicemail from ${fromNumber || 'Unknown Caller'}`,
            html,
        });

        console.log(`✅ Voicemail email notification sent successfully to ${to}`);
    } catch (err) {
        console.error('❌ Failed to send voicemail email notification:', err.message);
    }
}



