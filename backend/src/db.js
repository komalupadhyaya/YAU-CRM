import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/yaucrm';

mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB connected ✅'))
    .catch(err => console.error('MongoDB connection error ❌:', err));

// --- Schemas ---

const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true }
}, { timestamps: true });

const CampaignSchema = new mongoose.Schema({
    name: { type: String, required: true }
}, { timestamps: true });

const SchoolSchema = new mongoose.Schema({
    campaign_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
    name: { type: String, required: true },
    type: String,
    grades: String,
    principal_name: String,
    principal_email: String,
    telephone: String,
    start_time: String,
    end_time: String,
    address: String,
    city: String,
    state: String,
    zip: String,
    website: String
}, { timestamps: true });

const NoteSchema = new mongoose.Schema({
    school_id: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    content: { type: String, required: true }
}, { timestamps: true });

const FollowupSchema = new mongoose.Schema({
    school_id: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    follow_up_date: { type: String, required: true }, // YYYY-MM-DD
    reason: String,
    status: { type: String, default: 'pending' },
    completed_at: Date
}, { timestamps: true });

// --- Models ---

export const User = mongoose.model('User', UserSchema);
export const Campaign = mongoose.model('Campaign', CampaignSchema);
export const School = mongoose.model('School', SchoolSchema);
export const Note = mongoose.model('Note', NoteSchema);
export const Followup = mongoose.model('Followup', FollowupSchema);

// --- Seed Admin ---
const seedAdmin = async () => {
    try {
        const adminExists = await User.findOne({ username: 'admin' });
        if (!adminExists) {
            const hash = bcrypt.hashSync('admin123', 10);
            await User.create({ username: 'admin', password: hash });
            console.log('Created default admin user: admin / admin123');
        }
    } catch (err) {
        console.error('Error seeding admin:', err);
    }
};
seedAdmin();

export default mongoose.connection;
