import express from 'express';
import * as meetingController from '../controllers/meeting.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();

const allRoles    = ['admin', 'manager', 'sales_rep', 'view_only'];
const canWrite    = ['admin', 'manager', 'sales_rep'];
const adminOrMgr  = ['admin', 'manager'];

// ── Literal routes first ──────────────────────────────────────────────────────

// Badge counts for sidebar (all authenticated roles)
router.get('/counts', auth, requireRole(...allRoles), meetingController.getMeetingCounts);

// Availability conflict pre-check (all write roles)
router.post('/check-availability', auth, requireRole(...canWrite), meetingController.checkAvailability);

// Get schedules and meetings for attendees to render visual calendar month availability (all write roles)
router.post('/attendees-availability', auth, requireRole(...canWrite), meetingController.getAttendeesAvailability);

// Fetch active Zoom users for the attendees filter dropdown (all write roles)
router.get('/zoom-users', auth, requireRole(...canWrite), meetingController.getZoomUsers);

// Candidate management (admin + manager only)
router.get('/candidates',  auth, requireRole(...adminOrMgr), meetingController.getCandidates);
router.post('/candidates', auth, requireRole(...adminOrMgr), meetingController.createCandidate);
router.put('/candidates/:id', auth, requireRole(...adminOrMgr), meetingController.updateCandidate);
router.delete('/candidates/:id', auth, requireRole(...adminOrMgr), meetingController.deleteCandidate);

// ── Parameterized routes ──────────────────────────────────────────────────────

// List meetings — all roles (controller scopes for sales_rep)
router.get('/', auth, requireRole(...allRoles), meetingController.getMeetings);

// Get single meeting
router.get('/:id', auth, requireRole(...allRoles), meetingController.getMeetingById);

// Create meeting — admin/manager only
router.post('/', auth, requireRole(...adminOrMgr), meetingController.createMeeting);

// Update meeting — admin/manager only
router.put('/:id', auth, requireRole(...adminOrMgr), meetingController.updateMeeting);

// Delete meeting — admin and manager only
router.delete('/:id', auth, requireRole(...adminOrMgr), meetingController.deleteMeeting);

export default router;
