import cron from 'node-cron';
import { google } from 'googleapis';
import Followup from '../models/followup.model.js';
import Lead from '../models/lead.model.js';

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

if (process.env.GOOGLE_REFRESH_TOKEN) {
  oAuth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
}

export const initCronJobs = () => {
    // Schedule morning summary at 6:10 PM for testing (normally 8:00 AM)
    cron.schedule('10 18 * * *', async () => {
        console.log('Running morning follow-up summary...');
        try {
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

            const followups = await Followup.find({
                status: 'pending',
                date_time: { $gte: startOfDay, $lt: endOfDay }
            }).populate('lead_id');

            if (followups.length === 0) return;

            const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
            
            const summaryList = followups.map(f => `- ${f.type}: ${f.lead_id?.name || 'Lead'} at ${new Date(f.date_time).toLocaleTimeString()}`).join('\n');
            const subject = `You have ${followups.length} follow-ups due today`;
            const body = `
                <h2>Daily Follow-up Summary</h2>
                <p>You have ${followups.length} follow-ups scheduled for today:</p>
                <ul>
                    ${followups.map(f => `<li><strong>${f.type}</strong>: ${f.lead_id?.name || 'Lead'} at ${new Date(f.date_time).toLocaleTimeString()}</li>`).join('')}
                </ul>
                <p><a href="${process.env.FRONTEND_URL || 'http://localhost:8080'}/followups">View in CRM</a></p>
            `;

            const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
            const messageParts = [
                `To: ${process.env.ADMIN_EMAIL || 'chiragsoftiatric@gmail.com'}`,
                'Content-Type: text/html; charset=utf-8',
                'MIME-Version: 1.0',
                `Subject: ${utf8Subject}`,
                '',
                body,
            ];
            const message = messageParts.join('\n');
            const encodedMessage = Buffer.from(message)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            await gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: encodedMessage,
                },
            });

            console.log('Morning summary sent successfully.');
        } catch (err) {
            console.error('Error running morning summary cron:', err);
        }
    });
};
