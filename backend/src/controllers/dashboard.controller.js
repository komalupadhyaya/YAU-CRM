import School from '../models/school.model.js';
import Followup from '../models/followup.model.js';

export const getDashboardStats = async (req, res, next) => {
    try {
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

        const all = await Followup.find({ status: 'pending' })
            .populate({
                path: 'school_id',
                select: 'name telephone campaign_id',
                populate: { path: 'campaign_id', select: 'name' }
            })
            .sort({ follow_up_date: 1 });

        const flatAll = all.map(f => {
            const data = f.toJSON();
            return {
                ...data,
                school_name: data.school_id?.name,
                school_id_val: data.school_id?._id,
                telephone: data.school_id?.telephone,
                campaign_name: data.school_id?.campaign_id?.name,
                campaign_id_val: data.school_id?.campaign_id?._id
            };
        });

        const overdue = flatAll.filter(f => f.follow_up_date < today);
        const due = flatAll.filter(f => f.follow_up_date === today);
        const upcoming = flatAll.filter(f => f.follow_up_date > today);

        res.json({ overdue, due, upcoming, all: flatAll });
    } catch (err) {
        next(err);
    }
};

export const getCampaignSummaries = async (req, res, next) => {
    try {
        const summaries = await School.aggregate([
            {
                $group: {
                    _id: "$campaign_id",
                    totalSchools: { $sum: 1 },
                    meetingsScheduled: {
                        $sum: { $cond: [{ $eq: ["$status", "Meeting Scheduled"] }, 1, 0] }
                    }
                }
            }
        ]);
        res.json(summaries || []);
    } catch (err) {
        next(err);
    }
};

export const getCampaignCounts = async (req, res, next) => {
    try {
        const campaign_id = req.params.campaignId;
        const totalSchools = await School.countDocuments({ campaign_id });
        const contactedSchools = await School.countDocuments({
            campaign_id,
            status: { $ne: 'Not Contacted' }
        });

        res.json({ totalSchools, contactedSchools });
    } catch (err) {
        next(err);
    }
};
