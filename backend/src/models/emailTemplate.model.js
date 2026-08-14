import mongoose from 'mongoose';

const EmailTemplateSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: String, default: 'General' },
    subject: { type: String, required: true },
    content: { type: String, required: true }, // HTML rich body content with placeholders like {{name}}
    isAiGenerated: { type: Boolean, default: false },
    aiPrompt: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

export const EmailTemplate = mongoose.model('EmailTemplate', EmailTemplateSchema, 'email_templates');
export default EmailTemplate;
