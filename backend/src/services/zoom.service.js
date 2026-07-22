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
 * Fetches the list of active users in the Zoom account.
 * Always includes the account owner (fetched via /users/me) so the primary
 * admin account is always visible in the attendee picker regardless of email differences.
 * Returns an array of { email, display_name, type } objects.
 * type: 1 = Basic, 2 = Licensed, 3 = On-prem.
 * Returns an empty array in Mock Mode (no credentials configured).
 */
export async function getZoomUsers() {
    const token = await getAccessToken();

    if (!token) {
        // Mock mode — return empty list so frontend falls back to showing all members
        return [];
    }

    try {
        const allUsers = [];
        const seenEmails = new Set();

        // Always fetch and include the primary account owner (Server-to-Server OAuth identity)
        try {
            const meRes = await axios.get('https://api.zoom.us/v2/users/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const me = meRes.data;
            const meEmail = (me.email || '').toLowerCase();
            if (meEmail) {
                seenEmails.add(meEmail);
                allUsers.push({
                    email: meEmail,
                    display_name: `${me.first_name || ''} ${me.last_name || ''}`.trim(),
                    type: me.type ?? 2, // Owner is always Licensed (type 2)
                    is_owner: true
                });
            }
        } catch (meErr) {
            console.warn('⚠️ Could not fetch Zoom account owner (/users/me):', meErr.response?.data?.message || meErr.message);
        }

        // Fetch all active users with pagination (status=active)
        let nextPageToken = '';
        do {
            const params = { status: 'active', page_size: 300 };
            if (nextPageToken) params.next_page_token = nextPageToken;

            const response = await axios.get('https://api.zoom.us/v2/users', {
                headers: { 'Authorization': `Bearer ${token}` },
                params
            });

            const data = response.data;
            (data.users || []).forEach(u => {
                const email = (u.email || '').toLowerCase();
                if (email && !seenEmails.has(email)) {
                    seenEmails.add(email);
                    allUsers.push({
                        email,
                        display_name: `${u.first_name || ''} ${u.last_name || ''}`.trim(),
                        type: u.type, // 1=Basic, 2=Licensed, 3=On-prem
                        status: u.status || 'active'
                    });
                }
            });

            nextPageToken = data.next_page_token || '';
        } while (nextPageToken);

        return allUsers;
    } catch (err) {
        console.error('❌ Failed to fetch Zoom users:', err.response?.data || err.message);
        return []; // Non-blocking — return empty list on failure
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
export async function createZoomMeeting({ title, date_time, duration_minutes, alternative_hosts = [], host_email }) {
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

        const targetUser = host_email ? host_email.trim() : 'me';
        let response;

        const makeMeetingPost = async (user, meetingPayload) => {
            return await axios.post(`https://api.zoom.us/v2/users/${user}/meetings`, meetingPayload, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
        };

        const isAltHostError = (err) => {
            const code = err.response?.data?.code;
            const msg = (err.response?.data?.message || err.message || '').toLowerCase();
            return code === 1114 || code === 1115 || msg.includes('alternative host');
        };

        try {
            console.log(`📡 Creating Zoom meeting under target host: "${targetUser}"`);
            response = await makeMeetingPost(targetUser, payload);
        } catch (postErr) {
            if (isAltHostError(postErr) && payload.settings.alternative_hosts) {
                console.warn(`⚠️ Warning: Zoom alternative_hosts validation failed under "${targetUser}". Retrying under "${targetUser}" without alternative_hosts...`);
                const payloadNoAlt = { ...payload, settings: { ...payload.settings } };
                delete payloadNoAlt.settings.alternative_hosts;
                try {
                    response = await makeMeetingPost(targetUser, payloadNoAlt);
                } catch (retryNoAltErr) {
                    if (targetUser !== 'me') {
                        console.warn(`⚠️ Warning: Zoom meeting creation under "${targetUser}" failed after retry: ${retryNoAltErr.response?.data?.message || retryNoAltErr.message}. Falling back to 'me'...`);
                        delete payload.settings.alternative_hosts;
                        response = await makeMeetingPost('me', payload);
                    } else {
                        throw retryNoAltErr;
                    }
                }
            } else if (targetUser !== 'me') {
                console.warn(`⚠️ Warning: Zoom meeting creation under "${targetUser}" failed: ${postErr.response?.data?.message || postErr.message}. Falling back to 'me'...`);
                const payloadNoAlt = { ...payload, settings: { ...payload.settings } };
                delete payloadNoAlt.settings.alternative_hosts;
                response = await makeMeetingPost('me', payloadNoAlt);
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
            // Zoom Error 1114 (invalid alternative host) or 1115 (unlicensed alternative host).
            // Retry updating the meeting without alternative hosts.
            const errCode = patchErr.response?.data?.code;
            if ((errCode === 1114 || errCode === 1115) && alternative_hosts.length > 0) {
                console.warn(`⚠️ Warning: Zoom alternative hosts validation failed (code ${errCode}). Retrying meeting update without alternative hosts...`);
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

/**
 * Invites or creates a user in Zoom User Management under Basic (Free) plan (type 1).
 * If user already exists in Zoom User Management, returns { exists: true, message: "User is already present in Zoom User Management." }.
 * If user is newly invited, calls POST /v2/users and returns { success: true, message: "Invitation email sent..." }.
 */
export async function inviteZoomUser(email, firstName = '', lastName = '') {
    const token = await getAccessToken();
    if (!token) {
        throw new Error('Zoom API credentials not configured. Please set Zoom_Client_Id and Zoom_Client_Secret.');
    }

    const normalizedEmail = (email || '').trim().toLowerCase();

    // 1. Check if user already exists in Zoom account
    try {
        const checkRes = await axios.get(`https://api.zoom.us/v2/users/${encodeURIComponent(normalizedEmail)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (checkRes.status === 200 && checkRes.data) {
            const isPending = checkRes.data.status === 'pending';
            return {
                exists: true,
                pending: isPending,
                success: true,
                message: isPending
                    ? `Invitation email was already sent to ${normalizedEmail} (Pending user acceptance).`
                    : `User ${normalizedEmail} is already present in Zoom User Management.`
            };
        }
    } catch (checkErr) {
        // 404 / 1001 means user is not present under this Zoom account — proceed to send invitation
        if (checkErr.response?.status !== 404 && checkErr.response?.data?.code !== 1001) {
            console.warn(`Zoom user check note for ${normalizedEmail}:`, checkErr.response?.data?.message || checkErr.message);
        }
    }

    // 2. User is not present — invite them with Basic plan (type 1)
    try {
        const inviteRes = await axios.post('https://api.zoom.us/v2/users', {
            action: 'create',
            user_info: {
                email: normalizedEmail,
                type: 1, // Basic (Free) plan
                first_name: firstName || normalizedEmail.split('@')[0],
                last_name: lastName || ''
            }
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`✅ Zoom user invitation sent successfully to ${normalizedEmail}`);
        return {
            success: true,
            exists: false,
            message: `Invitation email sent to ${normalizedEmail} to join Zoom User Management under Basic (Free) plan.`,
            zoom_id: inviteRes.data?.id
        };
    } catch (inviteErr) {
        const code = inviteErr.response?.data?.code;
        const msg = inviteErr.response?.data?.message || inviteErr.message;

        // Code 1005 / "User already exists" fallback check
        if (code === 1005 || (msg && msg.toLowerCase().includes('already exists'))) {
            return {
                exists: true,
                success: true,
                message: `Invitation email was already sent to ${normalizedEmail} (Pending or active Zoom user).`
            };
        }

        // Scope error check
        if (msg && (msg.includes('scopes') || msg.includes('user:write'))) {
            throw new Error('Zoom App scope missing: Please enable "user:write:admin" scope under your App in marketplace.zoom.us');
        }

        console.error(`❌ Failed to invite Zoom user (${normalizedEmail}):`, inviteErr.response?.data || inviteErr.message);
        throw new Error(msg || 'Failed to send Zoom invitation');
    }
}

