import Campaign from '../models/campaign.model.js';

export const getCampaigns = async (req, res, next) => {
    try {
        const campaigns = await Campaign.find().sort({ createdAt: -1 });
        res.json(campaigns);
    } catch (err) {
        next(err);
    }
};

export const createCampaign = async (req, res, next) => {
    try {
        const { name } = req.body;
        if (!name) {
            res.status(400);
            throw new Error('Campaign name is required');
        }
        const campaign = await Campaign.create({ name });
        res.json(campaign);
    } catch (err) {
        next(err);
    }
};
