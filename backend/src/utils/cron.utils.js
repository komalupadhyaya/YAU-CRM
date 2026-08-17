import cron from 'node-cron';
import Followup from '../models/followup.model.js';
import { scanAndFlagStalledLeads } from '../services/ai/stalled.service.js';
import { generateWeeklyReport } from '../services/ai/weeklyReport.service.js';

/**
 * Register Background Cron Jobs for YAU CRM
 */
export function startCronJobs() {
    // 1. Weekly Follow-up Purge — Every Sunday at midnight
    cron.schedule('0 0 * * 0', async () => {
        const startedAt = new Date().toISOString();
        console.log(`[CRON] Weekly follow-up purge started at ${startedAt}`);

        try {
            const result = await Followup.deleteMany({ status: 'done' });
            console.log(`[CRON] Purge complete : ${result.deletedCount} completed follow-up(s) deleted.`);
        } catch (err) {
            console.error('[CRON] Follow-up purge failed:', err.message);
        }
    }, { timezone: 'America/New_York' });

    // 2. Nightly Stalled Lead Scanner — Every night at 2:00 AM EST
    cron.schedule('0 2 * * *', async () => {
        console.log('[CRON] Starting nightly stalled lead scanning...');
        try {
            await scanAndFlagStalledLeads();
        } catch (err) {
            console.error('[CRON] Stalled lead scan failed:', err.message);
        }
    }, { timezone: 'America/New_York' });

    // 3. Weekly AI Performance Report — Every Monday at 8:00 AM EST
    cron.schedule('0 8 * * 1', async () => {
        console.log('[CRON] Starting Monday morning AI weekly performance report generation...');
        try {
            await generateWeeklyReport();
        } catch (err) {
            console.error('[CRON] Weekly AI report failed:', err.message);
        }
    }, { timezone: 'America/New_York' });

    console.log('[CRON] Cron jobs registered (Followup purge, Stalled lead scan, Weekly AI report).');
}

