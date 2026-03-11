/**
 * CedarwoodOS Media Knowledge Engine - REST API Routes
 *
 * Endpoints for uploading, searching, and retrieving media assets.
 * Follows the receipts-simple.ts pattern: multer + authenticate + rate limit.
 */

import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth';
import { adminOrOperator } from '../middleware/roleGuard';
import { mediaAssetService } from '../services/mediaAssetService';
import { mediaSearchService } from '../services/mediaSearchService';
import { logger } from '../utils/logger';

const router = express.Router();

// ─── Multer Config ───────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB per file
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
      'application/pdf',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Use JPEG, PNG, WebP, HEIC, or PDF.'));
    }
  },
});

// ─── Rate Limiter ────────────────────────────────────────────────────────────

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many uploads. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── POST /upload — Upload media file(s) ─────────────────────────────────────

router.post(
  '/upload',
  authenticate,
  adminOrOperator,
  uploadLimiter,
  upload.array('files', 5),
  async (req: any, res) => {
    try {
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files provided' });
      }

      const userDescription = req.body.description || req.body.userDescription || null;
      const location = req.body.location || null;
      const user = req.user;

      const results = [];

      for (const file of files) {
        const asset = await mediaAssetService.createMediaAsset(file.buffer, {
          userDescription,
          fileName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          userId: user.id,
          userName: user.name || user.email || 'Unknown',
          location,
        });
        results.push(asset);
      }

      logger.info(`[MediaAPI] ${results.length} file(s) uploaded by ${user.email}`);

      res.json({
        success: true,
        message: `${results.length} file(s) uploaded successfully. AI analysis in progress...`,
        assets: results,
      });
    } catch (error: any) {
      logger.error('[MediaAPI] Upload failed:', error);
      res.status(500).json({ error: 'Upload failed', message: error.message });
    }
  }
);

// ─── GET /search — Search media assets ───────────────────────────────────────

router.get('/search', authenticate, async (req: any, res) => {
  try {
    const query = (req.query.q as string) || '';
    const location = req.query.location as string | undefined;
    const limit = parseInt(req.query.limit as string, 10) || 10;

    if (!query.trim()) {
      return res.status(400).json({ error: 'Search query (q) is required' });
    }

    const results = await mediaSearchService.searchMedia(query, { location, limit });

    res.json({
      success: true,
      query,
      count: results.length,
      results,
    });
  } catch (error: any) {
    logger.error('[MediaAPI] Search failed:', error);
    res.status(500).json({ error: 'Search failed', message: error.message });
  }
});

// ─── GET /gallery — Paginated browse ─────────────────────────────────────────

router.get('/gallery', authenticate, async (req: any, res) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const offset = parseInt(req.query.offset as string, 10) || 0;
    const location = req.query.location as string | undefined;
    const category = req.query.category as string | undefined;

    const { assets, total } = await mediaAssetService.getGallery({
      limit,
      offset,
      location,
      category,
    });

    res.json({
      success: true,
      total,
      limit,
      offset,
      assets,
    });
  } catch (error: any) {
    logger.error('[MediaAPI] Gallery failed:', error);
    res.status(500).json({ error: 'Gallery failed', message: error.message });
  }
});

// ─── GET /:id — Asset metadata ───────────────────────────────────────────────

router.get('/:id', authenticate, async (req: any, res) => {
  try {
    const asset = await mediaAssetService.getById(req.params.id);

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    res.json({ success: true, asset });
  } catch (error: any) {
    logger.error('[MediaAPI] Get asset failed:', error);
    res.status(500).json({ error: 'Failed to get asset', message: error.message });
  }
});

// ─── GET /:id/file — Full-resolution file data ──────────────────────────────

router.get('/:id/file', authenticate, async (req: any, res) => {
  try {
    const fileData = await mediaAssetService.getFileData(req.params.id);

    if (!fileData) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({ success: true, fileData });
  } catch (error: any) {
    logger.error('[MediaAPI] Get file failed:', error);
    res.status(500).json({ error: 'Failed to get file', message: error.message });
  }
});

// ─── Error handler for multer ────────────────────────────────────────────────

router.use((err: any, _req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum 15MB per file.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Maximum 5 per upload.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err.message?.includes('File type not allowed')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

export default router;
