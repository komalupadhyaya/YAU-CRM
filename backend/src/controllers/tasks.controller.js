import Task from '../models/tasks.model.js';
import User from '../models/user.model.js';
import TaskHistory from '../models/taskHistory.model.js';

// Helper: check if role can update status
const canUpdateStatus = (role) => {
    return role === 'admin' || role === 'manager';
};

export const getTasks = async (req, res) => {
    try {
        const query = { isDeleted: { $ne: true } };

        // Sales Reps only see tasks assigned to themselves
        if (req.currentUserRole === 'sales_rep') {
            query.assignedTo = req.user.id;
        }

        const tasks = await Task.find(query)
            .populate('assignedTo', 'name email role')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const createTask = async (req, res) => {
    try {
        const { title, description, dueDate, priority } = req.body;
        let { assignedTo } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        // Sales Reps can only create tasks assigned to themselves
        if (req.currentUserRole === 'sales_rep') {
            assignedTo = req.user.id;
        }

        const task = new Task({
            title,
            description,
            dueDate: dueDate || null,
            assignedTo: assignedTo || null,
            priority: priority || 'medium',
            createdBy: req.user?.id
        });

        await task.save();

        const populated = await Task.findById(task._id)
            .populate('assignedTo', 'name email role')
            .populate('createdBy', 'name email');

        // Log task history
        let assignedToUser = null;
        if (task.assignedTo) {
            assignedToUser = await User.findById(task.assignedTo).select('name email');
        }
        await TaskHistory.create({
            task_id: task._id,
            task_title: task.title,
            action: 'create',
            performed_by: req.user.id,
            changes: {
                title: task.title,
                description: task.description,
                priority: task.priority,
                dueDate: task.dueDate,
                assignedTo: assignedToUser ? { id: assignedToUser._id, name: assignedToUser.name } : null
            }
        });

        res.status(201).json(populated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const updateTask = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Sales Reps can only update tasks assigned to themselves
        if (req.currentUserRole === 'sales_rep' && (!task.assignedTo || task.assignedTo.toString() !== req.user.id)) {
            return res.status(403).json({ error: 'Access denied. You can only update tasks assigned to you.' });
        }

        const oldTitle = task.title;
        const oldDescription = task.description;
        const oldDueDate = task.dueDate;
        const oldAssignedTo = task.assignedTo;
        const oldPriority = task.priority;
        const oldStatus = task.status;

        const { title, description, dueDate, assignedTo, priority, status } = req.body;

        // Status can only be changed by admin or manager
        if (status !== undefined && status !== task.status) {
            const currentUser = await User.findById(req.user.id);
            if (!currentUser || !canUpdateStatus(currentUser.role)) {
                return res.status(403).json({ error: 'Only Admin or Manager roles can update task status.' });
            }
            if (status === 'completed' && task.status !== 'completed') {
                task.completedAt = new Date();
            } else if (status === 'pending') {
                task.completedAt = undefined;
            }
            task.status = status;
        }

        if (title !== undefined) task.title = title;
        if (description !== undefined) task.description = description;
        if (dueDate !== undefined) task.dueDate = dueDate || null;
        if (assignedTo !== undefined && req.currentUserRole !== 'sales_rep') task.assignedTo = assignedTo || null;
        if (priority !== undefined) task.priority = priority;

        // Compute changes before saving
        const changes = {};
        let isChanged = false;

        if (title !== undefined && title !== oldTitle) {
            changes.title = { old: oldTitle, new: title };
            isChanged = true;
        }
        if (description !== undefined && description !== oldDescription) {
            changes.description = { old: oldDescription, new: description };
            isChanged = true;
        }
        if (dueDate !== undefined && String(oldDueDate || '') !== String(dueDate || '')) {
            changes.dueDate = { old: oldDueDate, new: dueDate || null };
            isChanged = true;
        }
        if (priority !== undefined && priority !== oldPriority) {
            changes.priority = { old: oldPriority, new: priority };
            isChanged = true;
        }
        if (status !== undefined && status !== oldStatus) {
            changes.status = { old: oldStatus, new: status };
            isChanged = true;
        }
        if (assignedTo !== undefined && req.currentUserRole !== 'sales_rep' && String(oldAssignedTo || '') !== String(assignedTo || '')) {
            const oldUser = oldAssignedTo ? await User.findById(oldAssignedTo).select('name') : null;
            const newUser = assignedTo ? await User.findById(assignedTo).select('name') : null;
            changes.assignedTo = {
                old: oldUser ? { id: oldUser._id, name: oldUser.name } : null,
                new: newUser ? { id: newUser._id, name: newUser.name } : null
            };
            isChanged = true;
        }

        await task.save();

        if (isChanged) {
            await TaskHistory.create({
                task_id: task._id,
                task_title: task.title,
                action: status === 'completed' && oldStatus !== 'completed' ? 'complete' : 'update',
                performed_by: req.user.id,
                changes
            });
        }

        const populated = await Task.findById(task._id)
            .populate('assignedTo', 'name email role')
            .populate('createdBy', 'name email');

        res.json(populated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const completeTask = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Sales Reps can only complete tasks assigned to themselves
        if (req.currentUserRole === 'sales_rep' && (!task.assignedTo || task.assignedTo.toString() !== req.user.id)) {
            return res.status(403).json({ error: 'Access denied. You can only complete tasks assigned to you.' });
        }

        // Admins, managers and the assigned sales rep can complete tasks
        const allowedRoles = ['admin', 'manager', 'sales_rep'];
        if (!allowedRoles.includes(req.currentUserRole)) {
            return res.status(403).json({ error: 'Only Admin, Manager, or assigned Sales Rep roles can complete tasks.' });
        }

        const oldStatus = task.status;
        task.status = 'completed';
        task.completedAt = new Date();
        await task.save();

        if (oldStatus !== 'completed') {
            await TaskHistory.create({
                task_id: task._id,
                task_title: task.title,
                action: 'complete',
                performed_by: req.user.id,
                changes: {
                    status: { old: oldStatus, new: 'completed' }
                }
            });
        }

        const populated = await Task.findById(task._id)
            .populate('assignedTo', 'name email role')
            .populate('createdBy', 'name email');

        res.json(populated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const deleteTask = async (req, res) => {
    try {
        // Only admin/manager can delete tasks
        if (!['admin', 'manager'].includes(req.currentUserRole)) {
            return res.status(403).json({ error: 'Only Admin or Manager roles can delete tasks.' });
        }

        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Hard delete ONLY if the task is already soft-deleted and the requester is admin
        if (task.isDeleted && req.currentUserRole === 'admin') {
            await Task.findByIdAndDelete(req.params.id);
            await TaskHistory.deleteMany({ task_id: req.params.id });
            return res.json({ message: 'Task and its history permanently deleted successfully' });
        } else {
            // Soft delete active tasks
            task.isDeleted = true;
            task.deletedBy = req.user.id;
            task.deletedAt = new Date();
            await task.save();

            await TaskHistory.create({
                task_id: task._id,
                task_title: task.title,
                action: 'delete',
                performed_by: req.user.id,
                changes: {}
            });

            return res.json({ message: 'Task soft-deleted successfully' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const restoreTask = async (req, res) => {
    try {
        if (req.currentUserRole !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Only Admins can restore tasks.' });
        }

        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        task.isDeleted = false;
        task.deletedBy = null;
        task.deletedAt = null;
        await task.save();

        await TaskHistory.create({
            task_id: task._id,
            task_title: task.title,
            action: 'restore',
            performed_by: req.user.id,
            changes: {}
        });

        const populated = await Task.findById(task._id)
            .populate('assignedTo', 'name email role')
            .populate('createdBy', 'name email');

        res.json(populated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getAllTasksHistory = async (req, res) => {
    try {
        const query = {};

        // Sales Reps can only view history of tasks they created or are assigned to
        if (req.currentUserRole === 'sales_rep') {
            const userTasks = await Task.find({ assignedTo: req.user.id }).select('_id');
            const userTaskIds = userTasks.map(t => t._id);
            query.$or = [
                { performed_by: req.user.id },
                { task_id: { $in: userTaskIds } }
            ];
        }

        const history = await TaskHistory.find(query)
            .populate('performed_by', 'name email role')
            .sort({ createdAt: -1 });

        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getTaskHistoryById = async (req, res) => {
    try {
        const { id } = req.params;
        const query = { task_id: id };

        // Access check for sales_rep
        if (req.currentUserRole === 'sales_rep') {
            const task = await Task.findById(id);
            if (task && task.assignedTo && task.assignedTo.toString() !== req.user.id) {
                return res.status(403).json({ error: 'Access denied. This task is not assigned to you.' });
            }
        }

        const history = await TaskHistory.find(query)
            .populate('performed_by', 'name email role')
            .sort({ createdAt: -1 });

        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getDeletedTasks = async (req, res) => {
    try {
        if (req.currentUserRole !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Only Admins can view deleted tasks.' });
        }

        const tasks = await Task.find({ isDeleted: true })
            .populate('assignedTo', 'name email role')
            .populate('createdBy', 'name email')
            .populate('deletedBy', 'name email')
            .sort({ deletedAt: -1 });
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
