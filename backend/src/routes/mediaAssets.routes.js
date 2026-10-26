import express from 'express';
import multer from 'multer';
import {
    uploadMediaAsset,
    getMediaAssets,
    renameMediaAsset,
    deleteMediaAsset,
    createWebMediaAsset
} from '../controllers/mediaAssets.controller.js';
import auth from '../middleware/auth.middleware.js';
import requireRole from '../middleware/role.middleware.js';

const router = express.Router();
const allowedRoles = ['admin'];

// Configure multer for memory storage (max 10MB)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (/^image\/(png|jpe?g|webp|gif|svg\+xml)$/i.test(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only PNG, JPG, JPEG, WEBP, GIF, and SVG images are allowed'));
        }
    }
});

// Wrapper middleware to gracefully handle multer errors
const handleUploadMiddleware = (req, res, next) => {
    upload.single('image')(req, res, (err) => {
        if (err) {
            return res.status(400).json({ success: false, error: err.message || 'File upload error' });
        }
        next();
    });
};

// Primary Media Asset Routes
router.post('/media-assets/upload', auth, requireRole(...allowedRoles), handleUploadMiddleware, uploadMediaAsset);
router.post('/media-assets/web', auth, requireRole(...allowedRoles), createWebMediaAsset);
router.get('/media-assets', auth, requireRole(...allowedRoles), getMediaAssets);
router.patch('/media-assets/:id', auth, requireRole(...allowedRoles), renameMediaAsset);
router.delete('/media-assets/:id', auth, requireRole(...allowedRoles), deleteMediaAsset);

export default router;
