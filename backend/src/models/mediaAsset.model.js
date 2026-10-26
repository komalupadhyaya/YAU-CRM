import mongoose from 'mongoose';

const MediaAssetSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    originalName: { type: String, default: '' },
    url: { type: String, required: true },
    publicId: { type: String, default: null },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    format: { type: String, default: '' },
    size: { type: Number, default: 0 }, // in bytes
    storage: { type: String, enum: ['cloudinary', 'local', 'web'], default: 'cloudinary' },
    category: { type: String, default: 'General' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

// Index for fast text search and chronological sorting
MediaAssetSchema.index({ name: 'text', originalName: 'text' });
MediaAssetSchema.index({ createdAt: -1 });
MediaAssetSchema.index({ createdBy: 1, createdAt: -1 });

export const MediaAsset = mongoose.model('MediaAsset', MediaAssetSchema, 'media_assets');
export default MediaAsset;
