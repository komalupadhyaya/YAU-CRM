import MarketingContact from '../models/emailMarketingContact.model.js';
import { getOrCreateSegment, routeRegistrationToSegment } from '../services/email/listRouting.service.js';

/**
 * Handle Single Marketing Registration Webhook
 * URL: POST /api/webhooks/marketing-registration
 * Ingests parent registrations from:
 *   - After School registration form
 *   - Evening Activities (member portal)
 *   - Mobile App (new user registration)
 * And routes each contact automatically to its dedicated school or location list.
 */
export const handleMarketingRegistration = async (req, res) => {
    try {
        console.log('--- MARKETING REGISTRATION WEBHOOK RECEIVED ---', req.body);
        const payload = req.body || {};

        // ── 1. Check for Admin List Sync / Creation Actions ─────────────────
        const action = payload.action || payload.event;
        if (action === 'sync_list' || action === 'create_list' || action === 'update_list') {
            const rawEntityType = String(payload.entityType || payload.type || 'entity').toLowerCase();
            const entityName = (payload.name || '').trim();

            if (entityName) {
                let targetListName = '';
                let targetCategory = 'marketing';

                if (rawEntityType.includes('school')) {
                    targetListName = `${entityName} - After School`;
                    targetCategory = 'school';
                } else if (rawEntityType.includes('location')) {
                    targetListName = `${entityName} - Evening Activities`;
                    targetCategory = 'location';
                } else {
                    targetListName = `${entityName} - Marketing`;
                    targetCategory = 'custom';
                }

                const segment = await getOrCreateSegment({
                    listName: targetListName,
                    category: targetCategory,
                    description: `Auto-synced list for ${entityName} (${rawEntityType})`
                });

                console.log(`[Marketing Webhook] Admin Sync: Created/verified list "${segment.name}"`);

                return res.status(200).json({
                    success: true,
                    message: `List "${segment.name}" successfully created and synchronized in CRM.`,
                    listId: segment._id,
                    listName: segment.name
                });
            }

            return res.status(200).json({
                success: true,
                message: `Admin sync event acknowledged.`
            });
        }

        if (action === 'delete_list' || action === 'delete_entity') {
            // Guarantee: Deletions in the admin panel leave CRM lists and contacts intact
            const entityName = payload.name || 'Unknown';
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
        
        // Resolve source with backward compatibility
        let source = (payload.source || '').trim();
        if (!source) {
            if (payload.entryPoint) {
                const ep = String(payload.entryPoint).toLowerCase();
                source = ep === 'school' ? 'afterschool' : ep === 'location' ? 'web_portal' : 'mobile';
            } else if (payload.schoolName || payload.school_name) {
                source = 'afterschool';
            } else if (payload.locationName || payload.location_name) {
                source = 'web_portal';
            } else {
                source = 'mobile';
            }
        }

        const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};

        // Extract key registration fields from top-level or metadata
        const schoolName = (payload.schoolName || payload.school || payload.school_name || metadata.schoolName || metadata.school || '').trim();
        const locationName = (payload.locationName || payload.location || payload.location_name || metadata.locationName || metadata.location || '').trim();
        const sport = (payload.sport || payload.sportsInterest || payload.sportRegistered || metadata.sport || metadata.sportsInterest || metadata.sportRegistered || '').trim();
        const gradeBand = (payload.gradeBand || payload.grade || payload.grade_band || metadata.gradeBand || metadata.grade || '').trim();
        const planType = (payload.planType || payload.plan || payload.plan_type || metadata.planType || metadata.plan || '').trim();
        const studentName = (payload.studentName || payload.childName || payload.student_name || metadata.studentName || metadata.childName || '').trim();

        // Validation
        if (!parentName) {
            return res.status(400).json({ success: false, message: 'Field "parentName" is required.' });
        }
        if (!rawEmail || !rawEmail.includes('@')) {
            return res.status(400).json({ success: false, message: 'Valid "email" address is required.' });
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
            if (source) existingContact.source = source;
            if (schoolName) existingContact.schoolName = schoolName;
            if (locationName) existingContact.locationName = locationName;
            if (sport) existingContact.sport = sport;
            if (gradeBand) existingContact.gradeBand = gradeBand;
            if (planType) existingContact.planType = planType;
            if (studentName) existingContact.studentName = studentName;

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
                source,
                schoolName,
                locationName,
                sport,
                gradeBand,
                planType,
                studentName,
                metadata,
                submissionCount: 1,
                lastRegisteredAt: new Date(),
                status: 'active'
            });
        }

        // ── 4. Automatic Drop into Dedicated School/Location List ──────────
        const routingResult = await routeRegistrationToSegment({
            parentName: contact.parentName,
            email: contact.email,
            phone: contact.phone,
            source: contact.source,
            entryPoint: payload.entryPoint,
            schoolName: contact.schoolName,
            locationName: contact.locationName,
            sport: contact.sport,
            gradeBand: contact.gradeBand,
            planType: contact.planType
        });

        console.log(`[Marketing Webhook] Routed contact "${contact.email}" to list: "${routingResult.listName}"`);

        // ── 5. Response ────────────────────────────────────────────────────
        return res.status(200).json({
            success: true,
            message: isDuplicate 
                ? `Existing contact for "${cleanEmail}" updated and sorted into list "${routingResult.listName}".`
                : `New contact for "${cleanEmail}" created and sorted into list "${routingResult.listName}".`,
            isDuplicate,
            targetList: routingResult.listName,
            data: {
                contactId: contact._id,
                parentName: contact.parentName,
                email: contact.email,
                phone: contact.phone,
                source: contact.source,
                schoolName: contact.schoolName,
                locationName: contact.locationName,
                sport: contact.sport,
                gradeBand: contact.gradeBand,
                planType: contact.planType,
                studentName: contact.studentName,
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
 * Health check & API specification info for the marketing webhook
 * URL: GET /api/webhooks/marketing-registration/health
 */
export const getMarketingWebhookHealth = async (req, res) => {
    try {
        const totalContacts = await MarketingContact.countDocuments();
        const bySource = await MarketingContact.aggregate([
            { $group: { _id: '$source', count: { $sum: 1 } } }
        ]);

        return res.json({
            status: 'online',
            endpoint: '/api/webhooks/marketing-registration',
            description: 'Unified marketing registration webhook for YAU CRM with automated school/location list routing',
            totalContacts,
            sourcesBreakdown: bySource.reduce((acc, curr) => {
                if (curr._id) acc[curr._id] = curr.count;
                return acc;
            }, {})
        });
    } catch (err) {
        return res.status(500).json({ status: 'error', error: err.message });
    }
};
