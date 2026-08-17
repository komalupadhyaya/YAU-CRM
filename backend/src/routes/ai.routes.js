import express from 'express';
import {
    overrideLeadScore,
    rescoreLead,
    approveReplyDraft,
    dismissReplyDraft,
    getStalledLeads,
    sendStalledFollowup,
    acceptNextActionEndpoint,
    dismissNextActionEndpoint,
    getLatestWeeklyReport,
    triggerWeeklyReportGeneration,
    getAiSettings,
    updateAiSettings
} from '../controllers/ai.controller.js';

const router = express.Router();

// Lead scoring endpoints
router.post('/leads/:id/score-override', overrideLeadScore);
router.post('/leads/:id/rescore', rescoreLead);

// AI Reply Assistant endpoints
router.post('/reply-draft/:id/approve', approveReplyDraft);
router.post('/reply-draft/:id/dismiss', dismissReplyDraft);

// Stalled lead endpoints
router.get('/stalled-leads', getStalledLeads);
router.post('/stalled/:id/send', sendStalledFollowup);

// Next Action endpoints
router.post('/next-action/:id/accept', acceptNextActionEndpoint);
router.post('/next-action/:id/dismiss', dismissNextActionEndpoint);

// Weekly performance report endpoints
router.get('/weekly-reports/latest', getLatestWeeklyReport);
router.post('/weekly-reports/generate', triggerWeeklyReportGeneration);

// Settings endpoints
router.get('/settings', getAiSettings);
router.put('/settings', updateAiSettings);

export default router;
