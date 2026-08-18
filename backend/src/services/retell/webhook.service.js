import Call from '../../models/call.model.js';
import EALead from '../../models/eaLead.model.js';

/**
 * Handle call_started webhook event from Retell
 */
export async function handleCallStarted(callData) {
    const { call_id, from_number, to_number, start_timestamp } = callData;
    console.log(`📞 Retell call_started webhook received for ID: ${call_id}`);
    
    // Look up if a lead exists for this phone number
    let leadId = null;
    try {
        if (from_number) {
            const cleanPhone = from_number.replace(/\D/g, '').slice(-10);
            if (cleanPhone) {
                const lead = await EALead.findOne({
                    phone: { $regex: new RegExp(cleanPhone + '$') }
                });
                if (lead) leadId = lead._id;
            }
        }
    } catch (err) {
        console.error('⚠️ Failed to look up lead for inbound Retell call:', err.message);
    }

    try {
        const call = await Call.create({
            callSid: call_id, // Map Retell call_id as callSid
            retellCallId: call_id,
            direction: 'inbound',
            fromNumber: from_number || 'Unknown Caller',
            toNumber: to_number || process.env.TWILIO_PHONE_NUMBER,
            status: 'in-progress',
            aiHandled: true,
            timestamp: start_timestamp ? new Date(start_timestamp) : new Date(),
            lead_id: leadId
        });
        console.log(`✅ Logged inbound Retell call started in DB: ${call_id}`);
        return call;
    } catch (err) {
        console.error('❌ Failed to log Retell call started in DB:', err.message);
        throw err;
    }
}

/**
 * Handle call_ended webhook event from Retell
 */
export async function handleCallEnded(callData) {
    const { call_id, duration_ms, call_status } = callData;
    console.log(`📞 Retell call_ended webhook received for ID: ${call_id}`);
    
    try {
        const durationSec = duration_ms ? Math.round(duration_ms / 1000) : 0;
        const call = await Call.findOneAndUpdate(
            { retellCallId: call_id },
            {
                status: call_status || 'completed',
                duration: durationSec
            },
            { new: true }
        );
        console.log(`✅ Updated Retell call ended in DB: ${call_id}, Duration: ${durationSec}s`);
        return call;
    } catch (err) {
        console.error('❌ Failed to update Retell call ended in DB:', err.message);
        throw err;
    }
}

/**
 * Handle call_analyzed webhook event from Retell
 */
export async function handleCallAnalyzed(callData) {
    const { call_id, transcript, call_analysis, recording_url } = callData;
    console.log(`📞 Retell call_analyzed webhook received for ID: ${call_id}`);
    
    const summary = call_analysis?.call_summary || '';
    const sentiment = call_analysis?.user_sentiment?.toLowerCase() || 'neutral';
    
    // Validate sentiment
    const validSentiment = ['positive', 'neutral', 'negative'].includes(sentiment) ? sentiment : 'neutral';

    try {
        const call = await Call.findOneAndUpdate(
            { retellCallId: call_id },
            {
                transcript: transcript || '',
                callSummary: summary,
                userSentiment: validSentiment,
                recordingUrl: recording_url || ''
            },
            { new: true }
        );
        console.log(`✅ Saved Retell call analysis in DB: ${call_id}`);
        return call;
    } catch (err) {
        console.error('❌ Failed to save Retell call analysis in DB:', err.message);
        throw err;
    }
}

/**
 * Real-time lead info collection triggered by Retell AI custom tool
 */
export async function processLeadCollection(toolData) {
    const { parent_call_sid, name, phone, email } = toolData;
    console.log(`📡 Real-time EALead data received from Retell for call: ${parent_call_sid}`);
    
    if (!phone || !name || !email) {
        console.warn('⚠️ Retell lead collection skipped: phone, name, and email are required fields.');
        return null;
    }

    try {
        const cleanPhone = phone.replace(/\D/g, '').slice(-10);
        let lead = await EALead.findOne({
            $or: [
                { email: email.toLowerCase().trim() },
                { phone: { $regex: new RegExp(cleanPhone + '$') } }
            ]
        });

        if (lead) {
            console.log(`📝 Existing EALead found (${lead._id}). Updating details...`);
            lead.name = name.trim();
            lead.email = email.toLowerCase().trim();
            lead.phone = phone.trim();
            lead.source = 'Retell AI Call Center';
            lead.isConsent = true;
            await lead.save();
        } else {
            console.log(`📝 Creating new EALead for "${name}" collected by AI Voice...`);
            lead = new EALead({
                name: name.trim(),
                email: email.toLowerCase().trim(),
                phone: phone.trim(),
                source: 'Retell AI Call Center',
                isConsent: true
            });
            await lead.save();
        }

        // If a Call record exists for this call_id, associate the lead
        if (parent_call_sid) {
            await Call.findOneAndUpdate(
                { retellCallId: parent_call_sid },
                { lead_id: lead._id }
            );
        }

        return lead;
    } catch (err) {
        console.error('❌ Failed to process lead collection from Retell custom tool:', err.message);
        throw err;
    }
}

export default {
    handleCallStarted,
    handleCallEnded,
    handleCallAnalyzed,
    processLeadCollection
};
