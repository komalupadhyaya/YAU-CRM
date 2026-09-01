import EmailTemplate from '../models/emailTemplate.model.js';
import aiService from '../services/ai/ai.service.js';

// GET /api/templates
export const getTemplates = async (req, res, next) => {
    try {
        const templates = await EmailTemplate.find().sort({ createdAt: -1 }).lean();
        res.json(templates);
    } catch (err) { next(err); }
};

// POST /api/templates
export const createTemplate = async (req, res, next) => {
    try {
        const { name, category, subject, content, isAiGenerated, aiPrompt } = req.body;
        if (!name || !subject || !content) {
            return res.status(400).json({ error: 'name, subject, and content are required' });
        }

        const template = await EmailTemplate.create({
            name,
            category: category || 'Custom',
            subject,
            content,
            isAiGenerated: !!isAiGenerated,
            aiPrompt: aiPrompt || null,
            createdBy: req.user?.id || null
        });

        res.status(201).json(template);
    } catch (err) { next(err); }
};

// PUT /api/templates/:id
export const updateTemplate = async (req, res, next) => {
    try {
        const { name, category, subject, content } = req.body;
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (category !== undefined) updateData.category = category;
        if (subject !== undefined) updateData.subject = subject;
        if (content !== undefined) updateData.content = content;

        const template = await EmailTemplate.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );

        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        res.json(template);
    } catch (err) { next(err); }
};

// DELETE /api/templates/:id
export const deleteTemplate = async (req, res, next) => {
    try {
        const template = await EmailTemplate.findByIdAndDelete(req.params.id);
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }
        res.json({ success: true, message: 'Template deleted successfully' });
    } catch (err) { next(err); }
};

// POST /api/templates/ai-generate (Anthropic AI Preview Generation)
export const generateAiTemplate = async (req, res, next) => {
    try {
        const { prompt, category, existingContent } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'prompt is required' });
        }

        const generated = await aiService.generateEmailTemplate({ prompt, category, existingContent });

        // Return draft layout for preview ONLY without saving to MongoDB automatically
        res.json({
            name: generated.name,
            category: generated.category || category || 'AI Generated',
            subject: generated.subject,
            content: generated.content,
            isAiGenerated: true,
            aiPrompt: prompt,
            provider: 'anthropic',
            apiHit: true
        });
    } catch (err) {
        console.error('Anthropic AI Template Generation Error:', err);
        res.status(500).json({ error: err.message || 'Failed to generate template with AI' });
    }
};
