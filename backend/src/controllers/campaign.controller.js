import mongoose from 'mongoose';
import Campaign from '../models/campaign.model.js';
import Lead from '../models/lead.model.js';
import Followup from '../models/followup.model.js';
import { Note } from '../models/note.model.js';
import { Contact } from '../models/contact.model.js';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/campaigns  –  list all campaigns
// ─────────────────────────────────────────────────────────────────────────────
export const getCampaigns = async (req, res, next) => {
    try {
        let filter = {};
        if (req.currentUserRole === 'sales_rep') {
            const assignedCampaignIds = await Lead.distinct('campaign_id', { assigned_to: req.user.id });
            filter = { _id: { $in: assignedCampaignIds } };
        }
        const campaigns = await Campaign.find(filter).sort({ createdAt: -1 });
        res.json(campaigns);
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/campaigns  –  create a campaign
// ─────────────────────────────────────────────────────────────────────────────
export const createCampaign = async (req, res, next) => {
    try {
        const { name } = req.body;
        if (!name) {
            res.status(400);
            throw new Error('Campaign name is required');
        }

        const existing = await Campaign.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        if (existing) {
            res.status(400);
            throw new Error('A campaign with this name already exists');
        }

        const campaign = await Campaign.create({ name });
        res.json(campaign);
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/campaigns/:id  –  campaign detail with live metrics
// ─────────────────────────────────────────────────────────────────────────────
export const getCampaignById = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
            res.status(400);
            throw new Error('Invalid campaign ID format');
        }

        const campaign = await Campaign.findById(id);
        if (!campaign) {
            res.status(404);
            throw new Error('Campaign not found');
        }

        // Check if Sales Rep has any assigned leads in this campaign
        if (req.currentUserRole === 'sales_rep') {
            const hasAssignedLead = await Lead.exists({ campaign_id: campaign._id, assigned_to: req.user.id });
            if (!hasAssignedLead) {
                res.status(403);
                throw new Error('Access denied. You have no leads assigned in this campaign.');
            }
        }

        // Match only assigned leads for Sales Rep metrics
        const leadMatch = { campaign_id: campaign._id };
        if (req.currentUserRole === 'sales_rep') {
            leadMatch.assigned_to = new mongoose.Types.ObjectId(req.user.id);
        }

        const [leadAgg, followupAgg] = await Promise.all([
            Lead.aggregate([
                { $match: leadMatch },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]),

            Followup.aggregate([
                {
                    $lookup: {
                        from: 'leads',
                        localField: 'lead_id',
                        foreignField: '_id',
                        as: 'lead'
                    }
                },
                { $unwind: '$lead' },
                {
                    $match: {
                        'lead.campaign_id': campaign._id,
                        ...(req.currentUserRole === 'sales_rep' ? { 'lead.assigned_to': new mongoose.Types.ObjectId(req.user.id) } : {})
                    }
                },
                {
                    $count: 'total'
                }
            ])
        ]);

        let totalLeads = 0;
        const leadStatusBreakdown = leadAgg.map(s => {
            totalLeads += s.count;
            return { status: s._id || 'Unknown', count: s.count };
        });

        const totalFollowups = followupAgg[0]?.total ?? 0;

        res.json({
            campaign: campaign.toJSON(),
            metrics: {
                totalLeads,
                totalFollowups,
                leadStatusBreakdown
            }
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/campaigns/:id  –  delete campaign and associated leads
// ─────────────────────────────────────────────────────────────────────────────
export const deleteCampaign = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
            res.status(400);
            throw new Error('Invalid campaign ID format');
        }

        const campaign = await Campaign.findById(id);
        if (!campaign) {
            res.status(404);
            throw new Error('Campaign not found');
        }

        // Step 1: Get all lead IDs belonging to this campaign
        const leads = await Lead.find({ campaign_id: id }, '_id').lean();
        const leadIds = leads.map(l => l._id);

        // Step 2: Delete all Notes (Activity Feed) for those leads
        if (leadIds.length > 0) {
            await Note.deleteMany({ lead_id: { $in: leadIds } });
            await Followup.deleteMany({ lead_id: { $in: leadIds } });
            await Contact.deleteMany({ lead_id: { $in: leadIds } });
        }

        // Step 3: Delete all leads
        await Lead.deleteMany({ campaign_id: id });

        // Step 4: Delete the campaign itself
        await Campaign.findByIdAndDelete(id);

        res.json({ 
            message: 'Campaign deleted successfully',
            deleted: {
                leads: leadIds.length,
                notes: 'all',
                followups: 'all',
                contacts: 'all'
            }
        });
    } catch (err) {
        next(err);
    }
};