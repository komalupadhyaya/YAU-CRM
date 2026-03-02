import express from 'express';
import * as tasksController from '../controllers/tasks.controller.js';
import auth from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/', auth, tasksController.getTasks);
router.post('/', auth, tasksController.createTask);
router.put('/:id/complete', auth, tasksController.completeTask);
router.delete('/:id', auth, tasksController.deleteTask);

export default router;
