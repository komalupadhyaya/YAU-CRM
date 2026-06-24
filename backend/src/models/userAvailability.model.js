import mongoose from 'mongoose';

const timeSlotSchema = new mongoose.Schema({
    start: { type: String, required: true }, // '09:00'
    end:   { type: String, required: true }  // '17:00'
}, { _id: false });

const dayScheduleSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: false },
    start: { type: String, default: null }, // Legacy fallback
    end:   { type: String, default: null },  // Legacy fallback
    slots: { type: [timeSlotSchema], default: [] }
}, { _id: false });

const UserAvailabilitySchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true // one availability record per user
    },

    weekly_schedule: {
        monday:    { type: dayScheduleSchema, default: () => ({ enabled: false }) },
        tuesday:   { type: dayScheduleSchema, default: () => ({ enabled: false }) },
        wednesday: { type: dayScheduleSchema, default: () => ({ enabled: false }) },
        thursday:  { type: dayScheduleSchema, default: () => ({ enabled: false }) },
        friday:    { type: dayScheduleSchema, default: () => ({ enabled: false }) },
        saturday:  { type: dayScheduleSchema, default: () => ({ enabled: false }) },
        sunday:    { type: dayScheduleSchema, default: () => ({ enabled: false }) }
    },

    date_range_start: { type: String, default: null }, // 'YYYY-MM-DD'
    date_range_end:   { type: String, default: null }, // 'YYYY-MM-DD'

    custom_schedule: {
        type: [{
            date:    { type: String, required: true }, // 'YYYY-MM-DD'
            enabled: { type: Boolean, default: false },
            slots:   { type: [timeSlotSchema], default: [] }
        }],
        default: []
    },

    // Specific dates the user is fully blocked (e.g. vacation, sick day)
    blocked_dates: [{ type: Date }]

}, { timestamps: true });

const UserAvailability = mongoose.model('UserAvailability', UserAvailabilitySchema);
export default UserAvailability;
