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
        const hasConsent = isConsent === undefined ? true : (isConsent === true || isConsent === 'true' || isConsent === 'on' || isConsent === 1 || isConsent === '1');

        // Duplicate check: Look for a lead with matching email OR phone (using exact string or last 10 digits regex)
        const digitsPhone = cleanPhone.replace(/\D/g, '');
        const last10Phone = digitsPhone.slice(-10);

        let duplicateLead = await EALead.findOne({
            $or: [
                { email: cleanEmail },
                { phone: cleanPhone },
                ...(last10Phone.length >= 7 ? [{ phone: { $regex: last10Phone + '$' } }] : [])
            ]
        });

        if (duplicateLead) {
            console.log(`Duplicate EA Lead found for email "${cleanEmail}" or phone "${cleanPhone}". Returning conflict.`);
            duplicateLead.submissionCount += 1;
            duplicateLead.dateSubmitted = new Date();
            await duplicateLead.save();

            const welcomeMessage = "Welcome back! It looks like you've already completed this form. Click below to continue to the next step .";

            const acceptsJson = req.headers.accept && req.headers.accept.includes('application/json');
            const isJsonRequest = req.headers['content-type'] && req.headers['content-type'].includes('application/json');

            if (acceptsJson || isJsonRequest) {
                return res.status(409).json({
                    success: false,
                    message: welcomeMessage,
                    lead_id: duplicateLead._id,
                    alreadySubmitted: true
                });
            } else {
                return res.status(409).send(welcomeMessage);
            }
        }

        // If no duplicate is found, create a new lead
        console.log(`Creating new EA Lead for email "${cleanEmail}"...`);
        let lead = await EALead.create({
            name: name.trim(),
            email: cleanEmail,
            phone: cleanPhone,
            source: source ? source.trim() : 'YAU Website',
            isConsent: hasConsent,
            dateSubmitted: new Date(),
            submissionCount: 1
        });

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
