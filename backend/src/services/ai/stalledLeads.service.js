/**
 * stalledLeads.service.js
 * ─────────────────────────────────────────────────────────────────
 * Stalled Lead Detection & Automated Re-engagement Service (Section 2)
 *
 * Scans both EA Leads and Main CRM Leads for inactivity:
 * - Hot (Red):    3 days without activity
 * - Warm (Yellow): 5 days without activity
 * - Cold (Blue):   7 days without activity
 *
 * When stalled:
 * 1. Flags lead with isStalled: true and daysInactive
 * 2. Invokes Claude AI to draft a personalized re-engagement SMS
 * 3. Sends email notification ONLY to the assigned sales representative (never to lead)
 * 4. Shows stalled badge on lead card and dashboard widget
 * 5. Automatically clears stalled flag when new activity is logged
 * ─────────────────────────────────────────────────────────────────
 */

import Lead from '../../models/lead.model.js';
import EALead from '../../models/eaLead.model.js';
import User from '../../models/user.model.js';
import Note from '../../models/note.model.js';
import Call from '../../models/call.model.js';
import Followup from '../../models/followup.model.js';
import { generateStalledReengagementDraft } from './ai.service.js';
import { sendStalledLeadEmail } from '../email/mailer.js';
import { deriveScoreFromStatus } from './nextAction.service.js';

export const STALLED_THRESHOLDS = {
    Hot: 3,
    Warm: 5,
    Cold: 7
};

/**
 * Helper: Find latest activity timestamp for an EA Lead.
 */
function getEALeadLastActivity(lead) {
    const dates = [];

    if (lead.lastActivityAt) dates.push(new Date(lead.lastActivityAt));
    if (lead.dateSubmitted) dates.push(new Date(lead.dateSubmitted));

    // Check last SMS
    if (Array.isArray(lead.smsHistory) && lead.smsHistory.length > 0) {
        const lastSms = lead.smsHistory[lead.smsHistory.length - 1];
        if (lastSms.timestamp) dates.push(new Date(lastSms.timestamp));
    }

    // Check last Call
    if (Array.isArray(lead.callHistory) && lead.callHistory.length > 0) {
        const lastCall = lead.callHistory[lead.callHistory.length - 1];
        if (lastCall.timestamp) dates.push(new Date(lastCall.timestamp));
    }

    if (dates.length === 0) return new Date();

    return new Date(Math.max(...dates.map(d => d.getTime())));
}

/**
 * Helper: Find latest activity timestamp for a Main CRM Lead.
 */
async function getCRMLeadLastActivity(lead) {
    const dates = [];

    if (lead.lastActivityAt) dates.push(new Date(lead.lastActivityAt));
    if (lead.last_contacted) dates.push(new Date(lead.last_contacted));
    if (lead.createdAt) dates.push(new Date(lead.createdAt));

    // Find latest Note
    const latestNote = await Note.findOne({ lead_id: lead._id }).sort({ createdAt: -1 }).select('createdAt');
    if (latestNote?.createdAt) dates.push(new Date(latestNote.createdAt));

    // Find latest Call
    const latestCall = await Call.findOne({ lead_id: lead._id }).sort({ createdAt: -1 }).select('createdAt');
    if (latestCall?.createdAt) dates.push(new Date(latestCall.createdAt));

    // Find latest Followup
    const latestFollowup = await Followup.findOne({ lead_id: lead._id }).sort({ createdAt: -1 }).select('createdAt');
    if (latestFollowup?.createdAt) dates.push(new Date(latestFollowup.createdAt));

    if (dates.length === 0) return new Date();

    return new Date(Math.max(...dates.map(d => d.getTime())));
}

/**
 * Core Scanner: Scans all EA Leads and CRM Leads for inactivity.
 */
export async function scanForStalledLeads({ io = null, sendEmails = true } = {}) {
    const now = new Date();
    console.log(`[Stalled Leads] 🔍 Starting nightly scan at ${now.toISOString()}...`);

    const crmUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    let totalScanned = 0;
    let newlyStalledCount = 0;
    let currentlyStalledCount = 0;

    // ─────────────────────────────────────────────────────────────
    // 1. Scan EA Leads
    // ─────────────────────────────────────────────────────────────
    try {
        const eaLeads = await EALead.find().populate('assigned_to', 'name email role');
        totalScanned += eaLeads.length;

        for (const lead of eaLeads) {
            const score = lead.aiScore || 'Cold';
            const threshold = STALLED_THRESHOLDS[score] || 7;
            const lastActivity = getEALeadLastActivity(lead);
            const daysInactive = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

            if (daysInactive >= threshold) {
                currentlyStalledCount++;
                const wasAlreadyStalled = !!lead.isStalled;

                if (!wasAlreadyStalled || !lead.stalledReengagementDraft?.text) {
                    newlyStalledCount++;

                    // 1. Claude drafts personalized re-engagement SMS
                    const draftText = await generateStalledReengagementDraft({
                        leadName: lead.name,
                        leadType: 'ea_lead',
                        score,
                        daysInactive,
                        sport: lead.source || 'youth sports',
                        recentMessages: (lead.smsHistory || []).slice(-3)
                    });

                    lead.isStalled = true;
                    lead.stalledAt = lead.stalledAt || now;
                    lead.daysInactive = daysInactive;
                    lead.stalledReason = `No activity in ${daysInactive} days for ${score} lead`;
                    lead.stalledReengagementDraft = {
                        text: draftText,
                        suggestedAt: now
                    };

                    // 2. Email Notification ONLY to assigned team member
                    if (sendEmails) {
                        const repEmail = lead.assigned_to?.email || process.env.ADMIN_EMAIL;
                        const repName = lead.assigned_to?.name || 'Team Member';
                        const leadUrl = `${crmUrl}/ea-leads?leadId=${lead._id}`;

                        if (repEmail) {
                            await sendStalledLeadEmail({
                                to: repEmail,
                                repName,
                                leadName: lead.name,
                                leadScore: score,
                                daysInactive,
                                lastActivityDate: lastActivity,
                                leadUrl,
                                leadType: 'ea_lead',
                                draftMessage: draftText
                            });
                            lead.stalledEmailSentAt = now;
                        }
                    }
                } else {
                    // Update days counter
                    lead.daysInactive = daysInactive;
                }

                await lead.save();

                if (io) {
                    io.emit('ea_lead:stalled_updated', {
                        leadId: lead._id.toString(),
                        isStalled: true,
                        daysInactive,
                        stalledReason: lead.stalledReason,
                        stalledReengagementDraft: lead.stalledReengagementDraft
                    });
                }
            } else if (daysInactive < threshold && lead.isStalled) {
                // Inactivity threshold no longer met: auto-clear
                lead.isStalled = false;
                lead.stalledAt = null;
                lead.stalledReason = null;
                lead.stalledEmailSentAt = null;
                lead.daysInactive = daysInactive;
                await lead.save();

                if (io) {
                    io.emit('ea_lead:stalled_updated', {
                        leadId: lead._id.toString(),
                        isStalled: false,
                        daysInactive,
                        stalledReason: null
                    });
                }
            }
        }
    } catch (eaErr) {
        console.error('[Stalled Leads] Error scanning EA leads:', eaErr.message);
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Scan Main CRM Leads
    // ─────────────────────────────────────────────────────────────
    try {
        const crmLeads = await Lead.find({
            status: { $nin: ['Not Interested', 'Program Confirmed', 'On Hold'] }
        }).populate('assigned_to', 'name email role');

        totalScanned += crmLeads.length;

        for (const lead of crmLeads) {
            const score = lead.aiScore || deriveScoreFromStatus(lead.status);
            const threshold = STALLED_THRESHOLDS[score] || 7;
            const lastActivity = await getCRMLeadLastActivity(lead);
            const daysInactive = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

            if (daysInactive >= threshold) {
                currentlyStalledCount++;
                const wasAlreadyStalled = !!lead.isStalled;

                if (!wasAlreadyStalled || !lead.stalledReengagementDraft?.text) {
                    newlyStalledCount++;

                    // 1. Claude drafts personalized re-engagement SMS/message
                    const draftText = await generateStalledReengagementDraft({
                        leadName: lead.name,
                        leadType: 'lead',
                        score,
                        daysInactive,
                        location: lead.city || lead.state || '',
                        sport: lead.type || 'athletic clinic programs'
                    });

                    lead.isStalled = true;
                    lead.stalledAt = lead.stalledAt || now;
                    lead.daysInactive = daysInactive;
                    lead.stalledReason = `No activity in ${daysInactive} days for ${score} lead`;
                    lead.stalledReengagementDraft = {
                        text: draftText,
                        suggestedAt: now
                    };

                    // 2. Email Notification ONLY to assigned sales representative
                    if (sendEmails) {
                        const repEmail = lead.assigned_to?.email || process.env.ADMIN_EMAIL;
                        const repName = lead.assigned_to?.name || 'Team Member';
                        const leadUrl = `${crmUrl}/lead/${lead._id}`;

                        if (repEmail) {
                            await sendStalledLeadEmail({
                                to: repEmail,
                                repName,
                                leadName: lead.name,
                                leadScore: score,
                                daysInactive,
                                lastActivityDate: lastActivity,
                                leadUrl,
                                leadType: 'lead',
                                draftMessage: draftText
                            });
                            lead.stalledEmailSentAt = now;
                        }
                    }
                } else {
                    lead.daysInactive = daysInactive;
                }

                await lead.save();

                if (io) {
                    io.emit('lead:stalled_updated', {
                        leadId: lead._id.toString(),
                        isStalled: true,
                        daysInactive,
                        stalledReason: lead.stalledReason,
                        stalledReengagementDraft: lead.stalledReengagementDraft
                    });
                }
            } else if (daysInactive < threshold && lead.isStalled) {
                // Auto-clear
                lead.isStalled = false;
                lead.stalledAt = null;
                lead.stalledReason = null;
                lead.stalledEmailSentAt = null;
                lead.daysInactive = daysInactive;
                await lead.save();

                if (io) {
                    io.emit('lead:stalled_updated', {
                        leadId: lead._id.toString(),
                        isStalled: false,
                        daysInactive,
                        stalledReason: null
                    });
                }
            }
        }
    } catch (crmErr) {
        console.error('[Stalled Leads] Error scanning CRM leads:', crmErr.message);
    }

    console.log(`[Stalled Leads] ✅ Scan complete. Total leads: ${totalScanned}, Stalled: ${currentlyStalledCount}, Newly flagged: ${newlyStalledCount}`);
    return {
        totalScanned,
        currentlyStalledCount,
        newlyStalledCount
    };
}

/**
 * Auto-Clears Stalled Flag when any new activity (Call, SMS, Note, Status change, Followup) is logged.
 */
export async function clearStalledStatus(leadId, leadType = 'lead', io = null) {
    if (!leadId) return;

    try {
        const updatePayload = {
            isStalled: false,
            stalledAt: null,
            stalledReason: null,
            daysInactive: 0,
            lastActivityAt: new Date()
        };

        let updatedLead = null;
        if (leadType === 'ea_lead') {
            updatedLead = await EALead.findByIdAndUpdate(leadId, updatePayload, { returnDocument: 'after' });
            if (io && updatedLead) {
                io.emit('ea_lead:stalled_updated', {
                    leadId: leadId.toString(),
                    isStalled: false,
                    daysInactive: 0,
                    stalledReason: null
                });
            }
        } else {
            updatedLead = await Lead.findByIdAndUpdate(leadId, updatePayload, { returnDocument: 'after' });
            if (io && updatedLead) {
                io.emit('lead:stalled_updated', {
                    leadId: leadId.toString(),
                    isStalled: false,
                    daysInactive: 0,
                    stalledReason: null
                });
            }
        }

        if (updatedLead) {
            console.log(`[Stalled Leads] 🟢 Cleared stalled status for ${leadType} (${leadId}) due to new activity.`);
        }
    } catch (err) {
        console.warn(`[Stalled Leads] Failed to clear stalled status for ${leadId}:`, err.message);
    }
}
