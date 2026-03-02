import School from '../models/school.model.js';

export const getSchools = async (req, res, next) => {
    try {
        let query = {};
        if (req.query.q) {
            query.name = { $regex: req.query.q, $options: 'i' };
        }
        const schools = await School.find(query).sort({ name: 1 });
        res.json(schools);
    } catch (err) {
        next(err);
    }
};

export const getSchoolsByCampaign = async (req, res, next) => {
    try {
        const schools = await School.find({ campaign_id: req.params.campaignId }).sort({ name: 1 });
        res.json(schools);
    } catch (err) {
        next(err);
    }
};

export const getSchoolById = async (req, res, next) => {
    try {
        if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
            res.status(400);
            throw new Error('Invalid ID format');
        }
        const school = await School.findById(req.params.id);
        if (!school) {
            res.status(404);
            throw new Error('School not found');
        }
        res.json(school);
    } catch (err) {
        next(err);
    }
};

export const createSchool = async (req, res, next) => {
    try {
        const { campaign_id, name, type, grades, principal_name, principal_email, telephone, start_time, end_time, address, city, state, zip, website } = req.body;
        if (!name || !campaign_id) {
            res.status(400);
            throw new Error('name and campaign_id are required');
        }

        const school = await School.create({
            campaign_id, name, type, grades, principal_name, principal_email, telephone,
            start_time, end_time, address, city, state, zip, website
        });
        res.json(school);
    } catch (err) {
        next(err);
    }
};

export const updateSchool = async (req, res, next) => {
    try {
        const { name, type, grades, principal_name, principal_email, telephone, start_time, end_time, address, city, state, zip, website } = req.body;
        const school = await School.findByIdAndUpdate(req.params.id, {
            name, type, grades, principal_name, principal_email, telephone,
            start_time, end_time, address, city, state, zip, website
        }, { new: true });

        if (!school) {
            res.status(404);
            throw new Error('School not found');
        }
        res.json(school);
    } catch (err) {
        next(err);
    }
};

export const updateSchoolStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        if (!status) {
            res.status(400);
            throw new Error('status is required');
        }

        const school = await School.findByIdAndUpdate(req.params.id, {
            status
        }, { new: true });

        if (!school) {
            res.status(404);
            throw new Error('School not found');
        }
        res.json(school);
    } catch (err) {
        next(err);
    }
};
