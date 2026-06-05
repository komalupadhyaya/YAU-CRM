import mongoose from 'mongoose';

const taskHistorySchema = new mongoose.Schema({
    task_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        required: false
    },
    task_title: {
        type: String,
        required: true
    },
    action: {
        type: String,
        enum: ['create', 'update', 'complete', 'delete', 'restore'],
        required: true
    },
    performed_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    changes: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, { timestamps: true });

const TaskHistory = mongoose.model('TaskHistory', taskHistorySchema);

export default TaskHistory;
