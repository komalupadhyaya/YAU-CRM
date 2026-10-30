import MarketingContact from '../models/emailMarketingContact.model.js';
import { 
    getOrCreateSegment, 
    routeRegistrationToSegment, 
    resolveTargetListName, 
    reRouteContactSegment 
} from '../services/email/listRouting.service.js';

/**
 * Helper: Normalize student object construction
 */
function buildStudentEntry({ studentName, grade = '', sport = '', school = '', location = '', dob = '' }) {
    return {
        student_name: (studentName || '').trim(),
        dob: (dob || '').trim(),
        grade: (grade || '').trim(),
        sport: (sport || '').trim(),
        school: (school || '').trim(),
        location: (location || '').trim(),
        addedAt: new Date().toISOString()
    };
}

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
                    // Unified school list name
                    targetListName = entityName;
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

        // ── 2. Handle "add_student" Event ──────────────────────────────────
        if (action === 'add_student' || action === 'append_student' || action === 'student_added') {
            const rawEmail = (payload.email || payload.parentEmail || payload.email_address || '').trim();
            if (!rawEmail || !rawEmail.includes('@')) {
                return res.status(400).json({ success: false, message: 'Valid parent "email" address is required.' });
            }
            const cleanEmail = rawEmail.toLowerCase();
            let contact = await MarketingContact.findOne({ email: cleanEmail });

            const studentObj = typeof payload.student === 'object' && payload.student !== null ? payload.student : {};
            const newStudentName = (
                studentObj.student_name || studentObj.studentName || studentObj.name ||
                payload.studentName || payload.childName || payload.student_name || ''
            ).trim();

            if (!newStudentName) {
                return res.status(400).json({ success: false, message: 'Student name is required for add_student.' });
            }

            const studentEntry = buildStudentEntry({
                studentName: newStudentName,
                dob: studentObj.dob || payload.dob || '',
                grade: studentObj.grade || studentObj.gradeBand || payload.grade || payload.gradeBand || '',
                sport: studentObj.sport || payload.sport || '',
                school: studentObj.schoolName || studentObj.school || payload.schoolName || payload.school || '',
                location: studentObj.locationName || studentObj.location || payload.locationName || payload.location || ''
            });

            const newSchool = studentEntry.school;
            const newLocation = studentEntry.location;

            let routingResult;

            if (contact) {
                const meta = contact.metadata || {};
                const currentStudents = Array.isArray(meta.students) ? [...meta.students] : [];

                const exists = currentStudents.some(s => {
                    const sName = (typeof s === 'object' && s !== null) ? (s.student_name || s.name || s.studentName) : String(s);
                    return sName && sName.toLowerCase().trim() === newStudentName.toLowerCase();
                });

                if (!exists) {
                    currentStudents.push(studentEntry);
                }

                contact.metadata = {
                    ...meta,
                    students: currentStudents,
                    studentCount: currentStudents.length
                };

                const allNames = currentStudents
                    .map(s => (typeof s === 'object' && s !== null) ? (s.student_name || s.name || s.studentName) : String(s))
                    .filter(Boolean);
                contact.studentName = allNames.join(', ');

                if (newSchool) contact.schoolName = newSchool.trim();
                if (newLocation) contact.locationName = newLocation.trim();
                if (studentEntry.sport) contact.sport = studentEntry.sport.trim();
                if (studentEntry.grade) contact.gradeBand = studentEntry.grade.trim();

                contact.submissionCount = (contact.submissionCount || 1) + 1;
                contact.lastRegisteredAt = new Date();

                // Optimized: Run contact save and segment routing in parallel
                const [savedContact, segmentResult] = await Promise.all([
                    contact.save(),
                    routeRegistrationToSegment({
                        parentName: contact.parentName,
                        email: contact.email,
                        phone: contact.phone,
                        source: contact.source,
                        schoolName: contact.schoolName,
                        locationName: contact.locationName,
                        sport: contact.sport,
                        gradeBand: contact.gradeBand
                    })
                ]);
                contact = savedContact;
                routingResult = segmentResult;
            } else {
                // Optimized: Run new contact creation and segment routing in parallel
                const parentName = (payload.parentName || payload.name || cleanEmail.split('@')[0]).trim();
                const phone = (payload.phone || payload.phone_number || '').trim();
                const source = payload.source || 'App Registration';

                const [newContact, segmentResult] = await Promise.all([
                    MarketingContact.create({
                        parentName,
                        email: cleanEmail,
                        phone,
                        source,
                        schoolName: newSchool.trim(),
                        locationName: newLocation.trim(),
                        sport: (studentEntry.sport || '').trim(),
                        gradeBand: (studentEntry.grade || '').trim(),
                        studentName: newStudentName,
                        metadata: {
                            students: [studentEntry],
                            studentCount: 1
                        },
                        submissionCount: 1,
                        lastRegisteredAt: new Date(),
                        status: 'active'
                    }),
                    routeRegistrationToSegment({
                        parentName,
                        email: cleanEmail,
                        phone,
                        source,
                        schoolName: newSchool.trim(),
                        locationName: newLocation.trim(),
                        sport: studentEntry.sport || '',
                        gradeBand: studentEntry.grade || ''
                    })
                ]);
                contact = newContact;
                routingResult = segmentResult;
            }

            return res.status(200).json({
                success: true,
                message: `Student "${newStudentName}" successfully registered to parent "${cleanEmail}".`,
                studentName: contact.studentName,
                targetList: routingResult.listName,
                contactId: contact._id
            });
        }

        // ── 3. Handle Explicit "update" / "update_student" Event ───────────
        if (action === 'update' || action === 'update_student' || action === 'update_record' || action === 'edit_record') {
            const rawEmail = (payload.email || payload.parentEmail || payload.email_address || '').trim();
            if (!rawEmail || !rawEmail.includes('@')) {
                return res.status(400).json({ success: false, message: 'Valid "email" address is required for update.' });
            }
            const cleanEmail = rawEmail.toLowerCase();
            const contact = await MarketingContact.findOne({ email: cleanEmail });

            if (!contact) {
                return res.status(404).json({ success: false, message: `Contact with email "${cleanEmail}" not found.` });
            }

            // Capture old list name for automated re-routing
            const oldList = resolveTargetListName({
                source: contact.source,
                schoolName: contact.schoolName,
                locationName: contact.locationName
            }).listName;

            if (payload.parentName || payload.name) contact.parentName = (payload.parentName || payload.name).trim();
            if (payload.phone || payload.phone_number) contact.phone = (payload.phone || payload.phone_number).trim();
            if (payload.source) contact.source = payload.source.trim();
            if (payload.schoolName !== undefined || payload.school !== undefined) {
                contact.schoolName = (payload.schoolName || payload.school || '').trim();
            }
            if (payload.locationName !== undefined || payload.location !== undefined) {
                contact.locationName = (payload.locationName || payload.location || '').trim();
            }
            if (payload.sport !== undefined) contact.sport = (payload.sport || '').trim();
            if (payload.gradeBand !== undefined || payload.grade !== undefined) {
                contact.gradeBand = (payload.gradeBand || payload.grade || '').trim();
            }
            if (payload.planType !== undefined || payload.plan !== undefined) {
                contact.planType = (payload.planType || payload.plan || '').trim();
            }

            const updatedStudentName = (payload.studentName || payload.childName || payload.student_name || '').trim();
            if (updatedStudentName) {
                contact.studentName = updatedStudentName;
            }

            const meta = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
            if (payload.students && Array.isArray(payload.students)) {
                meta.students = payload.students;
                meta.studentCount = payload.students.length;
            }
            if (Object.keys(meta).length > 0) {
                contact.metadata = { ...contact.metadata, ...meta };
            }

            contact.lastRegisteredAt = new Date();

            // Optimized: Run contact save and list re-routing in parallel
            const [savedContact, routingResult] = await Promise.all([
                contact.save(),
                reRouteContactSegment({
                    email: contact.email,
                    oldListName: oldList,
                    newContactData: {
                        parentName: contact.parentName,
                        email: contact.email,
                        phone: contact.phone,
                        source: contact.source,
                        schoolName: contact.schoolName,
                        locationName: contact.locationName,
                        sport: contact.sport,
                        gradeBand: contact.gradeBand,
                        planType: contact.planType
                    }
                })
            ]);

            return res.status(200).json({
                success: true,
                message: `Contact "${cleanEmail}" updated successfully. List: "${routingResult.listName}".`,
                targetList: routingResult.listName,
                previousList: oldList,
                reRouted: oldList.toLowerCase().trim() !== routingResult.listName.toLowerCase().trim(),
                contactId: savedContact._id
            });
        }

        // ── 4. Standard Registration Ingestion & Extraction ────────────────
        const parentName = (payload.parentName || payload.parent_name || payload.name || '').trim();
        const rawEmail = (payload.email || payload.email_address || payload.parentEmail || '').trim();
        const rawPhone = (payload.phone || payload.phone_number || payload.telephone || '').trim();
        
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

        const schoolName = (payload.schoolName || payload.school || payload.school_name || metadata.schoolName || metadata.school || '').trim();
        const locationName = (payload.locationName || payload.location || payload.location_name || metadata.locationName || metadata.location || '').trim();
        const sport = (payload.sport || payload.sportsInterest || payload.sportRegistered || metadata.sport || metadata.sportsInterest || metadata.sportRegistered || '').trim();
        const gradeBand = (payload.gradeBand || payload.grade || payload.grade_band || metadata.gradeBand || metadata.grade || '').trim();
        const planType = (payload.planType || payload.plan || payload.plan_type || metadata.planType || metadata.plan || '').trim();
        const studentName = (payload.studentName || payload.childName || payload.student_name || metadata.studentName || metadata.childName || '').trim();

        if (!parentName) {
            return res.status(400).json({ success: false, message: 'Field "parentName" is required.' });
        }
        if (!rawEmail || !rawEmail.includes('@')) {
            return res.status(400).json({ success: false, message: 'Valid "email" address is required.' });
        }

        const cleanEmail = rawEmail.toLowerCase();

        // ── 5. Strict Deduplication & Multi-Student Append ──────────────────
        let existingContact = await MarketingContact.findOne({ email: cleanEmail });
        let isDuplicate = false;
        let contact = null;
        let oldList = null;

        if (existingContact) {
            isDuplicate = true;
            console.log(`[Marketing Webhook] Duplicate registration detected for email "${cleanEmail}". Updating existing record.`);

            oldList = resolveTargetListName({
                source: existingContact.source,
                schoolName: existingContact.schoolName,
                locationName: existingContact.locationName
            }).listName;

            existingContact.parentName = parentName;
            if (rawPhone) existingContact.phone = rawPhone;
            if (source) existingContact.source = source;
            if (schoolName) existingContact.schoolName = schoolName;
            if (locationName) existingContact.locationName = locationName;
            if (sport) existingContact.sport = sport;
            if (gradeBand) existingContact.gradeBand = gradeBand;
            if (planType) existingContact.planType = planType;

            // Multi-student append: keep existing students and append new student if distinct
            if (studentName) {
                const meta = existingContact.metadata || {};
                const currentStudents = Array.isArray(meta.students) ? [...meta.students] : [];
                const alreadyExists = currentStudents.some(s => {
                    const sName = (typeof s === 'object' && s !== null) ? (s.student_name || s.name || s.studentName) : String(s);
                    return sName && sName.toLowerCase().trim() === studentName.toLowerCase();
                });

                if (!alreadyExists) {
                    currentStudents.push(buildStudentEntry({
                        studentName,
                        grade: gradeBand,
                        sport,
                        school: schoolName,
                        location: locationName
                    }));
                }
                existingContact.metadata = {
                    ...meta,
                    students: currentStudents,
                    studentCount: currentStudents.length
                };
                const allNames = currentStudents
                    .map(s => (typeof s === 'object' && s !== null) ? (s.student_name || s.name || s.studentName) : String(s))
                    .filter(Boolean);
                existingContact.studentName = allNames.length > 0 ? allNames.join(', ') : studentName;
            }

            if (metadata && Object.keys(metadata).length > 0) {
                existingContact.metadata = { ...existingContact.metadata, ...metadata };
            }

            existingContact.submissionCount = (existingContact.submissionCount || 1) + 1;
            existingContact.lastRegisteredAt = new Date();

            // Optimized: Run contact save and re-routing in parallel
            const [savedContact, routingResult] = await Promise.all([
                existingContact.save(),
                reRouteContactSegment({
                    email: existingContact.email,
                    oldListName: oldList,
                    newContactData: {
                        parentName: existingContact.parentName,
                        email: existingContact.email,
                        phone: existingContact.phone,
                        source: existingContact.source,
                        entryPoint: payload.entryPoint,
                        schoolName: existingContact.schoolName,
                        locationName: existingContact.locationName,
                        sport: existingContact.sport,
                        gradeBand: existingContact.gradeBand,
                        planType: existingContact.planType
                    }
                })
            ]);

            contact = savedContact;

            console.log(`[Marketing Webhook] Re-routed duplicate contact "${contact.email}" to list: "${routingResult.listName}"`);

            return res.status(200).json({
                success: true,
                message: `Existing contact for "${cleanEmail}" updated and sorted into list "${routingResult.listName}".`,
                isDuplicate: true,
                targetList: routingResult.listName,
                data: {
                    contactId: contact._id,
                    parentName: contact.parentName,
                    email: contact.email,
                    studentName: contact.studentName,
                    schoolName: contact.schoolName,
                    locationName: contact.locationName
                }
            });
        } else {
            console.log(`[Marketing Webhook] Creating new MarketingContact for "${cleanEmail}"...`);
            const initialStudents = studentName ? [buildStudentEntry({
                studentName,
                grade: gradeBand,
                sport,
                school: schoolName,
                location: locationName
            })] : [];

            // Optimized: Run new contact creation and segment routing concurrently
            const [createdContact, routingResult] = await Promise.all([
                MarketingContact.create({
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
                    metadata: {
                        ...metadata,
                        students: initialStudents,
                        studentCount: initialStudents.length || 1
                    },
                    submissionCount: 1,
                    lastRegisteredAt: new Date(),
                    status: 'active'
                }),
                routeRegistrationToSegment({
                    parentName,
                    email: cleanEmail,
                    phone: rawPhone,
                    source,
                    entryPoint: payload.entryPoint,
                    schoolName,
                    locationName,
                    sport,
                    gradeBand,
                    planType
                })
            ]);

            contact = createdContact;

            console.log(`[Marketing Webhook] Routed contact "${contact.email}" to list: "${routingResult.listName}"`);

            return res.status(200).json({
                success: true,
                message: `New contact for "${cleanEmail}" created and sorted into list "${routingResult.listName}".`,
                isDuplicate: false,
                targetList: routingResult.listName,
                data: {
                    contactId: contact._id,
                    parentName: contact.parentName,
                    email: contact.email,
                    studentName: contact.studentName,
                    schoolName: contact.schoolName,
                    locationName: contact.locationName
                }
            });
        }
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
        // Optimized: Run countDocuments and aggregate in parallel
        const [totalContacts, bySource] = await Promise.all([
            MarketingContact.countDocuments(),
            MarketingContact.aggregate([
                { $group: { _id: '$source', count: { $sum: 1 } } }
            ])
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
