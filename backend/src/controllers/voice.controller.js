import twilio from 'twilio';
import VoiceResponse from 'twilio/lib/twiml/VoiceResponse.js';
import PhoneConfig from '../models/phoneConfig.model.js';
import Lead from '../models/lead.model.js';
import Contact from '../models/contact.model.js';
import Note from '../models/note.model.js';
import Voicemail from '../models/voicemail.model.js';
import fs from 'fs';
import path from 'path';
import User from '../models/user.model.js';
import Call from '../models/call.model.js';
import nodemailer from 'nodemailer';

const { AccessToken } = twilio.jwt;
const { VoiceGrant } = AccessToken;

/**
 * In-memory buffer for recording URLs that arrive before the note/callHistory exists.
 * Key: CallSid (string), Value: { url, duration, receivedAt }
 * Entries are auto-cleaned after 30 minutes.
 */
const pendingRecordings = new Map();
const PENDING_RECORDING_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * In-memory map tracking the agent call status for each queue.
 * Key: queueName (e.g. "q_CA..."), Value: 'pending' | 'failed' | 'answered'
 * Used by handleHoldMusic to poll the agent status and redirect the caller
 * to the busy/voicemail prompt as soon as the agent declines or doesn't answer.
 */
const agentCallStatusMap = new Map();
const AGENT_STATUS_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL

/**
 * In-memory map tracking parentCallSid -> childCallSid (outbound agent call)
 * Key: parentCallSid, Value: childCallSid
 */
const parentChildCallMap = new Map();

const storePendingRecording = (callSid, url, duration) => {
    pendingRecordings.set(callSid, { url, duration, receivedAt: Date.now() });
    // Auto-clean expired entries to prevent memory leak
    setTimeout(() => pendingRecordings.delete(callSid), PENDING_RECORDING_TTL_MS);
    console.log(`💾 Stored pending recording for ${callSid} (buffer size: ${pendingRecordings.size})`);
};

const consumePendingRecording = (callSid) => {
    const entry = pendingRecordings.get(callSid);
    if (entry) {
        pendingRecordings.delete(callSid);
        console.log(`✅ Consumed pending recording for ${callSid} from buffer`);
    }
    return entry || null;
};

// Helper: Normalize and find Lead by phone number
const findLeadByPhone = async (phoneNumber) => {
    if (!phoneNumber) return null;
    // Clean phone number: keep only last 10 digits
    const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length < 7) return null;

    // 1. Search Lead telephone
    let lead = await Lead.findOne({
        telephone: { $regex: new RegExp(cleanPhone + '$') }
    });

    if (lead) return lead;

    // 2. Search Contact direct_phone
    const contact = await Contact.findOne({
        direct_phone: { $regex: new RegExp(cleanPhone + '$') }
    }).populate('lead_id');

    if (contact && contact.lead_id) {
        return contact.lead_id;
    }

    return null;
};

const getAbsoluteUrl = (req, relativePath) => {
    if (process.env.BACKEND_URL) {
        const baseUrl = process.env.BACKEND_URL.trim().replace(/\/$/, '');
        const cleanPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
        return `${baseUrl}${cleanPath}`;
    }
    const host = req.get('host');
    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    return `${isSecure ? 'https' : 'http'}://${host}${relativePath}`;
};

// 1. Generate Access Token for Browser Phone
export const getVoiceToken = async (req, res, next) => {
    try {
        const { TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET, TWILIO_TWIML_APP_SID } = process.env;

        if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY || !TWILIO_API_SECRET || !TWILIO_TWIML_APP_SID) {
            res.status(500);
            throw new Error('Twilio voice credentials are not fully configured on the server.');
        }

        let identity = req.user.email;
        if (!identity && req.user.id) {
            const user = await User.findById(req.user.id);
            if (user) {
                identity = user.email;
            }
        }

        if (!identity) {
            res.status(400);
            throw new Error('User identity (email) is required to generate a Voice Token.');
        }

        const token = new AccessToken(
            TWILIO_ACCOUNT_SID,
            TWILIO_API_KEY,
            TWILIO_API_SECRET,
            { identity, ttl: 3600 }
        );

        const voiceGrant = new VoiceGrant({
            outgoingApplicationSid: TWILIO_TWIML_APP_SID,
            incomingAllow: true
        });

        token.addGrant(voiceGrant);

        res.json({ token: token.toJwt(), identity });
    } catch (err) {
        next(err);
    }
};

// 2. Handle Outbound Call (TwiML App Webhook)
export const handleOutboundCall = async (req, res, next) => {
    try {
        const twiml = new VoiceResponse();
        const to = req.body.To;

        if (!to) {
            twiml.say('No phone number was provided to dial.');
            res.type('text/xml');
            return res.send(twiml.toString());
        }

        // Resolve agent identity
        let agentEmail = req.body.From || '';
        if (agentEmail.startsWith('client:')) {
            agentEmail = agentEmail.replace('client:', '');
        }

        let user = null;
        if (agentEmail) {
            user = await User.findOne({ 
                $or: [
                    { email: agentEmail },
                    { username: agentEmail }
                ]
            });
        }

        // Resolve associated lead (optional)
        let leadId = req.body.leadId || null;
        if (!leadId) {
            const lead = await findLeadByPhone(to);
            if (lead) leadId = lead._id;
        }

        // Create initial Call record
        if (req.body.CallSid) {
            await Call.create({
                callSid: req.body.CallSid,
                direction: 'outbound',
                fromNumber: req.body.From || process.env.TWILIO_PHONE_NUMBER,
                toNumber: to,
                user_id: user ? user._id : null,
                lead_id: leadId,
                status: 'ringing',
                timestamp: new Date()
            });
            console.log(`✅ Outbound call record initialized in DB: ${req.body.CallSid}`);
        }

        // Dial the number, enable recording
        const dial = twiml.dial({
            callerId: process.env.TWILIO_PHONE_NUMBER,
            record: 'record-from-answer-dual',
            recordingStatusCallback: getAbsoluteUrl(req, '/api/voice/call-status'),
            recordingStatusCallbackMethod: 'POST',
            action: getAbsoluteUrl(req, '/api/voice/call-status')
        });

        dial.number(to);

        res.type('text/xml');
        res.send(twiml.toString());
    } catch (err) {
        next(err);
    }
};

// 3. Handle Inbound Call (Main Number Webhook - Grasshopper IVR)
export const handleInboundCall = async (req, res, next) => {
    try {
        const parentCallSid = req.body.CallSid;
        const fromNum = req.body.From;
        const toNum = req.body.To;

        if (parentCallSid) {
            const companyPhone = process.env.TWILIO_PHONE_NUMBER;
            const isInternalDial = fromNum && companyPhone && 
                (fromNum.replace(/\D/g, '').slice(-10) === companyPhone.replace(/\D/g, '').slice(-10));

            let linked = false;
            if (isInternalDial) {
                const fifteenSecondsAgo = new Date(Date.now() - 15 * 1000);
                const matchingOutbound = await Call.findOne({
                    direction: 'outbound',
                    toNumber: { $regex: new RegExp(companyPhone.replace(/\D/g, '').slice(-10) + '$') },
                    createdAt: { $gte: fifteenSecondsAgo }
                }).sort({ createdAt: -1 });

                if (matchingOutbound) {
                    matchingOutbound.inboundCallSid = parentCallSid;
                    await matchingOutbound.save();
                    console.log(`🔗 Linked inbound call ${parentCallSid} to outbound call ${matchingOutbound.callSid} (Priyanshu outbound flow)`);
                    linked = true;
                }
            }

            if (!linked) {
                const lead = await findLeadByPhone(fromNum);
                await Call.create({
                    callSid: parentCallSid,
                    direction: 'inbound',
                    fromNumber: fromNum || 'Unknown Caller',
                    toNumber: toNum || companyPhone,
                    lead_id: lead ? lead._id : null,
                    status: 'ringing',
                    timestamp: new Date()
                });
                console.log(`✅ Inbound call record initialized in DB: ${parentCallSid}`);
            }
        }

        let config = await PhoneConfig.findOne();
        
        // Seed a default config if none exists
        if (!config) {
            config = await PhoneConfig.create({
                greeting: {
                    type: 'text-to-speech',
                    message: 'Thank you for calling Youth Athlete University. Please press 1 for Sales, or press 2 for Support.'
                },
                holdMusic: {},
                voicemail: {
                    enabled: true,
                    emailNotification: process.env.ADMIN_EMAIL || 'team@yausports.com'
                },
                callRouting: {
                    defaultForwardTo: ''
                }
            });
        } else {
            let updated = false;
            if (!config.holdMusic) {
                config.holdMusic = {};
                updated = true;
            }
            if (!config.callRouting) {
                config.callRouting = { defaultForwardTo: '' };
                updated = true;
            }
            if (updated) {
                await config.save();
            }
        }



        const twiml = new VoiceResponse();

        // 2. Build Extension / IVR Menu if extensions exist
        if (config.extensions && config.extensions.length > 0) {
            const gather = twiml.gather({
                numDigits: 1,
                action: getAbsoluteUrl(req, '/api/voice/handle-extension'),
                timeout: 10  // Wait up to 10s after the greeting ends for input
            });

            // Play Greeting inside the gather block so callers can "barge-in" (press digits during the greeting)
            if (config.greeting.type === 'audio-file' && config.greeting.audioFileUrl) {
                gather.play(config.greeting.audioFileUrl);
            } else {
                gather.say(config.greeting.message);
            }

            // Only read extension labels aloud if the admin has enabled this option.
            // When announceExtensions is false (default), only the Greeting Message is
            // heard — the greeting itself should already tell the caller what to press.
            if (config.announceExtensions) {
                const sortedExtensions = [...config.extensions].sort((a, b) => a.digit - b.digit);
                sortedExtensions.forEach(ext => {
                    gather.say(`Press ${ext.digit} for ${ext.label}.`);
                });
            }
            
            // If they press nothing, fall back to default routing
            twiml.redirect(getAbsoluteUrl(req, '/api/voice/handle-extension?timeout=true'));
        } else {
            // No extensions, play greeting outside and route directly to fallback or voicemail
            if (config.greeting.type === 'audio-file' && config.greeting.audioFileUrl) {
                twiml.play(config.greeting.audioFileUrl);
            } else {
                twiml.say(config.greeting.message);
            }

            if (config.callRouting.defaultForwardTo) {
                const dial = twiml.dial({
                    action: getAbsoluteUrl(req, '/api/voice/handle-dial-action'),
                    timeout: 20,
                    record: 'record-from-answer-dual',
                    recordingStatusCallback: getAbsoluteUrl(req, '/api/voice/call-status')
                });
                
                const forward = config.callRouting.defaultForwardTo;
                if (forward.includes('@')) {
                    dial.client(forward);
                } else {
                    dial.number(forward);
                }
            } else if (config.voicemail.enabled) {
                twiml.redirect(getAbsoluteUrl(req, '/api/voice/handle-dial-action?voicemail=true'));
            } else {
                twiml.say('Thank you for calling. Goodbye.');
                twiml.hangup();
            }
        }

        res.type('text/xml');
        res.send(twiml.toString());
    } catch (err) {
        next(err);
    }
};

// 4. Handle IVR Digit Pressed
export const handleExtension = async (req, res, next) => {
    try {
        const digit = req.body.Digits;
        const isTimeout = req.query.timeout === 'true';
        const config = await PhoneConfig.findOne();
        const twiml = new VoiceResponse();

        if (!config) {
            twiml.say('System configuration error.');
            twiml.hangup();
            res.type('text/xml');
            return res.send(twiml.toString());
        }

        // Find extension matching digit
        const ext = config.extensions.find(e => e.digit === Number(digit));

        console.log(`📞 handleExtension: digit=${digit}, matched ext=`, ext ? JSON.stringify({ digit: ext.digit, label: ext.label, forwardTo: ext.forwardTo }) : 'NONE');

        if (ext) {
            // Normalize forwardTo to E.164 format if it's a phone number (not a browser client email)
            let dialTarget = ext.forwardTo.trim();
            const isBrowserClient = dialTarget.includes('@');

            if (!isBrowserClient) {
                // Strip all non-digit characters except leading +
                const digitsOnly = dialTarget.replace(/\D/g, '');
                // If 10 digits (US local), prefix with +1
                if (digitsOnly.length === 10) {
                    dialTarget = `+1${digitsOnly}`;
                } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
                    dialTarget = `+${digitsOnly}`;
                } else if (!dialTarget.startsWith('+')) {
                    dialTarget = `+${digitsOnly}`;
                }
            }

            console.log(`📡 Dialing target after normalization: "${dialTarget}" (browser client: ${isBrowserClient})`);

            // Place caller in Queue with Hold Music and Dial the Agent in parallel via REST API
            const parentCallSid = req.body.CallSid;
            const queueName = `q_${parentCallSid}`;

            // Initialize queue status as 'pending' — holdMusic endpoint polls this map
            agentCallStatusMap.set(queueName, 'pending');
            setTimeout(() => agentCallStatusMap.delete(queueName), AGENT_STATUS_TTL_MS);

            console.log(`📡 Queueing parent call ${parentCallSid} in queue "${queueName}"`);

            // Initialize Twilio REST client
            const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

            // Initiate outbound call to the target phone number or client browser identity
            const dialOptions = {
                from: process.env.TWILIO_PHONE_NUMBER,
                url: getAbsoluteUrl(req, `/api/voice/agent-join-queue?queueName=${queueName}`),
                statusCallback: getAbsoluteUrl(req, `/api/voice/agent-call-status?parentCallSid=${parentCallSid}&extId=${ext._id}`),
                statusCallbackEvent: ['completed'], // Trigger when call ends or fails (busy, no-answer, failed)
                timeout: 20, // 20 seconds ring timeout
                record: true, // Enable recording for this leg of the call
                recordingStatusCallback: getAbsoluteUrl(req, `/api/voice/call-status?parentCallSid=${parentCallSid}`),
                recordingStatusCallbackMethod: 'POST'
            };

            const targetAddress = isBrowserClient ? `client:${dialTarget}` : dialTarget;
            console.log(`🚀 Initiating outbound REST call to "${targetAddress}"`);

            client.calls.create({
                ...dialOptions,
                to: targetAddress
            }).then(call => {
                console.log(`🚀 Outbound call created with Sid: ${call.sid} for parent: ${parentCallSid}`);
                parentChildCallMap.set(parentCallSid, call.sid);
                // Auto-cleanup mapping after 15 minutes just in case
                setTimeout(() => parentChildCallMap.delete(parentCallSid), 15 * 60 * 1000);
            }).catch(err => {
                console.error(`❌ Failed to initiate Twilio outbound call to ${targetAddress}:`, err.message);
            });

            // Put the caller in the queue where they will hear the hold music
            twiml.enqueue({
                waitUrl: getAbsoluteUrl(req, '/api/voice/hold-music')
            }, queueName);
        } else {
            // Timeout or invalid digit
            if (isTimeout || !digit) {
                // If timeout, try default forwarding
                if (config.callRouting.defaultForwardTo) {
                    const dial = twiml.dial({
                        callerId: process.env.TWILIO_PHONE_NUMBER,
                        action: getAbsoluteUrl(req, '/api/voice/handle-dial-action?default=true'),
                        timeout: 20,
                        record: 'record-from-answer-dual',
                        recordingStatusCallback: getAbsoluteUrl(req, '/api/voice/call-status')
                    });
                    
                    if (config.callRouting.defaultForwardTo.includes('@')) {
                        dial.client(config.callRouting.defaultForwardTo);
                    } else {
                        dial.number(config.callRouting.defaultForwardTo);
                    }
                } else if (config.voicemail.enabled) {
                    twiml.redirect(getAbsoluteUrl(req, '/api/voice/handle-dial-action?voicemail=true'));
                } else {
                    twiml.say('Thank you for calling. Goodbye.');
                    twiml.hangup();
                }
            } else {
                // Invalid digit
                twiml.say('That is not a valid option.');
                twiml.redirect(getAbsoluteUrl(req, '/api/voice/inbound'));
            }
        }

        res.type('text/xml');
        res.send(twiml.toString());
    } catch (err) {
        next(err);
    }
};

// Debug logger helper to capture call flow details locally
const logDebug = (message) => {
    try {
        const logPath = path.join(process.cwd(), 'debug.log');
        fs.appendFileSync(logPath, `${new Date().toISOString()} - ${message}\n`);
    } catch (err) {
        console.error('Failed to write to debug.log:', err.message);
    }
};

// 4b. Return Hold Music TwiML Response (polling loop — re-called after each music play)
export const handleHoldMusic = async (req, res, next) => {
    try {
        // On the FIRST call: Twilio sends QueueFriendlyName in POST body (from <Enqueue waitUrl>)
        // On subsequent polls: we pass it as a query param in the <Redirect> URL
        const queueName = req.body.QueueFriendlyName || req.query.queueName;
        const agentStatus = queueName ? agentCallStatusMap.get(queueName) : null;

        logDebug(`🎵 handleHoldMusic: queueName=${queueName}, agentStatus=${agentStatus}`);

        const twiml = new VoiceResponse();

        // --- POLLING CHECK ---
        // If the agent declined/didn't answer, dequeue the caller immediately
        if (agentStatus === 'failed') {
            logDebug(`🔁 Polling detected agent failure for queue "${queueName}" — redirecting caller to busy prompt`);
            twiml.redirect(getAbsoluteUrl(req, '/api/voice/handle-dial-action?DialCallStatus=no-answer'));
            res.type('text/xml');
            return res.send(twiml.toString());
        }

        // --- STILL PENDING or ANSWERED ---
        // Play hold music ONCE, then redirect back to this endpoint to re-poll
        const config = await PhoneConfig.findOne();
        const useHoldMusic = config?.holdMusic?.enabled !== false; // Default to true if not specified

        if (useHoldMusic && config?.holdMusic?.audioFileUrl) {
            logDebug(`▶️ Playing custom hold music once: ${config.holdMusic.audioFileUrl}`);
            twiml.play(config.holdMusic.audioFileUrl); // plays once (default loop=1)
        } else {
            // Play default ringtone (ringback sound)
            logDebug('🔔 Playing default network ringback tone');
            twiml.play('https://raw.githubusercontent.com/baresip/baresip/master/share/ringback.wav');
        }

        // After music/pause finishes, redirect back to self to check agent status again
        const pollUrl = queueName
            ? getAbsoluteUrl(req, `/api/voice/hold-music?queueName=${encodeURIComponent(queueName)}`)
            : getAbsoluteUrl(req, '/api/voice/hold-music');
        twiml.redirect(pollUrl);

        res.type('text/xml');
        res.send(twiml.toString());
    } catch (err) {
        next(err);
    }
};

// 4c. Return Agent Join Queue TwiML Response
export const handleAgentJoinQueue = (req, res, next) => {
    try {
        const { queueName } = req.query;
        const twiml = new VoiceResponse();
        logDebug(`📡 Agent answered outbound call. Bridging agent to queue "${queueName}"`);
        const dial = twiml.dial();
        dial.queue(queueName);
        res.type('text/xml');
        res.send(twiml.toString());
    } catch (err) {
        next(err);
    }
};

// 4d. Handle Agent Call Status Callback (Redirect caller to voicemail if agent doesn't answer)
export const handleAgentCallStatus = async (req, res, next) => {
    try {
        const { parentCallSid, extId } = req.query;
        const { CallStatus } = req.body;
        const duration = req.body.CallDuration ? Number(req.body.CallDuration) : 0;
        const queueName = `q_${parentCallSid}`;

        logDebug(`📡 handleAgentCallStatus: status=${CallStatus}, duration=${duration}s, parentCallSid=${parentCallSid}, extId=${extId}`);

        // Determine if the call was actually answered and completed vs. failed/unanswered
        const isHardFailure = ['busy', 'no-answer', 'failed'].includes(CallStatus);
        const isCompletedUnanswered = CallStatus === 'completed' && duration === 0;
        const callFailed = isHardFailure || isCompletedUnanswered;
        const callAnswered = CallStatus === 'completed' && duration > 0;

        // --- STEP 1: Write result into agentCallStatusMap immediately ---
        // handleHoldMusic polls this map every time the hold music finishes and redirects the caller
        if (callFailed) {
            agentCallStatusMap.set(queueName, 'failed');
            logDebug(`📝 agentCallStatusMap['${queueName}'] = 'failed' (status=${CallStatus}, duration=${duration}s)`);
        } else if (callAnswered) {
            agentCallStatusMap.set(queueName, 'answered');
            logDebug(`📝 agentCallStatusMap['${queueName}'] = 'answered'`);
        }

        // --- STEP 1.5: If answered, associate parent call with this agent user ---
        if (callAnswered && parentCallSid && extId) {
            try {
                const config = await PhoneConfig.findOne();
                const ext = config?.extensions?.find(e => e._id.toString() === extId);
                if (ext) {
                    let agentEmail = ext.forwardTo.trim();
                    if (agentEmail.startsWith('client:')) {
                        agentEmail = agentEmail.replace('client:', '');
                    }
                    
                    let user = null;
                    if (agentEmail.includes('@')) {
                        user = await User.findOne({ 
                            $or: [
                                { email: agentEmail },
                                { username: agentEmail }
                            ]
                        });
                    } else {
                        user = await User.findOne({ name: { $regex: agentEmail, $options: 'i' } });
                    }

                    if (user) {
                        const callLog = await Call.findOne({
                            $or: [
                                { callSid: parentCallSid },
                                { inboundCallSid: parentCallSid }
                            ]
                        });

                        if (callLog) {
                            if (callLog.direction === 'outbound') {
                                callLog.forwardedToUser = user._id;
                            } else {
                                callLog.user_id = user._id;
                            }
                            await callLog.save();
                            console.log(`✅ Linked agent ${user.username} to Call record (SID: ${callLog.callSid}, direction: ${callLog.direction})`);
                        }
                    }
                }
            } catch (assocErr) {
                console.error('⚠️ Failed to associate agent with inbound call:', assocErr.message);
            }
        }

        // --- STEP 2: Also try REST API redirect as a fast-path ---
        // This immediately pulls the caller out of the hold music queue.
        // If this fails, the polling in handleHoldMusic will catch it after the current music loop ends.
        if (callFailed) {
            const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            try {
                const redirectStatus = isHardFailure ? CallStatus : 'no-answer';
                await client.calls(parentCallSid).update({
                    url: getAbsoluteUrl(req, `/api/voice/handle-dial-action?extId=${extId}&DialCallStatus=${redirectStatus}`)
                });
                logDebug(`✅ Fast-path: Redirected parent call ${parentCallSid} to handle-dial-action with DialCallStatus=${redirectStatus}`);
            } catch (err) {
                logDebug(`⚠️ Fast-path redirect failed (polling fallback will handle it): ${err.message}`);
            }
        }

        // Clean up parent-child call mapping as agent call has concluded
        if (parentCallSid) {
            parentChildCallMap.delete(parentCallSid);
        }

        res.sendStatus(200);
    } catch (err) {
        logDebug(`❌ Error in handleAgentCallStatus: ${err.message}`);
        res.sendStatus(200);
    }
};

// 5. Handle Dial Action (If forwarded call is busy/no-answer, route to voicemail)
export const handleDialAction = async (req, res, next) => {
    try {
        const dialStatus = req.body.DialCallStatus || req.query.DialCallStatus; // Read from body or query fallback
        const forceVoicemail = req.query.voicemail === 'true';
        
        logDebug(`📞 handleDialAction: dialStatus=${dialStatus}, forceVoicemail=${forceVoicemail}, body=${JSON.stringify(req.body)}, query=${JSON.stringify(req.query)}`);

        const config = await PhoneConfig.findOne();
        const twiml = new VoiceResponse();

        if (dialStatus === 'completed') {
            // Call was answered and finished normally
            logDebug(`ℹ️ Dial status is completed, hanging up.`);
            twiml.hangup();
            res.type('text/xml');
            return res.send(twiml.toString());
        }

        // If busy/no-answer/failed and voicemail is enabled
        if ((forceVoicemail || dialStatus !== 'completed') && config && config.voicemail.enabled) {
            // Ask caller if they want to leave a voicemail
            const gather = twiml.gather({
                numDigits: 1,
                action: getAbsoluteUrl(req, '/api/voice/handle-voicemail-choice'),
                timeout: 5
            });

            // Play voicemail greeting (custom MP3 or default TTS) during the Gather
            if (config.voicemail.useAudioFile && config.voicemail.audioFileUrl) {
                gather.play(config.voicemail.audioFileUrl);
            } else {
                gather.say(config.voicemail.ttsMessage || 'The department is busy. If you would like to leave a voicemail, please press 1.');
            }

            // Fallback: If they press nothing within 5 seconds, say goodbye and hang up
            twiml.say('Thank you for calling. Goodbye.');
            twiml.hangup();
        } else {
            twiml.say('Thank you for calling. Goodbye.');
            twiml.hangup();
        }

        res.type('text/xml');
        res.send(twiml.toString());
    } catch (err) {
        next(err);
    }
};

// 5b. Handle Voicemail Choice Digit Pressed
export const handleVoicemailChoice = async (req, res, next) => {
    try {
        const digit = req.body.Digits;
        const config = await PhoneConfig.findOne();
        const twiml = new VoiceResponse();

        if (digit === '1') {
            if (config && config.voicemail.enabled) {
                // The caller has chosen to leave a voicemail.
                twiml.say('Please leave your message after the beep.');
                
                // Record voicemail
                twiml.record({
                    action: getAbsoluteUrl(req, '/api/voice/voicemail-recording'),
                    maxLength: 300, // Wait up to 5 minutes
                    timeout: 0,     // Disable silence detection (record until hangup)
                    playBeep: true
                });
            } else {
                twiml.say('Voicemail is currently disabled. Thank you for calling. Goodbye.');
                twiml.hangup();
            }
        } else {
            twiml.say('Thank you for calling. Goodbye.');
            twiml.hangup();
        }

        res.type('text/xml');
        res.send(twiml.toString());
    } catch (err) {
        next(err);
    }
};

// 6. Handle Voicemail Recording Completion
export const handleVoicemailRecording = async (req, res, next) => {
    try {
        const { RecordingUrl, RecordingDuration, From, CallSid } = req.body;

        // Persist the voicemail to the database (append .mp3 for direct browser playback)
        if (RecordingUrl) {
            const playableUrl = RecordingUrl.endsWith('.mp3') ? RecordingUrl : `${RecordingUrl}.mp3`;
            await Voicemail.create({
                fromNumber:   From || 'Unknown Caller',
                recordingUrl: playableUrl,
                duration:     parseInt(RecordingDuration, 10) || 0,
                callSid:      CallSid || null,
            });

            // Sync recording URL to unified Call record
            try {
                const callRecord = await Call.findOne({
                    $or: [
                        { callSid: CallSid },
                        { inboundCallSid: CallSid }
                    ]
                });
                if (callRecord) {
                    callRecord.recordingUrl = playableUrl;
                    callRecord.duration = parseInt(RecordingDuration, 10) || callRecord.duration;
                    callRecord.status = 'voicemail';
                    await callRecord.save();
                    console.log(`✅ Linked voicemail recording to Call record: ${callRecord.callSid}`);
                }
            } catch (errCall) {
                console.error('❌ Failed to link voicemail recording to Call record:', errCall.message);
            }

            // --- Send Email Notification (if enabled) ---
            const config = await PhoneConfig.findOne();
            if (
                config &&
                config.voicemail.emailNotificationEnabled &&
                config.voicemail.emailNotification
            ) {
                try {
                    // Dynamically import the mailer service helper to avoid circular dependencies
                    const { sendVoicemailEmailNotification } = await import('../services/mailer.js');
                    await sendVoicemailEmailNotification({
                        to: config.voicemail.emailNotification,
                        fromNumber: From,
                        duration: parseInt(RecordingDuration, 10) || 0,
                        recordingUrl: playableUrl
                    });
                } catch (emailErr) {
                    console.error(`❌ Failed to send voicemail email notification:`, emailErr.message);
                }
            }
        }

        const twiml = new VoiceResponse();
        twiml.say('Your voicemail has been recorded. Thank you.');
        twiml.hangup();

        res.type('text/xml');
        res.send(twiml.toString());
    } catch (err) {
        next(err);
    }
};



// 7. Save Call Logs (Twilio Status Callback)
export const handleCallStatus = async (req, res, next) => {
    try {
        const { 
            CallSid, 
            To, 
            From, 
            CallDuration, 
            RecordingUrl, 
            CallStatus, 
            Direction,
            RecordingStatus,
            RecordingDuration
        } = req.body;

        const ParentCallSid = req.body.ParentCallSid || req.query.parentCallSid || req.query.ParentCallSid;

        console.log('☎️ Twilio Webhook:', JSON.stringify({ CallSid, ParentCallSid, CallStatus, RecordingStatus, RecordingUrl: RecordingUrl ? '[PRESENT]' : null, To, From }));

        // --- STEP A: Update Call collection ---
        try {
            let callRecord = await Call.findOne({
                $or: [
                    { callSid: CallSid },
                    { inboundCallSid: CallSid },
                    { parentCallSid: CallSid },
                    ...(ParentCallSid ? [
                        { callSid: ParentCallSid },
                        { inboundCallSid: ParentCallSid },
                        { parentCallSid: ParentCallSid }
                    ] : [])
                ]
            });

            const resolvedDuration = RecordingDuration ? Number(RecordingDuration) : (CallDuration ? Number(CallDuration) : 0);
            const cleanRecUrl = RecordingUrl ? (RecordingUrl.endsWith('.mp3') ? RecordingUrl : `${RecordingUrl}.mp3`) : null;

            if (callRecord) {
                if (CallStatus === 'completed') {
                    callRecord.status = 'completed';
                    if (resolvedDuration > 0) callRecord.duration = resolvedDuration;
                }
                if (cleanRecUrl) {
                    callRecord.recordingUrl = cleanRecUrl;
                    if (resolvedDuration > 0) callRecord.duration = resolvedDuration;
                }
                if (ParentCallSid && !callRecord.parentCallSid) {
                    callRecord.parentCallSid = ParentCallSid;
                }
                await callRecord.save();
                console.log(`✅ Call record updated for SID ${CallSid}: status=${callRecord.status}, duration=${callRecord.duration}, recording=${callRecord.recordingUrl ? 'YES' : 'NO'}`);
            } else {
                // Fallback creation
                let user = null;
                let fromEmail = From || '';
                if (fromEmail.startsWith('client:')) {
                    fromEmail = fromEmail.replace('client:', '');
                }
                if (fromEmail && fromEmail.includes('@')) {
                    user = await User.findOne({ email: fromEmail });
                }

                let leadId = null;
                const targetNumber = Direction === 'inbound' ? From : To;
                const lead = await findLeadByPhone(targetNumber);
                if (lead) leadId = lead._id;

                callRecord = await Call.create({
                    callSid: CallSid,
                    parentCallSid: ParentCallSid || null,
                    direction: Direction === 'inbound' ? 'inbound' : 'outbound',
                    fromNumber: From,
                    toNumber: To,
                    duration: resolvedDuration,
                    recordingUrl: cleanRecUrl,
                    status: CallStatus || 'completed',
                    user_id: user ? user._id : null,
                    lead_id: leadId,
                    timestamp: new Date()
                });
                console.log(`✅ Call record created on fallback for SID ${CallSid}`);
            }
        } catch (callLogErr) {
            console.error('❌ Failed to update Call record in DB:', callLogErr.message);
        }

        // Case 1: Call is completed (standard call completion webhook)
        // The action webhook fires when the <Dial> verb completes
        if (CallStatus === 'completed') {
            // Cancel outstanding child call to agent if parent inbound call hangs up
            const childCallSid = parentChildCallMap.get(CallSid);
            if (childCallSid) {
                parentChildCallMap.delete(CallSid);
                console.log(`📞 Inbound parent call ${CallSid} completed. Terminating active child call to agent/department: ${childCallSid}`);
                const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
                client.calls(childCallSid).update({ status: 'completed' }).catch(err => {
                    console.error(`⚠️ Failed to cancel child call ${childCallSid}:`, err.message);
                });
            }

            const targetNumber = Direction === 'inbound' ? From : To;
            const lead = await findLeadByPhone(targetNumber);

            if (lead) {
                // Check if this call is already logged in callHistory using either CallSid or ParentCallSid
                let loggedCall = lead.callHistory.find(c => 
                    c.callSid === CallSid || 
                    (ParentCallSid && c.callSid === ParentCallSid) ||
                    (c.parentCallSid && c.parentCallSid === CallSid) ||
                    (ParentCallSid && c.parentCallSid === ParentCallSid)
                );

                if (!loggedCall) {
                    lead.callHistory.push({
                        callSid: CallSid,
                        parentCallSid: ParentCallSid || null,
                        direction: Direction === 'inbound' ? 'inbound' : 'outbound',
                        duration: CallDuration ? Number(CallDuration) : 0,
                        recordingUrl: null, // recording URL comes in a separate async callback
                        status: CallStatus,
                        timestamp: new Date()
                    });
                    await lead.save();
                    console.log(`✅ callHistory updated for lead ${lead._id} with callSid ${CallSid} / parentCallSid ${ParentCallSid}`);
                } else {
                    let modified = false;
                    if (ParentCallSid && loggedCall.callSid === ParentCallSid) {
                        // The entry was created by frontend with parentCallSid in the callSid field.
                        // Let's swap it so callSid becomes the child CallSid and parentCallSid is the parent CallSid.
                        loggedCall.callSid = CallSid;
                        loggedCall.parentCallSid = ParentCallSid;
                        modified = true;
                    } else if (ParentCallSid && !loggedCall.parentCallSid) {
                        loggedCall.parentCallSid = ParentCallSid;
                        modified = true;
                    }
                    if (modified) {
                        lead.markModified('callHistory');
                        await lead.save();
                        console.log(`✅ callHistory matched & updated for lead ${lead._id} with parentCallSid ${ParentCallSid}`);
                    }
                }

                // Check if we already created the automated call log note using either CallSid or ParentCallSid
                const noteExists = await Note.findOne({
                    $or: [
                        { "metadata.callSid": CallSid },
                        { "metadata.parentCallSid": CallSid },
                        ...(ParentCallSid ? [
                            { "metadata.callSid": ParentCallSid },
                            { "metadata.parentCallSid": ParentCallSid }
                        ] : [])
                    ]
                });
                
                if (!noteExists) {
                    const durationSec = CallDuration ? Number(CallDuration) : 0;
                    const minutes = Math.floor(durationSec / 60);
                    const seconds = durationSec % 60;
                    const durationText = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
                    const content = `CALL LOG: ${Direction === 'inbound' ? '📲 Inbound' : '📞 Outbound'} Call\nStatus: ${CallStatus}\nDuration: ${durationText}`;

                    // Check if recording callback already fired before us (race condition buffer)
                    const bufferedRecording = consumePendingRecording(CallSid) || (ParentCallSid ? consumePendingRecording(ParentCallSid) : null);

                    const newNote = await Note.create({
                        lead_id: lead._id,
                        content,
                        type: 'call',
                        metadata: {
                            callSid: CallSid,
                            parentCallSid: ParentCallSid || null,
                            outcome: CallStatus,
                            recording_duration: bufferedRecording?.duration || durationSec,
                            recording_url: bufferedRecording?.url || null
                        }
                    });

                    if (bufferedRecording) {
                        console.log(`🎙️  Auto-log Note ${newNote._id} created WITH buffered recording URL (race won by recording callback)`);
                    } else {
                        console.log(`✅ Call log Note created for lead ${lead._id} (recording URL will arrive later)`);
                    }

                    // Also backfill callHistory with buffered recording if available
                    if (bufferedRecording) {
                        lead.callHistory = lead.callHistory.map(call => {
                            if (
                                call.callSid === CallSid || 
                                (ParentCallSid && call.callSid === ParentCallSid) ||
                                (call.parentCallSid && call.parentCallSid === CallSid) ||
                                (ParentCallSid && call.parentCallSid === ParentCallSid)
                            ) {
                                call.recordingUrl = bufferedRecording.url;
                            }
                            return call;
                        });
                        lead.markModified('callHistory');
                        await lead.save();
                    }
                } else {
                    let noteModified = false;
                    if (ParentCallSid && !noteExists.metadata.parentCallSid) {
                        noteExists.metadata = {
                            ...noteExists.metadata,
                            parentCallSid: ParentCallSid
                        };
                        noteExists.markModified('metadata');
                        await noteExists.save();
                        noteModified = true;
                    }
                    if (noteModified) {
                        console.log(`✅ Existing auto-log Note updated with parentCallSid: ${ParentCallSid}`);
                    }
                }
            } else {
                console.warn(`⚠️  No lead found for number: ${targetNumber}`);
            }
        }

        // Case 2: Recording is ready (async recording status callback from Twilio)
        // This fires SEPARATELY and LATER than the call-completed webhook.
        if (RecordingStatus === 'completed' && RecordingUrl) {
            console.log(`🎙️  Recording callback received for CallSid: ${CallSid}, ParentCallSid: ${ParentCallSid}, URL: ${RecordingUrl}`);

            // Append .mp3 so browsers can play the audio directly
            const playableRecordingUrl = RecordingUrl.endsWith('.mp3') ? RecordingUrl : `${RecordingUrl}.mp3`;

            // Strategy 1: Find lead via callHistory.callSid OR callHistory.parentCallSid
            let lead = await Lead.findOne({
                $or: [
                    { "callHistory.callSid": CallSid },
                    { "callHistory.parentCallSid": CallSid },
                    ...(ParentCallSid ? [
                        { "callHistory.callSid": ParentCallSid },
                        { "callHistory.parentCallSid": ParentCallSid }
                    ] : [])
                ]
            });

            if (lead) {
                // Update the recording URL in callHistory
                lead.callHistory = lead.callHistory.map(call => {
                    if (
                        call.callSid === CallSid || 
                        (ParentCallSid && call.callSid === ParentCallSid) ||
                        (call.parentCallSid && call.parentCallSid === CallSid) ||
                        (ParentCallSid && call.parentCallSid === ParentCallSid)
                    ) {
                        call.recordingUrl = playableRecordingUrl;
                    }
                    return call;
                });
                lead.markModified('callHistory');
                await lead.save();
                console.log(`✅ callHistory recording URL updated for lead ${lead._id}`);
            } else {
                console.warn(`⚠️  Recording callback: no lead found via callSid ${CallSid} / parent ${ParentCallSid} in callHistory yet. Will try Note update only.`);
            }

            // Update ALL notes that have this callSid or parentCallSid
            const notes = await Note.find({
                $or: [
                    { "metadata.callSid": CallSid },
                    { "metadata.parentCallSid": CallSid },
                    ...(ParentCallSid ? [
                        { "metadata.callSid": ParentCallSid },
                        { "metadata.parentCallSid": ParentCallSid }
                    ] : [])
                ]
            });
            console.log(`📝 Found ${notes.length} note(s) to update with recording URL`);

            for (const note of notes) {
                note.metadata = {
                    ...note.metadata,
                    recording_url: playableRecordingUrl,
                    recording_duration: RecordingDuration ? Number(RecordingDuration) : (note.metadata?.recording_duration || 0)
                };
                note.markModified('metadata');
                await note.save();
                console.log(`✅ Note ${note._id} updated with recording_url`);
            }

            if (notes.length === 0) {
                // Neither the auto-log note NOR logCallOutcome note exists yet.
                // Store in buffer under both SIDs to be absolutely sure.
                storePendingRecording(CallSid, playableRecordingUrl, RecordingDuration ? Number(RecordingDuration) : 0);
                if (ParentCallSid) {
                    storePendingRecording(ParentCallSid, playableRecordingUrl, RecordingDuration ? Number(RecordingDuration) : 0);
                }
                console.warn(`⏳ Recording buffered for ${CallSid} / ${ParentCallSid} — note doesn't exist yet, will be applied when action callback completes.`);
            }
        }

        res.sendStatus(200);
    } catch (err) {
        console.error('❌ Error in handleCallStatus:', err.message, err.stack);
        res.sendStatus(200); // Always return 200 to Twilio to prevent webhook retries
    }
};

// 7b. Manually Log Call Outcome from CRM UI
export const logCallOutcome = async (req, res, next) => {
    try {
        const { lead_id, outcome, notes, contact_name, callSid: frontendCallSid } = req.body;

        if (!lead_id || !outcome) {
            res.status(400);
            throw new Error('lead_id and outcome are required');
        }

        // Retrieve full Lead with callHistory
        const lead = await Lead.findById(lead_id);
        if (!lead) {
            res.status(404);
            throw new Error('Lead not found');
        }
        if (req.currentUserRole === 'sales_rep' && (!lead.assigned_to || lead.assigned_to.toString() !== req.user.id)) {
            res.status(403);
            throw new Error('Access denied. This lead is not assigned to you.');
        }

        // Find the most recent call in callHistory (within the last 10 minutes)
        let callSid = frontendCallSid || null;
        let recordingUrl = null;

        if (!callSid && lead.callHistory && lead.callHistory.length > 0) {
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
            // Search from the end of the array (most recent first)
            for (let i = lead.callHistory.length - 1; i >= 0; i--) {
                const call = lead.callHistory[i];
                if (new Date(call.timestamp) >= tenMinutesAgo) {
                    callSid = call.callSid;
                    recordingUrl = call.recordingUrl;
                    break;
                }
            }
        }

        // If callHistory doesn't have the recording URL yet, check the in-memory buffer
        // (recording callback may have arrived before the action callback finished writing)
        let recordingDuration = null;
        let parentCallSid = null;
        if (callSid) {
            const matchingCall = lead.callHistory.find(c => c.callSid === callSid || (c.parentCallSid && c.parentCallSid === callSid));
            if (matchingCall) {
                recordingUrl = matchingCall.recordingUrl || null;
                recordingDuration = matchingCall.duration || null;
                parentCallSid = matchingCall.parentCallSid || null;
            }

            if (!recordingUrl) {
                const buffered = consumePendingRecording(callSid);
                if (buffered) {
                    recordingUrl = buffered.url;
                    recordingDuration = buffered.duration;
                    console.log(`🎙️  logCallOutcome: applied buffered recording URL for callSid ${callSid}`);
                }
            }
        }

        const content = `CALL LOG: ${outcome}\nContact: ${contact_name || 'Unknown'}\nNotes: ${notes || 'None'}`;

        const note = await Note.create({
            lead_id,
            content,
            type: 'call',
            metadata: { 
                outcome, 
                contact_name,
                callSid,
                parentCallSid: parentCallSid || null,
                recording_url: recordingUrl || null,
                ...(recordingDuration != null ? { recording_duration: recordingDuration } : {})
            }
        });

        console.log(`✅ logCallOutcome note created: ${note._id}, callSid: ${callSid}, recording: ${recordingUrl ? 'YES' : 'NO (will arrive later)'}`);

        // Update callHistory if it's not already logged (ensures call appears in Call History tab)
        if (callSid) {
            // Update or create Call Log in our new Call collection
            try {
                let callRecord = await Call.findOne({ callSid: callSid });
                if (!callRecord) {
                    callRecord = await Call.create({
                        callSid: callSid,
                        parentCallSid: parentCallSid || null,
                        direction: 'outbound',
                        fromNumber: process.env.TWILIO_PHONE_NUMBER,
                        toNumber: lead.telephone || 'Unknown',
                        duration: recordingDuration || 0,
                        recordingUrl: recordingUrl || null,
                        status: 'completed',
                        user_id: req.user?.id || null,
                        lead_id: lead._id,
                        timestamp: new Date()
                    });
                    console.log(`✅ logCallOutcome: created Call record for SID ${callSid}`);
                } else {
                    let updated = false;
                    if (recordingUrl && !callRecord.recordingUrl) {
                        callRecord.recordingUrl = recordingUrl;
                        updated = true;
                    }
                    if (recordingDuration && callRecord.duration === 0) {
                        callRecord.duration = recordingDuration;
                        updated = true;
                    }
                    if (updated) {
                        await callRecord.save();
                        console.log(`✅ logCallOutcome: updated Call record for SID ${callSid}`);
                    }
                }
            } catch (errCall) {
                console.error('❌ Failed to logCallOutcome Call record:', errCall.message);
            }

            const alreadyInHistory = lead.callHistory.some(c => c.callSid === callSid || (c.parentCallSid && c.parentCallSid === callSid));
            if (!alreadyInHistory) {
                lead.callHistory.push({
                    callSid: callSid,
                    parentCallSid: parentCallSid || null,
                    direction: 'outbound',
                    duration: recordingDuration || 0,
                    recordingUrl: recordingUrl || null,
                    status: 'completed',
                    timestamp: new Date()
                });
                lead.markModified('callHistory');
                await lead.save();
                console.log(`✅ logCallOutcome: added callSid ${callSid} to lead ${lead._id} callHistory`);
            }
        }

        res.json({ success: true, followup_needed: outcome.includes('Follow-Up Needed'), note_id: note._id });
    } catch (err) {
        next(err);
    }
};

// 8. Admin Config CRUD
export const getConfig = async (req, res, next) => {
    try {
        let config = await PhoneConfig.findOne();
        if (!config) {
            config = await PhoneConfig.create({
                greeting: {
                    type: 'text-to-speech',
                    message: 'Thank you for calling Youth Athlete University. Please press 1 for Sales, or press 2 for Support.'
                },
                holdMusic: {},
                voicemail: {
                    enabled: true,
                    emailNotification: process.env.ADMIN_EMAIL || 'team@yausports.com'
                },
                callRouting: {
                    defaultForwardTo: ''
                }
            });
        } else {
            let updated = false;
            if (!config.holdMusic) {
                config.holdMusic = {};
                updated = true;
            }
            if (!config.callRouting) {
                config.callRouting = { defaultForwardTo: '' };
                updated = true;
            }
            if (updated) {
                await config.save();
            }
        }
        res.json(config);
    } catch (err) {
        next(err);
    }
};

export const updateConfig = async (req, res, next) => {
    try {
        let config = await PhoneConfig.findOne();
        
        // Cache previous audio file URLs to check for updates
        const oldGreetingUrl = config?.greeting?.audioFileUrl;
        const oldHoldMusicUrl = config?.holdMusic?.audioFileUrl;
        const oldVoicemailUrl = config?.voicemail?.audioFileUrl;

        if (!config) {
            config = new PhoneConfig(req.body);
        } else {
            Object.assign(config, req.body);
        }
        await config.save();

        const newGreetingUrl = config?.greeting?.audioFileUrl;
        const newHoldMusicUrl = config?.holdMusic?.audioFileUrl;
        const newVoicemailUrl = config?.voicemail?.audioFileUrl;

        // Helper to delete a local upload file by URL
        const deleteLocalFileByUrl = (url) => {
            if (!url || typeof url !== 'string') return;
            if (url.includes('/uploads/')) {
                try {
                    const filename = url.split('/uploads/')[1];
                    if (filename) {
                        const filePath = path.join(process.cwd(), 'uploads', filename);
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                            console.log(`🗑️ Deleted legacy configuration audio file: ${filePath}`);
                        }
                    }
                } catch (err) {
                    console.error(`❌ Failed to delete local file for URL ${url}:`, err.message);
                }
            }
        };

        // If URLs changed, delete the old file to conserve server storage
        if (oldGreetingUrl && oldGreetingUrl !== newGreetingUrl) {
            deleteLocalFileByUrl(oldGreetingUrl);
        }
        if (oldHoldMusicUrl && oldHoldMusicUrl !== newHoldMusicUrl) {
            deleteLocalFileByUrl(oldHoldMusicUrl);
        }
        if (oldVoicemailUrl && oldVoicemailUrl !== newVoicemailUrl) {
            deleteLocalFileByUrl(oldVoicemailUrl);
        }

        res.json(config);
    } catch (err) {
        next(err);
    }
};

// 9. Upload Audio File (S3 or Local)
export const uploadAudio = async (req, res, next) => {
    try {
        if (!req.file) {
            res.status(400);
            throw new Error('No file uploaded');
        }

        const file = req.file;
        const filename = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;

        // Check if S3 environment variables are set
        const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_BUCKET_NAME, AWS_REGION } = process.env;

        if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY && AWS_BUCKET_NAME) {
            // Upload to S3
            try {
                // Dynamically import AWS SDK to avoid crash if not installed
                const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
                
                const s3Client = new S3Client({
                    region: AWS_REGION || 'us-east-1',
                    credentials: {
                        accessKeyId: AWS_ACCESS_KEY_ID,
                        secretAccessKey: AWS_SECRET_ACCESS_KEY
                    }
                });

                const uploadParams = {
                    Bucket: AWS_BUCKET_NAME,
                    Key: `audio/${filename}`,
                    Body: file.buffer,
                    ContentType: file.mimetype,
                    ACL: 'public-read'
                };

                await s3Client.send(new PutObjectCommand(uploadParams));
                
                const s3Url = `https://${AWS_BUCKET_NAME}.s3.${AWS_REGION || 'us-east-1'}.amazonaws.com/audio/${filename}`;
                return res.json({ url: s3Url });
            } catch (s3Error) {
                console.error('S3 Upload failed, falling back to local:', s3Error.message);
                // Fall through to local upload
            }
        }

        // Fallback: Upload locally
        const uploadDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, file.buffer);

        // Return local static URL
        const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
        const localUrl = `${backendUrl}/uploads/${filename}`;

        res.json({ url: localUrl });
    } catch (err) {
        next(err);
    }
};

// ─── Voicemail Inbox (Admin) ────────────────────────────────────────────────

// GET /api/voice/voicemails  – list all voicemails, newest first
export const getVoicemails = async (req, res, next) => {
    try {
        const voicemails = await Voicemail.find().sort({ createdAt: -1 }).limit(200).lean();
        res.json(voicemails);
    } catch (err) {
        next(err);
    }
};

// PATCH /api/voice/voicemails/:id/listened  – mark a voicemail as listened
export const markVoicemailListened = async (req, res, next) => {
    try {
        const vm = await Voicemail.findByIdAndUpdate(
            req.params.id,
            { listenedAt: new Date() },
            { new: true }
        );
        if (!vm) return res.status(404).json({ message: 'Voicemail not found.' });
        res.json(vm);
    } catch (err) {
        next(err);
    }
};

// DELETE /api/voice/voicemails/:id  – permanently remove a voicemail
export const deleteVoicemail = async (req, res, next) => {
    try {
        const vm = await Voicemail.findByIdAndDelete(req.params.id);
        if (!vm) return res.status(404).json({ message: 'Voicemail not found.' });
        res.json({ message: 'Voicemail deleted.' });
    } catch (err) {
        next(err);
    }
};

// --- Call History (Admin & Manager) ---
export const getCallHistory = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const search = req.query.search || '';

        const query = {};

        if (search) {
            // Find users matching search
            const users = await User.find({
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { username: { $regex: search, $options: 'i' } }
                ]
            }).select('_id');
            const userIds = users.map(u => u._id);

            // Find leads matching search
            const leads = await Lead.find({
                name: { $regex: search, $options: 'i' }
            }).select('_id');
            const leadIds = leads.map(l => l._id);

            query.$or = [
                { fromNumber: { $regex: search, $options: 'i' } },
                { toNumber: { $regex: search, $options: 'i' } },
                { user_id: { $in: userIds } },
                { forwardedToUser: { $in: userIds } },
                { lead_id: { $in: leadIds } }
            ];
        }

        const total = await Call.countDocuments(query);
        const calls = await Call.find(query)
            .populate('user_id', 'name username email')
            .populate('forwardedToUser', 'name username email')
            .populate('lead_id', 'name telephone')
            .sort({ timestamp: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({
            calls,
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        });
    } catch (err) {
        next(err);
    }
};

// Delete a call log record
export const deleteCallRecord = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await Call.findByIdAndDelete(id);
        if (!result) {
            return res.status(404).json({ message: 'Call log not found' });
        }
        res.json({ message: 'Call log deleted successfully' });
    } catch (err) {
        next(err);
    }
};

// Delete all call log records
export const deleteAllCallRecords = async (req, res, next) => {
    try {
        await Call.deleteMany({});
        res.json({ message: 'All call logs deleted successfully' });
    } catch (err) {
        next(err);
    }
};
