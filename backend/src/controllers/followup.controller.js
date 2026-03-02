import mongoose from 'mongoose';
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/followups/grouped  –  Follow-ups task view (overdue/today/upcoming)
// ─────────────────────────────────────────────────────────────────────────────
export const getGroupedFollowups = async (req, res, next) => {
    try {
        const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const { campaignId, schoolId } = req.query;

        // Base match: only pending follow-ups
        const matchStage = { status: 'pending' };

        if (schoolId && schoolId.match(/^[0-9a-fA-F]{24}$/)) {
            matchStage.school_id = new mongoose.Types.ObjectId(schoolId);
        }

        const pipeline = [
            { $match: matchStage },
            // Join school info
            {
                $lookup: {
                    from: 'schools',
                    localField: 'school_id',
                    foreignField: '_id',
                    as: 'school'
                }
            },
            { $unwind: '$school' },
            // Optional campaign filter
            ...(campaignId && campaignId.match(/^[0-9a-fA-F]{24}$/) ? [
                { $match: { 'school.campaign_id': new mongoose.Types.ObjectId(campaignId) } }
            ] : []),
            // Join campaign info
            {
                $lookup: {
                    from: 'campaigns',
                    localField: 'school.campaign_id',
                    foreignField: '_id',
                    as: 'campaign'
                }
            },
            {
                $unwind: {
                    path: '$campaign',
                    preserveNullAndEmptyArrays: true
                }
            },
            // Determine the bucket (overdue, dueToday, upcoming)
            {
                $addFields: {
                    bucket: {
                        $switch: {
                            branches: [
                                { case: { $lt: ['$follow_up_date', todayStr] }, then: 'overdue' },
                                { case: { $eq: ['$follow_up_date', todayStr] }, then: 'dueToday' },
                                { case: { $gt: ['$follow_up_date', todayStr] }, then: 'upcoming' }
                            ],
                            default: 'unknown'
                        }
                    }
                }
            },
            // Group into three arrays by bucket
            {
                $facet: {
                    overdue: [
                        { $match: { bucket: 'overdue' } },
                        { $sort: { follow_up_date: 1 } }
                    ],
                    dueToday: [
                        { $match: { bucket: 'dueToday' } },
                        { $sort: { createdAt: 1 } }
                    ],
                    upcoming: [
                        { $match: { bucket: 'upcoming' } },
                        { $sort: { follow_up_date: 1 } }
                    ]
                }
            }
        ];

        const [result] = await Followup.aggregate(pipeline);
        res.json(result || { overdue: [], dueToday: [], upcoming: [] });
    } catch (err) {
        next(err);
    }
};
