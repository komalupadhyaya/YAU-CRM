import express from 'express';
import auth from '../middleware/auth.middleware.js';
import {
    getNotifications,
    markOneRead,
    markAllRead,
    deleteOne,
    deleteAll,
} from '../controllers/notification.controller.js';

const router = express.Router();

// All routes require authentication
router.get('/',              auth, getNotifications);
router.put('/read-all',      auth, markAllRead);       // Must be before /:id
router.put('/:id/read',      auth, markOneRead);
router.delete('/delete-all', auth, deleteAll);         // Must be before /:id
router.delete('/:id',        auth, deleteOne);

export default router;
