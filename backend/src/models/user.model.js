import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    name: { type: String },
    email: { type: String },
    role: { type: String, default: 'user' }
}, { timestamps: true });

export const User = mongoose.model('User', UserSchema);
export default User;
