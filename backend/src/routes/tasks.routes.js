import express from 'express';
import * as tasksController from '../controllers/tasks.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();

// All authenticated roles can view tasks (controller scopes for sales_rep)
router.get('/', auth, requireRole('admin', 'manager', 'sales_rep', 'view_only'), tasksController.getTasks);

// Get general task history
router.get('/history', auth, requireRole('admin', 'manager', 'sales_rep', 'view_only'), tasksController.getAllTasksHistory);

// Get deleted tasks (restricted to admin)
router.get('/deleted', auth, requireRole('admin'), tasksController.getDeletedTasks);

// Get specific task history
router.get('/:id/history', auth, requireRole('admin', 'manager', 'sales_rep', 'view_only'), tasksController.getTaskHistoryById);

// Create task: not for view_only (controller auto-assigns for sales_rep)
router.post('/', auth, requireRole('admin', 'manager', 'sales_rep'), tasksController.createTask);

// Update task: not for view_only
router.put('/:id', auth, requireRole('admin', 'manager', 'sales_rep'), tasksController.updateTask);

// Complete task: admin, manager and sales_rep
router.put('/:id/complete', auth, requireRole('admin', 'manager', 'sales_rep'), tasksController.completeTask);

// Restore task: admin only
router.put('/:id/restore', auth, requireRole('admin'), tasksController.restoreTask);

// Delete task: admin and manager only
router.delete('/:id', auth, requireRole('admin', 'manager'), tasksController.deleteTask);

export default router;
