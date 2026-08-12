import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    name: { type: String },
    email: { type: String },
    role: {
        type: String,
        enum: ['admin', 'manager', 'sales_rep', 'view_only'],
        default: 'sales_rep'
    },
    isActive: { type: Boolean, default: true },
    phone: { type: String, default: "" },
    presenceStatus: {
        type: String,
        enum: ['online', 'away', 'offline'],
        default: 'offline'
    },
    lastActiveAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date }
}, { timestamps: true });

export const User = mongoose.model('User', UserSchema);
export default User;
