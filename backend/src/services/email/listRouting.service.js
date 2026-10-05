import mongoose from 'mongoose';
import EmailSegment from '../../models/emailSegment.model.js';

/**
 * Format and normalize list names according to client standard:
 * - After School: "[School Name] - After School"
 * - Evening Activities: "[Location Name] - Evening Activities"
 * - Mobile App with School: "[School Name] - Mobile App"
 * - Mobile App with Location: "[Location Name] - Mobile App"
 * - Mobile App without School or Location: "Free App Members"
 */
export function resolveTargetListName({ source, entryPoint, schoolName, locationName }) {
    const cleanSource = (source || entryPoint || '').toLowerCase().trim();
    const cleanSchool = (schoolName || '').trim();
    const cleanLocation = (locationName || '').trim();

    // 1. Mobile App Signups
    if (cleanSource.includes('mobile') || cleanSource.includes('free_app') || cleanSource.includes('app')) {
        if (cleanSchool) {
            return {
                listName: `${cleanSchool} - Mobile App`,
                category: 'school'
            };
        }
        if (cleanLocation) {
            return {
                listName: `${cleanLocation} - Mobile App`,
                category: 'location'
            };
        }
        return {
            listName: 'Free App Members',
            category: 'app_members'
        };
    }

    // 2. Evening Activities (Member Portal)
    if (
        cleanSource.includes('portal') || 
        cleanSource.includes('evening') || 
        cleanSource.includes('location') ||
        (cleanLocation && !cleanSchool)
    ) {
        const loc = cleanLocation || 'General';
        return {
            listName: `${loc} - Evening Activities`,
            category: 'location'
        };
    }

    // 3. After School Programs
    if (cleanSource.includes('afterschool') || cleanSource.includes('school') || cleanSchool) {
        const sch = cleanSchool || 'General';
        return {
            listName: `${sch} - After School`,
            category: 'school'
        };
    }

    // 4. Manual CRM Entries
    if (cleanSource.includes('manual')) {
        return {
            listName: 'Manual CRM Entries',
            category: 'manual'
        };
    }

    // Default Fallback
    if (cleanSchool) {
        return { listName: `${cleanSchool} - After School`, category: 'school' };
    }
    if (cleanLocation) {
        return { listName: `${cleanLocation} - Evening Activities`, category: 'location' };
    }

    return {
        listName: 'Free App Members',
        category: 'app_members'
    };
}

/**
 * Find or auto-create an EmailSegment by name
 */
export async function getOrCreateSegment({ listName, category = 'marketing', description = '' }) {
    if (!listName || !listName.trim()) {
        throw new Error('List name is required for segment creation');
    }

    const trimmedName = listName.trim();
    const nameRegex = new RegExp(`^${trimmedName.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i');

    let segment = await EmailSegment.findOne({ name: nameRegex });

    if (!segment) {
        console.log(`[List Routing] Auto-creating new list: "${trimmedName}" (${category})`);
        segment = await EmailSegment.create({
            name: trimmedName,
            description: description || `Automated CRM email list for ${trimmedName}`,
            type: 'marketing',
            category: category || 'marketing',
            isSystemList: true,
            contacts: []
        });
    }

    return segment;
}

/**
 * Add or update contact inside an EmailSegment
 */
export async function addContactToSegment({ segmentId, contactData }) {
    if (!segmentId) return null;
    const {
        name = '',
        email,
        phone = '',
        school = '',
        location = '',
        source = 'App Registration'
    } = contactData;

    if (!email || !email.includes('@')) {
        return null;
    }

    const cleanEmail = email.toLowerCase().trim();
    const segment = await EmailSegment.findById(segmentId);
    if (!segment) return null;

    if (!segment.contacts) {
        segment.contacts = [];
    }

    const existingIndex = segment.contacts.findIndex(
        c => c.email && c.email.toLowerCase().trim() === cleanEmail
    );

    if (existingIndex >= 0) {
        const existing = segment.contacts[existingIndex];
        if (name) existing.name = name;
        if (phone) existing.phone = phone;
        if (school) existing.school = school;
        if (location) existing.location = location;
        if (source) existing.source = source;
        existing.lastRegisteredAt = new Date();
        existing.registrationCount = (existing.registrationCount || 1) + 1;
        existing.status = 'active';
    } else {
        segment.contacts.push({
            name: name || cleanEmail.split('@')[0],
            email: cleanEmail,
            phone: phone || '',
            school: school || '',
            location: location || '',
            source: source || 'App Registration',
            registrationCount: 1,
            lastRegisteredAt: new Date(),
            status: 'active'
        });
    }

    await segment.save();
    return segment;
}

/**
 * High-level helper: resolve list, ensure segment exists, and drop contact into it
 */
export async function routeRegistrationToSegment(contactData) {
    try {
        const { listName, category } = resolveTargetListName({
            source: contactData.source,
            entryPoint: contactData.entryPoint,
            schoolName: contactData.schoolName || contactData.school,
            locationName: contactData.locationName || contactData.location
        });

        const segment = await getOrCreateSegment({
            listName,
            category,
            description: `Automated CRM list for ${listName}`
        });

        await addContactToSegment({
            segmentId: segment._id,
            contactData: {
                name: contactData.parentName || contactData.name,
                email: contactData.email,
                phone: contactData.phone,
                school: contactData.schoolName || contactData.school || '',
                location: contactData.locationName || contactData.location || '',
                source: contactData.source || 'App Registration'
            }
        });

        return { success: true, listName, segmentId: segment._id };
    } catch (err) {
        console.error('[List Routing Error]:', err);
        return { success: false, error: err.message };
    }
}
