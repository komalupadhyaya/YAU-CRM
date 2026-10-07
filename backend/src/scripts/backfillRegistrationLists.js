import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/db.config.js';
import MarketingContact from '../models/emailMarketingContact.model.js';
import EmailSegment from '../models/emailSegment.model.js';
import { getOrCreateSegment, resolveTargetListName, addContactToSegment } from '../services/email/listRouting.service.js';

dotenv.config();

const STANDARD_BASE_LISTS = [
    { name: 'Brandywine - After School', category: 'school' },
    { name: 'Carmody Hills - After School', category: 'school' },
    { name: 'Forest Heights - After School', category: 'school' },
    { name: 'William Hall - After School', category: 'school' },
    { name: 'Bowie - Evening Activities', category: 'location' },
    { name: 'Greenbelt - Evening Activities', category: 'location' },
    { name: 'Brandywine - Evening Activities', category: 'location' },
    { name: 'Free App Members', category: 'app_members' }
];

export async function runBackfill() {
    console.log('====================================================');
    console.log('STARTING REGISTRATION LISTS & CONTACTS BACKFILL (BULK OPTIMIZED)');
    console.log('====================================================');

    const startTime = Date.now();

    // 1. Fetch all Marketing Contacts in a single read query
    const contacts = await MarketingContact.find({});
    console.log(`\n--- Processing ${contacts.length} Existing Marketing Contacts ---`);

    let updatedCount = 0;
    let routedCount = 0;
    const distribution = {};
    const contactBulkOps = [];
    const listContactsMap = new Map();

    // 2. Perform all field resolution, list assignment, and deduplication IN-MEMORY (sub-millisecond)
    for (const contact of contacts) {
        const meta = contact.metadata || {};
        let hasFieldUpdates = false;
        const updateFields = {};

        const resolvedSchool = (contact.schoolName || meta.schoolName || meta.school || meta.school_name || '').trim();
        const resolvedLocation = (contact.locationName || meta.locationName || meta.location || meta.location_name || '').trim();
        const resolvedSport = (contact.sport || meta.sportsInterest || meta.sport || meta.sportRegistered || '').trim();
        const resolvedGrade = (contact.gradeBand || meta.grade || meta.gradeBand || meta.grade_band || '').trim();
        const resolvedPlan = (contact.planType || meta.planType || meta.plan || meta.plan_type || '').trim();
        const resolvedStudent = (contact.studentName || meta.studentName || meta.childName || meta.student_name || '').trim();

        if (!contact.schoolName && resolvedSchool) {
            contact.schoolName = resolvedSchool;
            updateFields.schoolName = resolvedSchool;
            hasFieldUpdates = true;
        }
        if (!contact.locationName && resolvedLocation) {
            contact.locationName = resolvedLocation;
            updateFields.locationName = resolvedLocation;
            hasFieldUpdates = true;
        }
        if (!contact.sport && resolvedSport) {
            contact.sport = resolvedSport;
            updateFields.sport = resolvedSport;
            hasFieldUpdates = true;
        }
        if (!contact.gradeBand && resolvedGrade) {
            contact.gradeBand = resolvedGrade;
            updateFields.gradeBand = resolvedGrade;
            hasFieldUpdates = true;
        }
        if (!contact.planType && resolvedPlan) {
            contact.planType = resolvedPlan;
            updateFields.planType = resolvedPlan;
            hasFieldUpdates = true;
        }
        if (!contact.studentName && resolvedStudent) {
            contact.studentName = resolvedStudent;
            updateFields.studentName = resolvedStudent;
            hasFieldUpdates = true;
        }

        if (hasFieldUpdates) {
            contactBulkOps.push({
                updateOne: {
                    filter: { _id: contact._id },
                    update: { $set: updateFields }
                }
            });
            updatedCount++;
        }

        // Determine destination list using identical routing rules
        const { listName, category } = resolveTargetListName({
            source: contact.source,
            schoolName: contact.schoolName,
            locationName: contact.locationName
        });

        if (!listContactsMap.has(listName)) {
            listContactsMap.set(listName, {
                name: listName,
                category,
                description: `Automated CRM list for ${listName}`,
                contacts: []
            });
        }

        const listData = listContactsMap.get(listName);
        const cleanEmail = (contact.email || '').toLowerCase().trim();

        // Handle contact deduplication inside the segment
        const existingIdx = listData.contacts.findIndex(
            c => c.email && c.email.toLowerCase().trim() === cleanEmail
        );

        if (existingIdx >= 0) {
            const existing = listData.contacts[existingIdx];
            if (contact.parentName) existing.name = contact.parentName;
            if (contact.phone) existing.phone = contact.phone;
            if (contact.schoolName) existing.school = contact.schoolName;
            if (contact.locationName) existing.location = contact.locationName;
            if (contact.source) existing.source = contact.source;
            existing.lastRegisteredAt = new Date();
            existing.registrationCount = (existing.registrationCount || 1) + 1;
            existing.status = 'active';
        } else if (cleanEmail && cleanEmail.includes('@')) {
            listData.contacts.push({
                name: contact.parentName || cleanEmail.split('@')[0],
                email: cleanEmail,
                phone: contact.phone || '',
                school: contact.schoolName || '',
                location: contact.locationName || '',
                source: contact.source || 'App Registration',
                registrationCount: 1,
                lastRegisteredAt: new Date(),
                status: 'active'
            });
        }

        distribution[listName] = (distribution[listName] || 0) + 1;
        routedCount++;
    }

    // 3. Bulk Write Contact Field Updates (Single network operation)
    if (contactBulkOps.length > 0) {
        await MarketingContact.bulkWrite(contactBulkOps, { ordered: false });
        console.log(`Bulk updated ${contactBulkOps.length} contact schema fields in single batch.`);
    }

    // 4. Flush existing automated registration segments so stale entries are cleared
    await EmailSegment.updateMany(
        { category: { $in: ['school', 'location', 'app_members', 'manual'] } },
        { $set: { contacts: [] } }
    );

    // 5. Bulk Upsert All Target Segments (Single network operation for all lists)
    const segmentBulkOps = [];
    for (const [listName, listData] of listContactsMap.entries()) {
        const nameRegex = new RegExp(`^${listName.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i');
        segmentBulkOps.push({
            updateOne: {
                filter: { name: nameRegex },
                update: {
                    $set: {
                        name: listData.name,
                        category: listData.category,
                        description: listData.description,
                        type: 'marketing',
                        isSystemList: true,
                        contacts: listData.contacts
                    }
                },
                upsert: true
            }
        });
    }

    if (segmentBulkOps.length > 0) {
        await EmailSegment.bulkWrite(segmentBulkOps, { ordered: false });
        console.log(`Bulk upserted ${segmentBulkOps.length} segment lists with contacts in single batch.`);
    }

    // 6. Clean up any empty registration lists with 0 contacts
    const cleaned = await EmailSegment.deleteMany({
        $or: [
            { contacts: { $size: 0 } },
            { contacts: { $exists: false } }
        ],
        type: { $ne: 'campaign' },
        category: { $in: ['school', 'location', 'app_members', 'manual'] }
    });
    console.log(`Cleaned up ${cleaned.deletedCount || 0} empty 0-contact list(s) from database.`);

    const elapsedMs = Date.now() - startTime;
    console.log('====================================================');
    console.log(`BACKFILL COMPLETED SUCCESSFULLY in ${elapsedMs}ms`);
    console.log(`Total Contacts Processed: ${contacts.length}`);
    console.log(`Contacts with Schema Fields Backfilled: ${updatedCount}`);
    console.log(`Contacts Sorted into Lists: ${routedCount}`);
    console.log('List Distribution:', JSON.stringify(distribution, null, 2));
    console.log('====================================================');

    return {
        totalProcessed: contacts.length,
        updatedFieldsCount: updatedCount,
        routedCount,
        distribution,
        elapsedMs
    };
}

// Direct CLI execution
if (process.argv[1] && process.argv[1].endsWith('backfillRegistrationLists.js')) {
    connectDB()
        .then(async () => {
            await runBackfill();
            await mongoose.disconnect();
            process.exit(0);
        })
        .catch(err => {
            console.error('Backfill execution failed:', err);
            process.exit(1);
        });
}
