import MarketingContact from '../models/emailMarketingContact.model.js';

/**
 * Handle Single Marketing Registration Webhook
 * URL: POST /api/webhooks/marketing-registration
 * Note: Marketing registrations strictly persist to email_marketing_contacts.
 * No automated lists/segments are ever created in Email Center under any condition.
 */
export const handleMarketingRegistration = async (req, res) => {
    try {
        console.log('--- MARKETING REGISTRATION WEBHOOK RECEIVED ---', req.body);
        const payload = req.body || {};

        // ── 1. Check for Admin List Sync / Deletion Actions ─────────────────
        const action = payload.action || payload.event;
        if (action === 'sync_list' || action === 'create_list' || action === 'update_list') {
            const entityType = payload.entityType || payload.type || 'entity';
            const entityName = (payload.name || payload.schoolName || payload.locationName || '').trim();

            console.log(`[Marketing Webhook] Admin Sync event received for ${entityType} "${entityName}". (Automated list creation disabled - lists are created strictly manually in Email Center).`);
            return res.status(200).json({
                success: true,
                message: `Admin sync event for ${entityType} "${entityName}" acknowledged.`
            });
        }

        if (action === 'delete_list' || action === 'delete_entity') {
            // Guarantee: Deletions in the admin panel leave CRM lists and contacts intact
            const entityName = payload.name || payload.schoolName || payload.locationName || 'Unknown';
            console.log(`[Marketing Webhook] Received deletion notification for "${entityName}". Retaining all contacts intact per safety policy.`);
            return res.status(200).json({
                success: true,
                message: 'Entity deletion acknowledged. Associated CRM contacts remain fully intact.',
                retained: true
            });
        }

        // ── 2. Registration Ingestion & Extraction ─────────────────────────
        const parentName = (payload.parentName || payload.parent_name || payload.name || '').trim();
        const rawEmail = (payload.email || payload.email_address || payload.parentEmail || '').trim();
        const rawPhone = (payload.phone || payload.phone_number || payload.telephone || '').trim();
        const rawEntryPoint = (payload.entryPoint || payload.entry_point || '').trim().toLowerCase();
        const schoolName = (payload.schoolName || payload.school_name || payload.school || '').trim();
        const schoolId = (payload.schoolId || payload.school_id || '').trim();
        const locationName = (payload.locationName || payload.location_name || payload.location || '').trim();
        const locationId = (payload.locationId || payload.location_id || '').trim();
        const source = (payload.source || 'App Registration').trim();
        const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};

        // Validation
        if (!parentName) {
            return res.status(400).json({ success: false, message: 'Field "parentName" is required.' });
        }
        if (!rawEmail || !rawEmail.includes('@')) {
            return res.status(400).json({ success: false, message: 'Valid "email" address is required.' });
        }

        // Normalize entryPoint to one of: 'school', 'location', 'free_app'
        let entryPoint = 'free_app';
        if (rawEntryPoint === 'school' || schoolName || schoolId) {
            entryPoint = 'school';
        } else if (rawEntryPoint === 'location' || locationName || locationId) {
            entryPoint = 'location';
        } else {
            entryPoint = 'free_app';
        }

        const cleanEmail = rawEmail.toLowerCase();

        // ── 3. Strict Deduplication in MarketingContact Model ───────────────
        let existingContact = await MarketingContact.findOne({ email: cleanEmail });
        let isDuplicate = false;
        let contact = null;

        if (existingContact) {
            isDuplicate = true;
            console.log(`[Marketing Webhook] Duplicate registration detected for email "${cleanEmail}". Updating existing record.`);

            existingContact.parentName = parentName;
            if (rawPhone) existingContact.phone = rawPhone;
            existingContact.entryPoint = entryPoint;
            if (schoolName) existingContact.schoolName = schoolName;
            if (schoolId) existingContact.schoolId = schoolId;
            if (locationName) existingContact.locationName = locationName;
            if (locationId) existingContact.locationId = locationId;
            if (source) existingContact.source = source;
            if (metadata && Object.keys(metadata).length > 0) {
                existingContact.metadata = { ...existingContact.metadata, ...metadata };
            }

            existingContact.submissionCount = (existingContact.submissionCount || 1) + 1;
            existingContact.lastRegisteredAt = new Date();

            contact = await existingContact.save();
        } else {
            console.log(`[Marketing Webhook] Creating new MarketingContact for "${cleanEmail}"...`);
            contact = await MarketingContact.create({
                parentName,
                email: cleanEmail,
                phone: rawPhone,
                entryPoint,
                schoolName,
                schoolId,
                locationName,
                locationId,
                source,
                metadata,
                submissionCount: 1,
                lastRegisteredAt: new Date(),
                status: 'active'
            });
        }

        // ── 4. Response (Pure Marketing Contact Ingestion - Zero Auto-Segment Creation) ──
        return res.status(200).json({
            success: true,
            message: isDuplicate 
                ? `Existing contact for "${cleanEmail}" updated successfully (Submission count: ${contact.submissionCount}).`
                : `New contact for "${cleanEmail}" created successfully.`,
            isDuplicate,
            data: {
                contactId: contact._id,
                parentName: contact.parentName,
                email: contact.email,
                phone: contact.phone,
                entryPoint: contact.entryPoint,
                schoolName: contact.schoolName,
                locationName: contact.locationName,
                submissionCount: contact.submissionCount,
                lastRegisteredAt: contact.lastRegisteredAt
            }
        });

    } catch (error) {
        console.error('[Marketing Webhook Error]:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error processing marketing registration',
            error: error.message
        });
    }
};

/**
 * Health check & API specification info for the single marketing webhook
 * URL: GET /api/webhooks/marketing-registration/health
 */
export const getMarketingWebhookHealth = async (req, res) => {
    try {
        const totalContacts = await MarketingContact.countDocuments();
        const byEntryPoint = await MarketingContact.aggregate([
            { $group: { _id: '$entryPoint', count: { $sum: 1 } } }
        ]);

        return res.json({
            status: 'online',
            endpoint: '/api/webhooks/marketing-registration',
            description: 'Unified marketing registration webhook for YAU CRM',
            totalContacts,
            entryPointsBreakdown: byEntryPoint.reduce((acc, curr) => {
                acc[curr._id] = curr.count;
                return acc;
            }, {}),
            supportedEntryPoints: ['school', 'location', 'free_app']
        });
    } catch (err) {
        return res.status(500).json({ status: 'error', error: err.message });
    }
};
