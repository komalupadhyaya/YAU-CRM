import EALead from '../models/eaLead.model.js';
import Lead from '../models/lead.model.js';
import Contact from '../models/contact.model.js';
import EmailSegment from '../models/emailSegment.model.js';

// ── SEGMENT HELPERS ─────────────────────────────────────────────────────────

export const resolveSegmentRecipients = async (segment) => {
    let recipients = [];
    
    if (segment.type === 'static' || (segment.contacts && segment.contacts.length > 0)) {
        if (segment.contacts && segment.contacts.length > 0) {
            for (const contact of segment.contacts) {
                if (contact.status === 'active') {
                    let leadId = null;
                    let leadModel = 'ManualContact';

                    const ea = await EALead.findOne({ email: contact.email.toLowerCase().trim() }).lean();
                    if (ea) {
                        leadId = ea._id;
                        leadModel = 'EALead';
                    } else {
                        const primContact = await Contact.findOne({ email: contact.email.toLowerCase().trim() }).lean();
                        if (primContact) {
                            leadId = primContact.lead_id;
                            leadModel = 'Lead';
                        }
                    }

                    recipients.push({
                        email: contact.email.toLowerCase().trim(),
                        leadId,
                        leadModel,
                        name: contact.name || contact.email.split('@')[0]
                    });
                }
            }
        }
    } else if (segment.type === 'campaign' || segment.filters?.campaignId) {
        if (segment.filters?.campaignId) {
            const mainLeads = await Lead.find({ 
                campaign_id: segment.filters.campaignId,
                isEmailConsent: { $ne: false } 
            }).lean();
            
            if (mainLeads.length > 0) {
                const leadIds = mainLeads.map(l => l._id);
                const contacts = await Contact.find({ 
                    lead_id: { $in: leadIds } 
                }).lean();
                
                mainLeads.forEach(l => {
                    const leadContacts = contacts.filter(c => c.lead_id.toString() === l._id.toString());
                    const primary = leadContacts.find(c => c.is_primary) || leadContacts[0];
                    if (primary && primary.email) {
                        recipients.push({
                            email: primary.email.toLowerCase().trim(),
                            leadId: l._id,
                            leadModel: 'Lead',
                            name: primary.name || l.name
                        });
                    }
                });
            }
        }
    } else {
        const leadFilters = { isEmailConsent: { $ne: false } };
        const eaFilters = { isEmailConsent: { $ne: false } };
        
        if (segment.filters) {
            const { source, sport, location, status } = segment.filters;
            
            if (source) {
                eaFilters.source = { $regex: source, $options: 'i' };
            }
            if (status) {
                leadFilters.status = status;
            }
            if (location) {
                leadFilters.$or = [
                    { city: { $regex: location, $options: 'i' } },
                    { state: { $regex: location, $options: 'i' } },
                    { zip: { $regex: location, $options: 'i' } }
                ];
            }
        }

        const eaLeads = await EALead.find(eaFilters).lean();
        eaLeads.forEach(ea => {
            recipients.push({
                email: ea.email.toLowerCase().trim(),
                leadId: ea._id,
                leadModel: 'EALead',
                name: ea.name
            });
        });

        const mainLeads = await Lead.find(leadFilters).lean();
        if (mainLeads.length > 0) {
            const leadIds = mainLeads.map(l => l._id);
            const contacts = await Contact.find({ 
                lead_id: { $in: leadIds } 
            }).lean();
            
            mainLeads.forEach(l => {
                const leadContacts = contacts.filter(c => c.lead_id.toString() === l._id.toString());
                const primary = leadContacts.find(c => c.is_primary) || leadContacts[0];
                if (primary && primary.email) {
                    recipients.push({
                        email: primary.email.toLowerCase().trim(),
                        leadId: l._id,
                        leadModel: 'Lead',
                        name: primary.name || l.name
                    });
                }
            });
        }
    }
    
    const uniqueMap = new Map();
    recipients.forEach(r => {
        if (r.email && r.email.includes('@')) {
            uniqueMap.set(r.email, r);
        }
    });
    return Array.from(uniqueMap.values());
};

// ── SEGMENTS CRUD ───────────────────────────────────────────────────────────

export const getSegments = async (req, res, next) => {
    try {
        const segments = await EmailSegment.find().populate('filters.campaignId').sort({ createdAt: -1 });
        res.json(segments);
    } catch (err) { next(err); }
};

export const createSegment = async (req, res, next) => {
    try {
        const { name, description, type, filters, contacts } = req.body;
        
        // Deduplicate contacts by email
        let uniqueContacts = [];
        if (contacts && Array.isArray(contacts)) {
            const seenEmails = new Set();
            for (const c of contacts) {
                if (!c.email) continue;
                const normalized = c.email.toLowerCase().trim();
                if (!seenEmails.has(normalized)) {
                    seenEmails.add(normalized);
                    uniqueContacts.push({ ...c, email: normalized });
                }
            }
        }

        const segment = await EmailSegment.create({
            name,
            description,
            type,
            filters,
            contacts: uniqueContacts
        });
        res.status(201).json(segment);
    } catch (err) { next(err); }
};

export const deleteSegment = async (req, res, next) => {
    try {
        await EmailSegment.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Segment deleted successfully' });
    } catch (err) { next(err); }
};

export const importSegmentCsv = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No CSV file uploaded' });
        }

        const csvContent = req.file.buffer.toString('utf-8');
        const rows = csvContent.split(/\r?\n/).map(row => row.split(','));
        if (rows.length <= 1) {
            return res.status(400).json({ error: 'CSV file is empty or missing data rows' });
        }

        const headers = rows[0].map(h => h.trim().toLowerCase());
        const emailIndex = headers.indexOf('email');
        const nameIndex = headers.indexOf('name') !== -1 ? headers.indexOf('name') : headers.indexOf('first name');

        if (emailIndex === -1) {
            return res.status(400).json({ error: 'CSV must contain an "email" header column' });
        }

        const contacts = [];
        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i];
            if (cols.length <= emailIndex) continue;
            
            const email = cols[emailIndex]?.trim().toLowerCase();
            if (!email || !email.includes('@')) continue;

            const name = nameIndex !== -1 ? cols[nameIndex]?.trim() : email.split('@')[0];
            contacts.push({
                name,
                email,
                status: 'active'
            });
        }

        // Create Segment
        const segment = await EmailSegment.create({
            name: req.body.name || `CSV Import - ${req.file.originalname}`,
            description: `Imported via CSV upload containing ${contacts.length} contacts.`,
            type: 'static',
            contacts
        });

        res.status(201).json({ 
            success: true, 
            message: `Successfully imported ${contacts.length} contacts into segment.`,
            segment 
        });
    } catch (err) { next(err); }
};

export const previewCampaignRecipients = async (req, res, next) => {
    try {
        const { campaignId } = req.params;
        const recipients = await resolveSegmentRecipients({
            type: 'campaign',
            filters: { campaignId }
        });
        res.json(recipients);
    } catch (err) {
        next(err);
    }
};
