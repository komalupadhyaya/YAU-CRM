import mongoose from 'mongoose';
import MarketingContact from '../models/emailMarketingContact.model.js';
import EALead from '../models/eaLead.model.js';

/**
 * Get paginated, searchable, filterable marketing contacts
 * GET /api/marketing-contacts
 */
export const getMarketingContacts = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 25,
            search = '',
            entryPoint = 'all',
            status = 'all',
            deduplicatedOnly = 'false',
            sortBy = 'lastRegisteredAt',
            sortOrder = 'desc'
        } = req.query;

        const query = {};

        // 1. Search filter
        if (search && search.trim()) {
            const searchRegex = new RegExp(search.trim(), 'i');
            query.$or = [
                { parentName: searchRegex },
                { email: searchRegex },
                { phone: searchRegex },
                { schoolName: searchRegex },
                { locationName: searchRegex },
                { source: searchRegex }
            ];
        }

        // 2. Entry point filter
        if (entryPoint && entryPoint !== 'all') {
            query.entryPoint = entryPoint;
        }

        // 3. Status filter
        if (status && status !== 'all') {
            query.status = status;
        }

        // 4. Deduplicated only filter
        if (deduplicatedOnly === 'true') {
            query.submissionCount = { $gt: 1 };
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 25));
        const skip = (pageNum - 1) * limitNum;

        // Sorting
        const sortObj = {};
        sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Execute queries in parallel
        const [contacts, totalCount, statsData] = await Promise.all([
            MarketingContact.find(query)
                .sort(sortObj)
                .skip(skip)
                .limit(limitNum)
                .lean(),
            MarketingContact.countDocuments(query),
            MarketingContact.aggregate([
                {
                    $group: {
                        _id: '$entryPoint',
                        count: { $sum: 1 },
                        deduplicated: {
                            $sum: { $cond: [{ $gt: ['$submissionCount', 1] }, 1, 0] }
                        }
                    }
                }
            ])
        ]) ;

        // Total deduplicated across all records
        const totalDeduplicatedResult = await MarketingContact.countDocuments({ submissionCount: { $gt: 1 } });
        const allContactsCount = await MarketingContact.countDocuments();

        const stats = {
            total: allContactsCount,
            school: 0,
            location: 0,
            free_app: 0,
            deduplicated: totalDeduplicatedResult
        };

        statsData.forEach(item => {
            if (item._id && stats[item._id] !== undefined) {
                stats[item._id] = item.count;
            }
        });

        return res.json({
            success: true,
            contacts,
            pagination: {
                total: totalCount,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(totalCount / limitNum) || 1
            },
            stats
        });
    } catch (error) {
        console.error('[Get Marketing Contacts Error]:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch marketing contacts', error: error.message });
    }
};

/**
 * Get stats breakdown for marketing contacts
 * GET /api/marketing-contacts/stats
 */
export const getMarketingContactStats = async (req, res) => {
    try {
        const [total, byEntryPoint, deduplicated] = await Promise.all([
            MarketingContact.countDocuments(),
            MarketingContact.aggregate([
                { $group: { _id: '$entryPoint', count: { $sum: 1 } } }
            ]),
            MarketingContact.countDocuments({ submissionCount: { $gt: 1 } })
        ]);

        const breakdown = {
            total,
            deduplicated,
            school: 0,
            location: 0,
            free_app: 0,
            ea_lead: 0
        };

        byEntryPoint.forEach(item => {
            if (item._id && breakdown[item._id] !== undefined) {
                breakdown[item._id] = item.count;
            }
        });

        return res.json({ success: true, stats: breakdown });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to fetch stats', error: error.message });
    }
};

/**
 * Get single marketing contact by ID
 * GET /api/marketing-contacts/:id
 */
export const getMarketingContactById = async (req, res) => {
    try {
        const contact = await MarketingContact.findById(req.params.id);
        if (!contact) {
            return res.status(404).json({ success: false, message: 'Marketing contact not found' });
        }
        return res.json({ success: true, contact });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error retrieving contact', error: error.message });
    }
};

/**
 * Delete a marketing contact by ID
 * DELETE /api/marketing-contacts/:id
 */
export const deleteMarketingContact = async (req, res) => {
    try {
        const contact = await MarketingContact.findByIdAndDelete(req.params.id);
        if (!contact) {
            return res.status(404).json({ success: false, message: 'Marketing contact not found' });
        }
        return res.json({ success: true, message: `Contact "${contact.parentName}" (${contact.email}) deleted successfully.` });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error deleting contact', error: error.message });
    }
};

/**
 * Update marketing contact status (e.g. active <-> opted_out)
 * PATCH /api/marketing-contacts/:id/status
 */
export const updateMarketingContactStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status || !['active', 'opted_out', 'bounced'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status. Must be "active", "opted_out", or "bounced".' });
        }

        const isEmailConsent = status === 'active';
        const contact = await MarketingContact.findByIdAndUpdate(
            id,
            { status, isEmailConsent },
            { new: true }
        );

        if (!contact) {
            return res.status(404).json({ success: false, message: 'Marketing contact not found' });
        }

        // Also sync status to EmailSegment contacts if email matches
        const EmailSegment = mongoose.model('EmailSegment');
        await EmailSegment.updateMany(
            { "contacts.email": contact.email },
            { $set: { "contacts.$.status": status } }
        );

        return res.json({ 
            success: true, 
            message: `Contact status updated to "${status}".`,
            contact 
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error updating contact status', error: error.message });
    }
};

/**
 * Create or manually ingest a marketing contact
 * POST /api/marketing-contacts
 */
export const createMarketingContact = async (req, res) => {
    try {
        const {
            parentName,
            email,
            phone = '',
            entryPoint = 'free_app',
            schoolName = '',
            schoolId = '',
            locationName = '',
            locationId = '',
            source = 'Manual CRM Entry',
            metadata = {}
        } = req.body;

        if (!parentName || !parentName.trim()) {
            return res.status(400).json({ success: false, message: 'Parent name is required.' });
        }
        if (!email || !email.trim() || !email.includes('@')) {
            return res.status(400).json({ success: false, message: 'A valid email address is required.' });
        }

        const validEntryPoints = ['school', 'location', 'free_app'];
        const normalizedEntryPoint = validEntryPoints.includes(entryPoint) ? entryPoint : 'free_app';
        const cleanEmail = email.toLowerCase().trim();

        // 1. Deduplication check in MarketingContact
        let existingContact = await MarketingContact.findOne({ email: cleanEmail });
        let isDuplicate = false;
        let contact = null;

        if (existingContact) {
            isDuplicate = true;
            existingContact.parentName = parentName.trim();
            if (phone) existingContact.phone = phone.trim();
            existingContact.entryPoint = normalizedEntryPoint;
            if (schoolName) existingContact.schoolName = schoolName.trim();
            if (schoolId) existingContact.schoolId = schoolId.trim();
            if (locationName) existingContact.locationName = locationName.trim();
            if (locationId) existingContact.locationId = locationId.trim();
            if (source) existingContact.source = source.trim();
            if (metadata && typeof metadata === 'object') {
                existingContact.metadata = { ...existingContact.metadata, ...metadata };
            }
            existingContact.submissionCount = (existingContact.submissionCount || 1) + 1;
            existingContact.lastRegisteredAt = new Date();

            contact = await existingContact.save();
        } else {
            contact = await MarketingContact.create({
                parentName: parentName.trim(),
                email: cleanEmail,
                phone: phone ? phone.trim() : '',
                entryPoint: normalizedEntryPoint,
                schoolName: schoolName ? schoolName.trim() : '',
                schoolId: schoolId ? schoolId.trim() : '',
                locationName: locationName ? locationName.trim() : '',
                locationId: locationId ? locationId.trim() : '',
                source: source ? source.trim() : 'Manual CRM Entry',
                metadata: metadata && typeof metadata === 'object' ? metadata : {},
                submissionCount: 1,
                lastRegisteredAt: new Date(),
                status: 'active',
                isEmailConsent: true
            });
        }

        return res.status(isDuplicate ? 200 : 201).json({
            success: true,
            isDuplicate,
            message: isDuplicate
                ? `Existing contact updated and registrations merged (${contact.submissionCount}x)!`
                : `Marketing contact "${contact.parentName}" added successfully.`,
            contact
        });
    } catch (error) {
        console.error('[Create Marketing Contact Error]:', error);
        return res.status(500).json({ success: false, message: 'Failed to create marketing contact', error: error.message });
    }
};

/**
 * Update an existing marketing contact
 * PUT /api/marketing-contacts/:id
 */
export const updateMarketingContact = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            parentName,
            email,
            phone = '',
            entryPoint = 'free_app',
            schoolName = '',
            schoolId = '',
            locationName = '',
            locationId = '',
            source = 'Manual CRM Entry',
            status = 'active',
            metadata = {}
        } = req.body;

        if (!parentName || !parentName.trim()) {
            return res.status(400).json({ success: false, message: 'Parent name is required.' });
        }
        if (!email || !email.trim() || !email.includes('@')) {
            return res.status(400).json({ success: false, message: 'A valid email address is required.' });
        }

        const validEntryPoints = ['school', 'location', 'free_app'];
        const normalizedEntryPoint = validEntryPoints.includes(entryPoint) ? entryPoint : 'free_app';
        const cleanEmail = email.toLowerCase().trim();

        const contact = await MarketingContact.findById(id);
        if (!contact) {
            return res.status(404).json({ success: false, message: 'Marketing contact not found' });
        }

        const prevEmail = contact.email;

        contact.parentName = parentName.trim();
        contact.email = cleanEmail;
        contact.phone = phone ? phone.trim() : '';
        contact.entryPoint = normalizedEntryPoint;
        contact.schoolName = schoolName ? schoolName.trim() : '';
        contact.schoolId = schoolId ? schoolId.trim() : '';
        contact.locationName = locationName ? locationName.trim() : '';
        contact.locationId = locationId ? locationId.trim() : '';
        contact.source = source ? source.trim() : contact.source;
        if (['active', 'opted_out', 'bounced'].includes(status)) {
            contact.status = status;
            contact.isEmailConsent = (status === 'active');
        }
        if (metadata && typeof metadata === 'object') {
            contact.metadata = { ...contact.metadata, ...metadata };
        }

        await contact.save();

        // If email changed, update existing segment contacts with old email
        if (prevEmail !== cleanEmail) {
            const EmailSegment = mongoose.model('EmailSegment');
            await EmailSegment.updateMany(
                { "contacts.email": prevEmail },
                { $set: { "contacts.$.email": cleanEmail, "contacts.$.name": contact.parentName } }
            );
        }

        return res.json({
            success: true,
            message: `Contact "${contact.parentName}" updated successfully.`,
            contact
        });
    } catch (error) {
        console.error('[Update Marketing Contact Error]:', error);
        return res.status(500).json({ success: false, message: 'Failed to update marketing contact', error: error.message });
    }
};



