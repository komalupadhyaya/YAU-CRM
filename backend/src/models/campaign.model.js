import mongoose from 'mongoose';

const CampaignSchema = new mongoose.Schema({
    name: { type: String, required: true }
}, { timestamps: true });

export const Campaign = mongoose.model('Campaign', CampaignSchema);
export default Campaign;
