import axios from 'axios';

/**
 * Sends a single marketing/campaign email to a recipient via SendGrid.
 * Appends open tracking, click tracking, custom unsubscribe headers, and a legal unsubscribe link.
 * 
 * @param {Object} params
 * @param {string} params.to - Recipient email
 * @param {string} params.subject - Email subject
 * @param {string} params.html - HTML body
 * @param {string} params.leadId - Mongoose ObjectId of the lead
 * @param {string} params.leadModel - 'Lead' or 'EALead'
 * @param {string} params.campaignId - Mongoose ObjectId of the campaign
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
export const sendSendGridMail = async ({ to, subject, html, leadId, leadModel, campaignId }) => {
    const apiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL;
    const fromName = process.env.SENDGRID_FROM_NAME || 'Youth Athlete University';
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';

    if (!apiKey) {
        throw new Error('SENDGRID_API_KEY is not defined in environment variables');
    }
    if (!fromEmail) {
        throw new Error('SENDGRID_FROM_EMAIL is not defined in environment variables');
    }

    // Build the unsubscribe link
    const unsubscribeLink = `${backendUrl}/api/emails/unsubscribe/${leadId}?model=${leadModel}`;
    
    // Inject legal unsubscribe block in the footer
    const footerHtml = `
        <br/><br/>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;"/>
        <p style="font-family: Arial, sans-serif; font-size: 11px; color: #666; text-align: center; line-height: 1.5;">
            You are receiving this because you subscribed or expressed interest in YAU Sports programs.<br/>
            Youth Athlete University, ${fromName}<br/>
            <a href="${unsubscribeLink}" style="color: #0066cc; text-decoration: underline;" target="_blank">Unsubscribe</a> from future marketing emails.
        </p>
    `;
    const finalHtml = html + footerHtml;

    try {
        const response = await axios.post(
            'https://api.sendgrid.com/v3/mail/send',
            {
                personalizations: [
                    {
                        to: [{ email: to }],
                        subject: subject,
                        custom_args: {
                            leadId: leadId,
                            leadModel: leadModel,
                            campaignId: campaignId
                        }
                    }
                ],
                from: {
                    email: fromEmail,
                    name: fromName
                },
                content: [
                    {
                        type: 'text/html',
                        value: finalHtml
                    }
                ],
                tracking_settings: {
                    click_tracking: {
                        enable: true,
                        enable_text: false
                    },
                    open_tracking: {
                        enable: true
                    }
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Retrieve SendGrid message ID if provided in response headers (X-Message-Id)
        const messageId = response.headers['x-message-id'] || null;
        return { success: true, messageId };
    } catch (err) {
        const errorDetails = err.response?.data ? JSON.stringify(err.response.data) : err.message;
        console.error('[SendGrid Service] Failed to send mail:', errorDetails);
        return { success: false, error: errorDetails };
    }
};

/**
 * Helper to send general system/notification emails via SendGrid
 */
export const sendGeneralEmail = async ({ to, subject, html }) => {
    const recipients = Array.isArray(to) ? to : [to];
    let lastResult = { success: true };
    for (const recipient of recipients) {
        lastResult = await sendSendGridMail({
            to: recipient,
            subject,
            html,
            leadId: 'system',
            leadModel: 'EALead',
            campaignId: 'system'
        });
    }
    return lastResult;
};

export default { sendSendGridMail, sendGeneralEmail };
