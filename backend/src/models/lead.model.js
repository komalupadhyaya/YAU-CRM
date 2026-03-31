import mongoose from 'mongoose';

const LeadSchema = new mongoose.Schema({
    campaign_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    name: { type: String, required: true },
    type: String,
    category_group: String, // was grades
    main_contact_name: String, // was principal_name
    main_contact_email: String, // was principal_email
    telephone: String,
    start_time: String,
    end_time: String,
    address_number: String, // new
    address: String,
    city: String,
    state: String,
    zip: String,
    website: String,
    status: {
        type: String,
        default: "Not Contacted"
    },
    last_contacted: {
        type: Date,
        default: null
    }
}, { timestamps: true });

export const Lead = mongoose.model('Lead', LeadSchema);
export default Lead;
