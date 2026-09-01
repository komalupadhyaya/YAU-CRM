import EmailQueue from '../../models/emailQueue.model.js';
import EmailCampaign from '../../models/emailCampaign.model.js';
import EmailHistory from '../../models/emailHistory.model.js';
import { sendSendGridMail } from './sendgrid.service.js';

let isWorkerRunning = false;

export const startQueueWorker = (io) => {
    if (isWorkerRunning) return;
    isWorkerRunning = true;
    
    console.log('[Email Queue Worker] Background queue processing loop initialized.');
    
    const tick = async () => {
        try {
            // Find a batch of pending emails to process
            const batch = await EmailQueue.find({ status: 'pending' })
                .limit(5)
                .sort({ createdAt: 1 });
                
            if (batch.length === 0) {
                // No jobs found, check again in 2 seconds
                setTimeout(tick, 2000);
                return;
            }
            
            // Mark batch as processing to prevent other checks from claiming them
            const ids = batch.map(job => job._id);
            await EmailQueue.updateMany({ _id: { $in: ids } }, { $set: { status: 'processing' } });
            
            console.log(`[Email Queue Worker] Processing batch of ${batch.length} emails...`);
            
            // Process the batch
            await Promise.all(batch.map(async (job) => {
                try {
                    job.attempts += 1;
                    job.lastAttempt = new Date();
                    
                    const result = await sendSendGridMail({
                        to: job.email,
                        subject: job.subject,
                        html: job.body,
                        leadId: job.leadId,
                        leadModel: job.leadModel,
                        campaignId: job.campaignId
                    });
                    
                    const errStr = result.success ? null : result.error;
                    const isBounceError = !result.success && errStr && (
                        errStr.includes('550') ||
                        errStr.includes('5.1.1') ||
                        errStr.toLowerCase().includes('does not exist') ||
                        errStr.toLowerCase().includes('user unknown') ||
                        errStr.toLowerCase().includes('bounce') ||
                        errStr.toLowerCase().includes('nosuchuser')
                    );
                    const logStatus = result.success ? 'sent' : (isBounceError ? 'bounce' : 'failed');
                    const msgId = result.success ? result.messageId : null;
                    
                    if (result.success) {
                        // Delete successfully sent job from the queue to keep the collection small and fast
                        await EmailQueue.deleteOne({ _id: job._id });
                    } else {
                        // Keep failed job in queue for debugging/troubleshooting
                        job.status = 'failed';
                        job.error = errStr;
                        await job.save();
                    }
                    
                    // Update Campaign object statistics
                    const campaign = await EmailCampaign.findById(job.campaignId);
                    const campaignTitle = campaign ? campaign.title : '';

                    // Create direct entry in central EmailHistory log
                    await EmailHistory.create({
                        leadId: job.leadId || null,
                        leadModel: job.leadModel || 'Lead',
                        campaignId: job.campaignId,
                        campaignTitle: campaignTitle,
                        type: 'bulk',
                        direction: 'outbound',
                        recipientName: job.recipientName || '',
                        to: job.email,
                        subject: job.subject,
                        body: job.body,
                        status: logStatus,
                        error: errStr,
                        messageId: msgId,
                        sentAt: new Date()
                    });
                    
                    if (campaign) {
                        if (result.success) {
                            campaign.stats.sent = (campaign.stats.sent || 0) + 1;
                        } else {
                            campaign.stats.bounces = (campaign.stats.bounces || 0) + 1;
                        }
                        
                        // Update matching recipient log
                        if (campaign.recipientLogs && campaign.recipientLogs.length > 0) {
                            const logItem = campaign.recipientLogs.find(log => log.email.toLowerCase() === job.email.toLowerCase());
                            if (logItem) {
                                logItem.status = logStatus;
                                logItem.error = errStr;
                                logItem.messageId = msgId;
                            }
                        }
                        
                        // Check if this campaign has any remaining pending or processing jobs left
                        const remainingCount = await EmailQueue.countDocuments({
                            campaignId: campaign._id,
                            status: { $in: ['pending', 'processing'] }
                        });
                        
                        if (remainingCount === 0) {
                            campaign.status = 'sent';
                            campaign.sentAt = new Date();
                        }
                        
                        await campaign.save();
                        
                        // Emit live update over socket to frontend
                        if (io) {
                            io.emit('campaign:updated', {
                                campaignId: campaign._id,
                                stats: campaign.stats,
                                status: campaign.status,
                                recipientLogs: campaign.recipientLogs
                            });
                        }
                    }
                } catch (jobErr) {
                    console.error(`[Email Queue Worker] Failed to process email job ${job._id}:`, jobErr);
                    job.status = 'failed';
                    job.error = jobErr.message;
                    await job.save();
                }
            }));
            
            // Wait 1.5 seconds before the next batch to throttle send rate and avoid spam filters
            setTimeout(tick, 1500);
        } catch (err) {
            console.error('[Email Queue Worker] Error in background worker loop:', err);
            // Delay restart on error
            setTimeout(tick, 5000);
        }
    };
    
    tick();
};

export default { startQueueWorker };
