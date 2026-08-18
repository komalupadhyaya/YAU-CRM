import crypto from 'crypto';
import Settings from '../models/settings.model.js';
import Call from '../models/call.model.js';
import { webhookService, clientService, knowledgeBaseService } from '../services/retell/index.js';

/**
 * Verify webhook signature from Retell
 */
function verifySignature(req, apiKey) {
    const signature = req.headers['x-retell-signature'] || req.headers['X-Retell-Signature'];
    if (!signature) {
        console.warn('⚠️ Webhook request missing X-Retell-Signature header.');
        return false;
    }

    const payload = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);
    const expectedSignature = crypto
        .createHmac('sha256', apiKey)
        .update(payload)
        .digest('hex');

    return expectedSignature === signature;
}

/**
 * Public Webhook Endpoint
 * POST /api/retell/webhook
 */
export async function handleWebhook(req, res, next) {
    try {
        const apiKey = process.env.RETELL_API_KEY;
        const isVerified = verifySignature(req, apiKey);

        if (!isVerified && process.env.NODE_ENV === 'production') {
            console.error('❌ Webhook signature verification failed in Production.');
            return res.status(401).json({ error: 'Invalid signature' });
        } else if (!isVerified) {
            console.warn('⚠️ Webhook signature mismatch. Proceeding (non-production dev mode).');
        }

        const { event, call, call_id } = req.body;
        if (!event) {
            return res.status(400).json({ error: 'Missing event name' });
        }

        const callData = call || req.body;

        switch (event) {
            case 'call_started':
                await webhookService.handleCallStarted(callData);
                break;
            case 'call_ended':
                await webhookService.handleCallEnded(callData);
                break;
            case 'call_analyzed':
                await webhookService.handleCallAnalyzed(callData);
                break;
            default:
                console.log(`ℹ️ Unhandled Retell event: ${event}`);
        }

        // Retell expects 204 No Content for successful webhook reception
        return res.status(204).send();
    } catch (err) {
        console.error('❌ Error handling Retell webhook:', err.message);
        // Respond with 500 so Retell retries if it's a transient failure
        return res.status(500).json({ error: err.message });
    }
}

/**
 * Public Tool Call Endpoint
 * POST /api/retell/collect-info
 */
export async function collectLeadInfoTool(req, res, next) {
    try {
        console.log('📡 Retell Custom Tool "collect_lead_info" triggered:', req.body);
        
        // Retell sends custom arguments in request body
        const { name, phone, email, parent_call_sid } = req.body;
        
        const lead = await webhookService.processLeadCollection({
            parent_call_sid,
            name,
            phone,
            email
        });

        // Retell LLM expects a JSON object returned to acknowledge tool execution
        return res.status(200).json({
            status: 'success',
            message: 'Lead created/updated successfully in YAU CRM.',
            lead_id: lead ? lead._id : null
        });
    } catch (err) {
        console.error('❌ Error in collect_lead_info tool call:', err.message);
        return res.status(200).json({
            status: 'error',
            message: `Failed to save lead: ${err.message}`
        });
    }
}

/**
 * Get Retell Config
 * GET /api/retell/config
 */
export async function getConfig(req, res, next) {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create({});
        }

        // Return combined database configuration (enabled toggle) and server environment parameters
        return res.status(200).json({
            success: true,
            config: {
                enabled: !!(settings.retellSettings && settings.retellSettings.enabled),
                agentId: process.env.RETELL_AGENT_ID || '',
                llmId: process.env.RETELL_LLM_ID || '',
                knowledgeBase: knowledgeBaseService.getDefaultKnowledgeBase(),
                transferNumber: process.env.RETELL_TRANSFER_NUMBER || '',
                retellPhoneNumber: process.env.RETELL_PHONE_NUMBER || ''
            }
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Update Retell Config
 * PUT /api/retell/config
 */
export async function updateConfig(req, res, next) {
    try {
        const { enabled } = req.body;
        
        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create({});
        }

        // Only toggle the enabled state in database
        settings.retellSettings = {
            enabled: !!enabled
        };
        await settings.save();

        const activeAgentId = process.env.RETELL_AGENT_ID;

        // Push the updated prompt configuration to the Retell Agent's LLM via API
        if (settings.retellSettings.enabled && activeAgentId) {
            try {
                // Fetch the static knowledge base from code instead of DB/request body
                const staticKb = knowledgeBaseService.getDefaultKnowledgeBase();
                const systemPrompt = knowledgeBaseService.buildVoiceAgentPrompt(staticKb);
                await clientService.updateAgentPrompt(activeAgentId, systemPrompt);
                console.log('📡 Successfully updated prompt on Retell server using static knowledge base file.');
            } catch (apiErr) {
                console.error('⚠️ Failed to sync static prompt with Retell API:', apiErr.message);
                return res.status(200).json({
                    success: true,
                    config: {
                        enabled: settings.retellSettings.enabled,
                        agentId: process.env.RETELL_AGENT_ID || '',
                        llmId: process.env.RETELL_LLM_ID || '',
                        knowledgeBase: knowledgeBaseService.getDefaultKnowledgeBase(),
                        transferNumber: process.env.RETELL_TRANSFER_NUMBER || '',
                        retellPhoneNumber: process.env.RETELL_PHONE_NUMBER || ''
                    },
                    warning: `Settings saved locally, but failed to sync prompt to Retell: ${apiErr.message}`
                });
            }
        }

        return res.status(200).json({
            success: true,
            config: {
                enabled: settings.retellSettings.enabled,
                agentId: process.env.RETELL_AGENT_ID || '',
                llmId: process.env.RETELL_LLM_ID || '',
                knowledgeBase: knowledgeBaseService.getDefaultKnowledgeBase(),
                transferNumber: process.env.RETELL_TRANSFER_NUMBER || '',
                retellPhoneNumber: process.env.RETELL_PHONE_NUMBER || ''
            }
        });
    } catch (err) {
        next(err);
    }
}

/**
 * List Retell Calls
 * GET /api/retell/calls
 */
export async function getRetellCalls(req, res, next) {
    try {
        const calls = await Call.find({ aiHandled: true })
            .populate('lead_id')
            .sort({ timestamp: -1 })
            .limit(100);
            
        return res.status(200).json({
            success: true,
            calls
        });
    } catch (err) {
        next(err);
    }
}

export default {
    handleWebhook,
    collectLeadInfoTool,
    getConfig,
    updateConfig,
    getRetellCalls
};
