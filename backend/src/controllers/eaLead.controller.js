import EALead from '../models/eaLead.model.js';
import { syncToConstantContact } from '../services/constantContact.service.js';

/**
 * Handle form submissions (Public Endpoint)
 * POST /api/ea-leads/submit
 */
export const submitEALead = async (req, res) => {
    try {
        console.log('--- EA LEAD FORM SUBMISSION RECEIVED ---', req.body);
        const { name, email, phone, source, isConsent } = req.body;

        // Basic validation
        if (!name || !email || !phone) {
            return res.status(400).json({ 
                success: false, 
                message: 'Name, email, and phone number are required fields.' 
            });
        }

        const cleanEmail = email.trim().toLowerCase();
        const cleanPhone = phone.trim();
        const hasConsent = isConsent === true || isConsent === 'true' || isConsent === 'on' || isConsent === 1 || isConsent === '1';

        // 1. Exact Duplicate Handling Strategy: Search by both email AND phone
        let exactDuplicate = await EALead.findOne({
            email: cleanEmail,
            phone: cleanPhone
        });

        if (exactDuplicate) {
            console.log(`Exact duplicate EA Lead found for email "${cleanEmail}" and phone "${cleanPhone}". Returning welcome back message.`);
            exactDuplicate.submissionCount += 1;
            exactDuplicate.dateSubmitted = new Date();
            await exactDuplicate.save();

            const welcomeMessage = "Welcome back! It looks like you've already completed this form. Click below to continue to the next step .";

            const acceptsJson = req.headers.accept && req.headers.accept.includes('application/json');
            const isJsonRequest = req.headers['content-type'] && req.headers['content-type'].includes('application/json');

            if (acceptsJson || isJsonRequest) {
                return res.status(409).json({
                    success: false,
                    message: welcomeMessage,
                    lead_id: exactDuplicate._id,
                    alreadySubmitted: true
                });
            } else {
                return res.status(409).send(`
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); text-align: center;">
                        <p style="font-size: 16px; color: #1a202c; line-height: 1.5; margin: 0;">Welcome back! It looks like you've already completed this form. Click below to continue to the next step .</p>
                    </div>
                `);
            }
        }

        // 2. Partial Duplicate Handling Strategy: Search by email or phone (but not both, as that is handled above)
        let lead = await EALead.findOne({
            $or: [
                { email: cleanEmail },
                { phone: cleanPhone }
            ]
        });

        if (lead) {
            console.log(`Duplicate EA Lead found for email "${cleanEmail}" or phone "${cleanPhone}". Updating existing record...`);
            lead.name = name.trim();
            lead.email = cleanEmail;
            lead.phone = cleanPhone;
            if (source) lead.source = source.trim();
            lead.isConsent = hasConsent;
            lead.dateSubmitted = new Date();
            lead.submissionCount += 1;
            await lead.save();
        } else {
            console.log(`Creating new EA Lead for email "${cleanEmail}"...`);
            lead = await EALead.create({
                name: name.trim(),
                email: cleanEmail,
                phone: cleanPhone,
                source: source ? source.trim() : 'YAU Website',
                isConsent: hasConsent,
                dateSubmitted: new Date(),
                submissionCount: 1
            });
        }

        // Fire-and-forget background sync to Constant Contact (handles its own errors)
        syncToConstantContact(lead);

        // Determine redirect vs JSON response
        const acceptsJson = req.headers.accept && req.headers.accept.includes('application/json');
        const isJsonRequest = req.headers['content-type'] && req.headers['content-type'].includes('application/json');

        const redirectUrl = 'https://youthathleteuniversity.org/love/';

        if (acceptsJson || isJsonRequest) {
            return res.status(200).json({
                success: true,
                message: 'Lead captured successfully',
                redirectUrl,
                lead_id: lead._id
            });
        } else {
            // Browser native form submit redirect
            return res.redirect(302, redirectUrl);
        }

    } catch (error) {
        console.error('EA Lead Submission Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error processing lead submission',
            error: error.message
        });
    }
};

/**
 * Fetch all EA leads (Protected)
 * GET /api/ea-leads
 */
export const getEALeads = async (req, res) => {
    try {
        const leads = await EALead.find().sort({ dateSubmitted: -1 });
        return res.status(200).json(leads);
    } catch (error) {
        console.error('Error fetching EA leads:', error);
        return res.status(500).json({ error: 'Failed to fetch EA leads' });
    }
};

/**
 * Fetch a single EA lead by ID (Protected)
 * GET /api/ea-leads/:id
 */
export const getEALeadById = async (req, res) => {
    try {
        const lead = await EALead.findById(req.params.id);
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }
        return res.status(200).json(lead);
    } catch (error) {
        console.error('Error fetching EA lead:', error);
        return res.status(500).json({ error: 'Failed to fetch lead details' });
    }
};

/**
 * Update an EA lead by ID (Protected)
 * PUT /api/ea-leads/:id
 */
export const updateEALead = async (req, res) => {
    try {
        const { name, email, phone, source, dateSubmitted, isConsent } = req.body;
        
        const lead = await EALead.findById(req.params.id);
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        if (name) lead.name = name.trim();
        if (email) lead.email = email.trim().toLowerCase();
        if (phone) lead.phone = phone.trim();
        if (source) lead.source = source.trim();
        if (dateSubmitted) lead.dateSubmitted = new Date(dateSubmitted);
        if (isConsent !== undefined) lead.isConsent = !!isConsent;

        await lead.save();
        console.log(`EA Lead "${lead.name}" (ID: ${lead._id}) updated successfully.`);

        return res.status(200).json(lead);
    } catch (error) {
        console.error('Error updating EA lead:', error);
        return res.status(500).json({ error: 'Failed to update lead details' });
    }
};

/**
 * Delete an EA lead by ID (Protected)
 * DELETE /api/ea-leads/:id
 */
export const deleteEALead = async (req, res) => {
    try {
        const lead = await EALead.findByIdAndDelete(req.params.id);
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }
        console.log(`EA Lead "${lead.name}" (ID: ${lead._id}) deleted successfully.`);
        return res.status(200).json({ message: 'Lead deleted successfully' });
    } catch (error) {
        console.error('Error deleting EA lead:', error);
        return res.status(500).json({ error: 'Failed to delete lead' });
    }
};
