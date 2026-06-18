import cron from 'node-cron';
import Followup from '../models/followup.model.js';

/**
 * Weekly Cron Job — Purge Completed Follow-Ups
 *
 * Schedule: Every Sunday at midnight (00:00)
 * Cron expr: '0 0 * * 0'
 *
 * Finds all follow-ups with status === 'done' and permanently
 * deletes them from the database to keep the collection lean.
 */
export function startCronJobs() {
    cron.schedule('0 0 * * 0', async () => {
        const startedAt = new Date().toISOString();
        console.log(`[CRON] Weekly follow-up purge started at ${startedAt}`);

        try {
            const result = await Followup.deleteMany({ status: 'done' });
            console.log(`[CRON] Purge complete : ${result.deletedCount} completed follow-up(s) deleted.`);
        } catch (err) {
            console.error('[CRON] Follow-up purge failed:', err.message);
        }
    }, {
        timezone: 'UTC'  // Change to your preferred timezone e.g. 'Asia/Karachi'
    });

    console.log('[CRON] Weekly follow-up purge job registered (runs every Sunday at 00:00 UTC).');
}
