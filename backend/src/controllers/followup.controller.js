import Followup from '../models/followup.model.js';
import School from '../models/school.model.js';

export const createFollowup = async (req, res, next) => {
    try {
        const { follow_up_date, reason } = req.body;
        if (!follow_up_date) {
            res.status(400);
            throw new Error('follow_up_date is required');
        }

        const fu = await Followup.create({
            school_id: req.params.schoolId,
            follow_up_date,
            reason: reason || ''
        });
        res.json(fu);
    } catch (err) {
        next(err);
    }
};

export const completeFollowup = async (req, res, next) => {
    try {
        const fu = await Followup.findByIdAndUpdate(req.params.id, {
            status: 'done',
            completed_at: new Date()
        }, { new: true });

        if (!fu) {
            res.status(404);
            throw new Error('Follow-up not found');
        }

        // Auto update last_contacted
        await School.findByIdAndUpdate(
            fu.school_id,
            { last_contacted: new Date() }
        );

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

export const getFollowupsBySchool = async (req, res, next) => {
    try {
        const followups = await Followup.find({ school_id: req.params.schoolId })
            .populate({
                path: 'school_id',
                select: 'name telephone campaign_id',
                populate: { path: 'campaign_id', select: 'name' }
            })
            .sort({ follow_up_date: 1 });

        const flatFollowups = followups.map(f => {
            const data = f.toJSON();
            return {
                ...data,
                school_name: data.school_id?.name,
                telephone: data.school_id?.telephone,
                campaign_name: data.school_id?.campaign_id?.name
            };
        });

        res.json(flatFollowups);
    } catch (err) {
        next(err);
    }
};
