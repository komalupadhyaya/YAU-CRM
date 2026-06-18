import mongoose from 'mongoose';

const CandidateSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },

    // The position/role they are applying for
    applying_for: { type: String, trim: true }, // e.g. "Coach", "Volunteer", "Staff"

    status: {
        type: String,
        enum: ['applied', 'interviewing', 'offered', 'hired', 'rejected'],
        default: 'applied',
        index: true
    },

    notes: { type: String, default: '' },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }

}, { timestamps: true });

const Candidate = mongoose.model('Candidate', CandidateSchema);
export default Candidate;
