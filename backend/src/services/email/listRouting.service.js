import mongoose from 'mongoose';
import EmailSegment from '../../models/emailSegment.model.js';

/**
 * Format and normalize list names according to client standard:
 * - Unified School List: "[School Name]" (e.g. "Brandywine Elementary") for all school signups
 * - Evening Activities: "[Location Name] - Evening Activities"
 * - Mobile App with Location (no school): "[Location Name] - Mobile App"
 * - Mobile App without School or Location: "Free App Members"
 * - Manual CRM: "Manual CRM Entries"
 */
export function resolveTargetListName({ source, entryPoint, schoolName, locationName }) {
    const cleanSource = (source || entryPoint || '').toLowerCase().trim();
    const cleanSchool = (schoolName || '').trim();
    const cleanLocation = (locationName || '').trim();

    // 1. Unified School List: Any contact with a school routes to the unified school list
    // (e.g. "Brandywine Elementary" regardless of mobile app or afterschool portal source)
    if (cleanSchool) {
        return {
            listName: cleanSchool,
            category: 'school'
        };
    }

    // 2. Evening Activities (Member Portal with location)
    if (
        cleanSource.includes('portal') || 
        cleanSource.includes('evening') || 
        cleanSource.includes('location') ||
        (cleanLocation && !cleanSchool)
    ) {
        const loc = cleanLocation || 'General';
        return {
            listName: `${loc} - Evening Activities`,
            category: 'evening_activities'
        };
    }

    // 3. Mobile App with Location (no school)
    if (cleanSource.includes('mobile') || cleanSource.includes('free_app') || cleanSource.includes('app')) {
        if (cleanLocation) {
            return {
                listName: `${cleanLocation} - Mobile App`,
                category: 'mobile_app'
            };
        }
        return {
            listName: 'Free App Members',
            category: 'mobile_app'
        };
    }

    // 4. After School Program fallback (without school name)
    if (cleanSource.includes('afterschool') || cleanSource.includes('school')) {
        return {
            listName: 'General - After School',
            category: 'afterschool'
        };
    }

    // 5. Manual CRM Entries
    if (cleanSource.includes('manual')) {
        return {
            listName: 'Manual CRM Entries',
            category: 'manual'
        };
    }

    // Default Fallback
    if (cleanLocation) {
        return { listName: `${cleanLocation} - Evening Activities`, category: 'evening_activities' };
    }

    return {
        listName: 'Free App Members',
        category: 'mobile_app'
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

/**
 * Remove a contact from an EmailSegment by email
 */
export async function removeContactFromSegment({ segmentId, email }) {
    if (!segmentId || !email) return null;
    const cleanEmail = email.toLowerCase().trim();
    const segment = await EmailSegment.findById(segmentId);
    if (!segment || !segment.contacts) return null;

    const initialCount = segment.contacts.length;
    segment.contacts = segment.contacts.filter(
        c => c.email && c.email.toLowerCase().trim() !== cleanEmail
    );

    if (segment.contacts.length !== initialCount) {
        await segment.save();
    }
    return segment;
}

/**
 * Re-route contact: if target list differs from previous list, remove from old list and add to new list
 */
export async function reRouteContactSegment({ email, oldListName, newContactData }) {
    if (!email) return null;
    const cleanEmail = email.toLowerCase().trim();

    const { listName: targetListName } = resolveTargetListName({
        source: newContactData.source,
        entryPoint: newContactData.entryPoint,
        schoolName: newContactData.schoolName || newContactData.school,
        locationName: newContactData.locationName || newContactData.location
    });

    // If list changed or previous list was specified, clean up previous list
    if (oldListName && oldListName.toLowerCase().trim() !== targetListName.toLowerCase().trim()) {
        const oldSegment = await EmailSegment.findOne({
            name: new RegExp(`^${oldListName.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i')
        });
        if (oldSegment) {
            await removeContactFromSegment({ segmentId: oldSegment._id, email: cleanEmail });
            console.log(`[List Routing] Re-routing: Removed "${cleanEmail}" from old list "${oldSegment.name}"`);
        }
    }

    // Add or update in target list
    return await routeRegistrationToSegment(newContactData);
}
