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
async function sendMail({ to, subject, html }) {
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
    const rawParts = [
        `To: ${to}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${utf8Subject}`,
        '',
        html,
    ].join('\r\n');

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

