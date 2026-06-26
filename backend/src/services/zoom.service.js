import axios from 'axios';

let cachedToken = null;
let tokenExpiresAt = null;

/**
 * Retrieves a Zoom access token using Server-to-Server OAuth.
 * Caches the token in-memory and reuses it until expiration.
 */
async function getAccessToken() {
    const clientId = process.env.Zoom_Client_Id || process.env.ZOOM_CLIENT_ID;
    const clientSecret = process.env.Zoom_Client_Secret || process.env.ZOOM_CLIENT_SECRET;
    const accountId = process.env.ZOOM_ACCOUNT_ID || process.env.Zoom_Account_Id;

    if (!clientId || !clientSecret || !accountId) {
        console.warn("⚠️ Zoom API credentials (Zoom_Client_Id, Zoom_Client_Secret, ZOOM_ACCOUNT_ID) are incomplete. Zoom meetings will operate in Mock Mode.");
        return null;
    }

    // Return cached token if still valid (with a 60-second safety buffer)
    if (cachedToken && tokenExpiresAt && Date.now() < (tokenExpiresAt - 60000)) {
        return cachedToken;
    }

    try {
        const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const response = await axios.post('https://zoom.us/oauth/token', null, {
            params: {
                grant_type: 'account_credentials',
                account_id: accountId
            },
            headers: {
                'Authorization': `Basic ${authHeader}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        cachedToken = response.data.access_token;
        tokenExpiresAt = Date.now() + (response.data.expires_in * 1000);
        return cachedToken;
    } catch (err) {
        console.error('❌ Failed to fetch Zoom access token:', err.response?.data || err.message);
        throw new Error('Zoom authentication failed');
    }
}

/**
 * Creates a scheduled Zoom meeting.
 * @param {Object} meetingData
 * @param {string} meetingData.title
 * @param {Date|string} meetingData.date_time
 * @param {number} meetingData.duration_minutes
 * @returns {Promise<{ id: string, join_url: string }>}
 */
export async function createZoomMeeting({ title, date_time, duration_minutes }) {
    const token = await getAccessToken();

    if (!token) {
        // Return simulated Zoom link in developer mode
        const mockId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
        return {
            id: `mock_${mockId}`,
            join_url: `https://zoom.us/j/${mockId}`
        };
    }

    try {
        const response = await axios.post('https://api.zoom.us/v2/users/me/meetings', {
            topic: title.trim(),
            type: 2, // Scheduled Meeting
            start_time: new Date(date_time).toISOString(),
            duration: duration_minutes,
            timezone: 'America/New_York',
            settings: {
                host_video: true,
                participant_video: true,
                join_before_host: true,
                mute_upon_entry: true,
                approval_type: 2, // No approval required
                audio: 'both',
                enforce_login: false
            }
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        return {
            id: String(response.data.id),
            join_url: response.data.join_url
        };
    } catch (err) {
        console.error('❌ Zoom Meeting Creation Error:', err.response?.data || err.message);
        throw new Error('Failed to create Zoom meeting');
    }
}

/**
 * Updates an existing scheduled Zoom meeting.
 * @param {string} zoomMeetingId
 * @param {Object} meetingData
 * @param {string} meetingData.title
 * @param {Date|string} meetingData.date_time
 * @param {number} meetingData.duration_minutes
 */
export async function updateZoomMeeting(zoomMeetingId, { title, date_time, duration_minutes }) {
    if (!zoomMeetingId || zoomMeetingId.startsWith('mock_')) {
        console.log(`ℹ️ Skipping Zoom update for mock meeting ID: ${zoomMeetingId}`);
        return;
    }

    const token = await getAccessToken();
    if (!token) return;

    try {
        await axios.patch(`https://api.zoom.us/v2/meetings/${zoomMeetingId}`, {
            topic: title.trim(),
            start_time: new Date(date_time).toISOString(),
            duration: duration_minutes
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`✅ Zoom meeting updated successfully: ${zoomMeetingId}`);
    } catch (err) {
        console.error(`❌ Zoom Meeting Update Error (${zoomMeetingId}):`, err.response?.data || err.message);
        // Do not block CRM updates if Zoom sync fails, just log it
    }
}

/**
 * Deletes a scheduled Zoom meeting.
 * @param {string} zoomMeetingId
 */
export async function deleteZoomMeeting(zoomMeetingId) {
    if (!zoomMeetingId || zoomMeetingId.startsWith('mock_')) {
        console.log(`ℹ️ Skipping Zoom delete for mock meeting ID: ${zoomMeetingId}`);
        return;
    }

    const token = await getAccessToken();
    if (!token) return;

    try {
        await axios.delete(`https://api.zoom.us/v2/meetings/${zoomMeetingId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        console.log(`✅ Zoom meeting deleted successfully: ${zoomMeetingId}`);
    } catch (err) {
        console.error(`❌ Zoom Meeting Deletion Error (${zoomMeetingId}):`, err.response?.data || err.message);
        // Non-blocking log
    }
}
