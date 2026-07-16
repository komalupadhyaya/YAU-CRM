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
export async function createZoomMeeting({ title, date_time, duration_minutes, alternative_hosts = [] }) {
    const token = await getAccessToken();

    if (!token) {
        // Return simulated Zoom link in developer mode
        const mockId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
        return {
            id: `mock_${mockId}`,
            join_url: `https://zoom.us/j/${mockId}`,
            start_url: `https://zoom.us/s/${mockId}`
        };
    }

    try {
        const payload = {
            topic: title.trim(),
            type: 2, // Scheduled Meeting
            start_time: new Date(date_time).toISOString(),
            duration: duration_minutes,
            timezone: 'America/New_York',
            settings: {
                host_video: true,
                participant_video: true,
                join_before_host: false, // Prevents candidate from starting meeting early
                waiting_room: true,      // Sends candidate to waiting room
                mute_upon_entry: true,
                approval_type: 2, // No approval required
                audio: 'both',
                enforce_login: false
            }
        };

        if (alternative_hosts.length > 0) {
            payload.settings.alternative_hosts = alternative_hosts.join(',');
        }

        let response;
        try {
            response = await axios.post('https://api.zoom.us/v2/users/me/meetings', payload, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
        } catch (postErr) {
            // Zoom Error 1114: invalid alternative host email(s).
            // Retry creating the meeting without alternative hosts so the link is still generated.
            if (postErr.response?.data?.code === 1114 && alternative_hosts.length > 0) {
                console.warn(`⚠️ Warning: Zoom alternative hosts validation failed (code 1114). Retrying meeting creation without alternative hosts...`);
                delete payload.settings.alternative_hosts;
                response = await axios.post('https://api.zoom.us/v2/users/me/meetings', payload, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
            } else {
                throw postErr;
            }
        }

        return {
            id: String(response.data.id),
            join_url: response.data.join_url,
            start_url: response.data.start_url
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
export async function updateZoomMeeting(zoomMeetingId, { title, date_time, duration_minutes, alternative_hosts = [] }) {
    if (!zoomMeetingId || zoomMeetingId.startsWith('mock_')) {
        console.log(`ℹ️ Skipping Zoom update for mock meeting ID: ${zoomMeetingId}`);
        return;
    }

    const token = await getAccessToken();
    if (!token) return;

    try {
        const patchData = {
            topic: title.trim(),
            start_time: new Date(date_time).toISOString(),
            duration: duration_minutes,
            settings: {
                join_before_host: false,
                waiting_room: true
            }
        };

        if (alternative_hosts.length > 0) {
            patchData.settings.alternative_hosts = alternative_hosts.join(',');
        }

        try {
            await axios.patch(`https://api.zoom.us/v2/meetings/${zoomMeetingId}`, patchData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
        } catch (patchErr) {
            // Zoom Error 1114: invalid alternative host email(s).
            // Retry updating the meeting without alternative hosts.
            if (patchErr.response?.data?.code === 1114 && alternative_hosts.length > 0) {
                console.warn(`⚠️ Warning: Zoom alternative hosts validation failed (code 1114). Retrying meeting update without alternative hosts...`);
                delete patchData.settings.alternative_hosts;
                await axios.patch(`https://api.zoom.us/v2/meetings/${zoomMeetingId}`, patchData, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
            } else {
                throw patchErr;
            }
        }
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
