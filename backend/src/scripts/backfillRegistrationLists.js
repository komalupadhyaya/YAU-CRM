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
    console.log('STARTING REGISTRATION LISTS & CONTACTS BACKFILL');
    console.log('====================================================');

    // 1. Flush existing automated registration segments so stale simulation entries are cleared
    await EmailSegment.updateMany(
        { category: { $in: ['school', 'location', 'app_members', 'manual'] } },
        { $set: { contacts: [] } }
    );
    console.log('Reset contacts in existing automated registration segments.');

    // 2. Fetch all Marketing Contacts (Only lists with real data will be created)
    const contacts = await MarketingContact.find({});
    console.log(`\n--- 2. Processing ${contacts.length} Existing Marketing Contacts ---`);

    let updatedCount = 0;
    let routedCount = 0;
    const distribution = {};

    for (const contact of contacts) {
        const meta = contact.metadata || {};

        // Backfill top-level fields from metadata if missing
        let hasFieldUpdates = false;

        const resolvedSchool = (contact.schoolName || meta.schoolName || meta.school || meta.school_name || '').trim();
        const resolvedLocation = (contact.locationName || meta.locationName || meta.location || meta.location_name || '').trim();
        const resolvedSport = (contact.sport || meta.sportsInterest || meta.sport || meta.sportRegistered || '').trim();
        const resolvedGrade = (contact.gradeBand || meta.grade || meta.gradeBand || meta.grade_band || '').trim();
        const resolvedPlan = (contact.planType || meta.planType || meta.plan || meta.plan_type || '').trim();
        const resolvedStudent = (contact.studentName || meta.studentName || meta.childName || meta.student_name || '').trim();

        if (!contact.schoolName && resolvedSchool) {
            contact.schoolName = resolvedSchool;
            hasFieldUpdates = true;
        }
        if (!contact.locationName && resolvedLocation) {
            contact.locationName = resolvedLocation;
            hasFieldUpdates = true;
        }
        if (!contact.sport && resolvedSport) {
            contact.sport = resolvedSport;
            hasFieldUpdates = true;
        }
        if (!contact.gradeBand && resolvedGrade) {
            contact.gradeBand = resolvedGrade;
            hasFieldUpdates = true;
        }
        if (!contact.planType && resolvedPlan) {
            contact.planType = resolvedPlan;
            hasFieldUpdates = true;
        }
        if (!contact.studentName && resolvedStudent) {
            contact.studentName = resolvedStudent;
            hasFieldUpdates = true;
        }

        if (hasFieldUpdates) {
            await contact.save();
            updatedCount++;
        }

        // Determine destination list
        const { listName, category } = resolveTargetListName({
            source: contact.source,
            schoolName: contact.schoolName,
            locationName: contact.locationName
        });

        // Ensure target segment exists
        const segment = await getOrCreateSegment({
            listName,
            category,
            description: `Automated CRM list for ${listName}`
        });

        // Add / Update contact inside segment
        await addContactToSegment({
            segmentId: segment._id,
            contactData: {
                name: contact.parentName,
                email: contact.email,
                phone: contact.phone,
                school: contact.schoolName,
                location: contact.locationName,
                source: contact.source
            }
        });

        distribution[listName] = (distribution[listName] || 0) + 1;
        routedCount++;
        console.log(` -> Contact "${contact.parentName}" (${contact.email}) => "${listName}"`);
    }

    console.log('\n====================================================');
    // Clean up any empty registration lists with 0 contacts so only active lists exist
    const cleaned = await EmailSegment.deleteMany({
        $or: [
            { contacts: { $size: 0 } },
            { contacts: { $exists: false } }
        ],
        type: { $ne: 'campaign' },
        category: { $in: ['school', 'location', 'app_members', 'manual'] }
    });
    console.log(`Cleaned up ${cleaned.deletedCount || 0} empty 0-contact list(s) from database.`);

    console.log('BACKFILL COMPLETED SUCCESSFULLY');
    console.log(`Total Contacts Processed: ${contacts.length}`);
    console.log(`Contacts with Schema Fields Backfilled: ${updatedCount}`);
    console.log(`Contacts Sorted into Lists: ${routedCount}`);
    console.log('List Distribution:', JSON.stringify(distribution, null, 2));
    console.log('====================================================');

    return {
        totalProcessed: contacts.length,
        updatedFieldsCount: updatedCount,
        routedCount,
        distribution
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
