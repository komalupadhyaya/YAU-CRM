import fs from 'fs';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { MediaAsset } from '../models/mediaAsset.model.js';

// Pre-configure Cloudinary once at module level to eliminate runtime dynamic import overhead
const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
const isCloudinaryConfigured = Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET);
if (isCloudinaryConfigured) {
    cloudinary.config({
        cloud_name: CLOUDINARY_CLOUD_NAME,
        api_key: CLOUDINARY_API_KEY,
        api_secret: CLOUDINARY_API_SECRET
    });
}

// POST /api/media-assets/upload
export const uploadMediaAsset = async (req, res, next) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ success: false, error: 'No image file provided' });
        }

        const cleanName = (req.body.name && req.body.name.trim()) || '';

        // Priority 1: Cloudinary Upload (Direct stream upload without dynamic import lag)
        if (isCloudinaryConfigured) {
            try {

                const uploadResult = await new Promise((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        {
                            folder: 'yau-crm/email-templates',
                            resource_type: 'auto',
                            unique_filename: true
                        },
                        (error, result) => {
                            if (error) return reject(error);
                            resolve(result);
                        }
                    );
                    uploadStream.end(file.buffer);
                });

                // Persist asset metadata into MongoDB 'media_assets' collection
                const asset = await MediaAsset.create({
                    name: cleanName || file.originalname?.replace(/\.[^/.]+$/, '').trim() || 'Uploaded Graphic',
                    originalName: file.originalname || 'image.png',
                    url: uploadResult.secure_url,
                    publicId: uploadResult.public_id || null,
                    width: uploadResult.width || 0,
                    height: uploadResult.height || 0,
                    format: uploadResult.format || 'png',
                    size: file.size || 0,
                    storage: 'cloudinary',
                    createdBy: req.user?.id || req.user?._id || null
                });

                return res.json({
                    success: true,
                    asset,
                    url: uploadResult.secure_url,
                    width: uploadResult.width,
                    height: uploadResult.height,
                    format: uploadResult.format,
                    storage: 'cloudinary'
                });
            } catch (cloudErr) {
                console.error('Cloudinary upload failed, falling back to local storage:', cloudErr.message);
            }
        }

        // Priority 2: Fallback to local storage
        const uploadDir = path.join(process.cwd(), 'uploads', 'email-templates');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const sanitizedName = file.originalname ? file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_') : 'image.png';
        const filename = `${Date.now()}-${sanitizedName}`;
        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, file.buffer);

        const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
        const localUrl = `${backendUrl}/uploads/email-templates/${filename}`;

        const asset = await MediaAsset.create({
            name: cleanName || file.originalname?.replace(/\.[^/.]+$/, '').trim() || 'Uploaded Graphic',
            originalName: file.originalname || 'image.png',
            url: localUrl,
            publicId: null,
            width: 0,
            height: 0,
            format: path.extname(sanitizedName).replace('.', '') || 'png',
            size: file.size || 0,
            storage: 'local',
            createdBy: req.user?.id || req.user?._id || null
        });

        return res.json({
            success: true,
            asset,
            url: localUrl,
            storage: 'local'
        });
    } catch (err) {
        next(err);
    }
};

// GET /api/media-assets
export const getMediaAssets = async (req, res, next) => {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized: User session required' });
        }

        const { search, category, limit = 60, page = 1 } = req.query;
        // Strictly isolate media assets to the logged-in admin
        const query = { createdBy: userId };

        if (search && search.trim()) {
            const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedSearch, 'i');
            query.$or = [{ name: regex }, { originalName: regex }];
        }

        if (category && category !== 'all') {
            query.category = category;
        }

        const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

        // High-Performance Parallel Execution: find and count run concurrently in MongoDB!
        const [assets, total] = await Promise.all([
            MediaAsset.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit, 10))
                .lean(),
            MediaAsset.countDocuments(query)
        ]);

        res.json({
            success: true,
            assets,
            total,
            page: parseInt(page, 10),
            pages: Math.ceil(total / parseInt(limit, 10))
        });
    } catch (err) {
        next(err);
    }
};

// PATCH /api/media-assets/:id
export const renameMediaAsset = async (req, res, next) => {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized: User session required' });
        }

        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, error: 'Asset name cannot be empty' });
        }

        // Only the admin who uploaded the asset can rename it (using lean() for fast JSON response)
        const asset = await MediaAsset.findOneAndUpdate(
            { _id: req.params.id, createdBy: userId },
            { name: name.trim() },
            { new: true }
        ).lean();
        if (!asset) {
            return res.status(404).json({ success: false, error: 'Asset not found or unauthorized' });
        }
        res.json({
            success: true,
            asset,
            message: 'Asset renamed successfully'
        });
    } catch (err) {
        next(err);
    }
};

// DELETE /api/media-assets/:id
export const deleteMediaAsset = async (req, res, next) => {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized: User session required' });
        }

        // Only the admin who uploaded the asset can delete it
        const asset = await MediaAsset.findOne({ _id: req.params.id, createdBy: userId });
        if (!asset) {
            return res.status(404).json({ success: false, error: 'Asset not found or unauthorized' });
        }

        let cloudinaryDeleted = false;

        // Cleanup storage task (Cloudinary / local file)
        const cleanupStorageTask = (async () => {
            const isCloudinary = asset.storage === 'cloudinary' || (asset.url && asset.url.includes('cloudinary.com'));
            if (isCloudinary && isCloudinaryConfigured) {
                try {
                    let targetPublicId = asset.publicId;

                    if (!targetPublicId && asset.url && asset.url.includes('cloudinary.com')) {
                        const match = asset.url.match(/\/upload\/(?:v\d+\/)?([^\.]+)/);
                        if (match && match[1]) {
                            targetPublicId = match[1];
                        }
                    }

                    if (targetPublicId) {
                        const destroyRes = await cloudinary.uploader.destroy(targetPublicId, {
                            resource_type: 'image',
                            invalidate: true
                        });
                        cloudinaryDeleted = destroyRes?.result === 'ok';
                    }
                } catch (cloudErr) {
                    console.error('Failed to delete asset from Cloudinary:', cloudErr.message);
                }
            }

            // Delete from local filesystem if stored locally
            if (asset.storage === 'local' && asset.url) {
                try {
                    const filename = path.basename(asset.url);
                    const localFilePath = path.join(process.cwd(), 'uploads', 'email-templates', filename);
                    if (fs.existsSync(localFilePath)) {
                        fs.unlinkSync(localFilePath);
                    }
                } catch (fsErr) {
                    console.error('Failed to delete local asset file:', fsErr.message);
                }
            }
        })();

        // High-Performance Parallel Execution: delete record from DB and cleanup external files simultaneously!
        await Promise.all([
            cleanupStorageTask,
            MediaAsset.findByIdAndDelete(req.params.id)
        ]);

        res.json({
            success: true,
            message: 'Asset permanently deleted from database and Cloudinary storage',
            cloudinaryDeleted
        });
    } catch (err) {
        next(err);
    }
};

// POST /api/media-assets/web
// Save web image directly to MongoDB database without uploading to Cloudinary
export const createWebMediaAsset = async (req, res, next) => {
    try {
        const { url, name } = req.body;
        if (!url || !url.trim()) {
            return res.status(400).json({ success: false, error: 'Web image URL is required' });
        }

        const trimmedUrl = url.trim();

        // Extract a clean fallback name from URL basename if name was not provided
        let defaultName = 'Web Image';
        try {
            const parsed = new URL(trimmedUrl);
            const pathname = parsed.pathname;
            const basename = path.basename(pathname).replace(/\.[^/.]+$/, '').trim();
            if (basename) {
                defaultName = decodeURIComponent(basename);
            }
        } catch {
            // URL parse fallback
        }

        const cleanName = (name && name.trim()) || defaultName;

        // Persist directly into MongoDB 'media_assets' collection with storage: 'web'
        const asset = await MediaAsset.create({
            name: cleanName,
            originalName: cleanName,
            url: trimmedUrl,
            publicId: null,
            width: 0,
            height: 0,
            format: '',
            size: 0,
            storage: 'web',
            createdBy: req.user?.id || req.user?._id || null
        });

        res.json({
            success: true,
            asset,
            url: trimmedUrl,
            message: 'Web image saved to library successfully'
        });
    } catch (err) {
        next(err);
    }
};

