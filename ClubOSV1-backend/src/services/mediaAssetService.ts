/**
 * CedarwoodOS Media Knowledge Engine - Asset Service
 *
 * Handles CRUD operations for media assets: create (with EXIF stripping +
 * thumbnail generation), read, gallery, and file retrieval.
 */

import sharp from 'sharp';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { addMediaJob } from './mediaQueue';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CreateMediaInput {
  userDescription?: string | null;
  fileName: string;
  mimeType: string;
  fileSize: number;
  userId: string | null;
  userName: string;
  location?: string | null;
}

export interface MediaAsset {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  user_description: string | null;
  ai_description: string | null;
  content_summary: string | null;
  category: string | null;
  tags: string[] | null;
  ai_tags: string[] | null;
  processing_status: string;
  processing_error: string | null;
  uploader_user_id: string;
  uploader_name: string;
  location: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaAssetSummary {
  id: string;
  thumbnail_data: string | null;
  file_name: string;
  mime_type: string;
  user_description: string | null;
  ai_description: string | null;
  category: string | null;
  location: string | null;
  uploader_name: string;
  created_at: string;
  processing_status: string;
}

export interface GalleryOptions {
  limit?: number;
  offset?: number;
  location?: string;
  category?: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

class MediaAssetService {
  /**
   * Create a new media asset: strip EXIF, generate thumbnail, store, enqueue AI processing.
   * Returns immediately with asset ID + thumbnail (AI processing happens async).
   */
  async createMediaAsset(
    fileBuffer: Buffer,
    metadata: CreateMediaInput
  ): Promise<{ id: string; thumbnailData: string | null }> {
    try {
      let processedBuffer = fileBuffer;
      let thumbnailData: string | null = null;

      const isImage = metadata.mimeType.startsWith('image/');

      if (isImage) {
        // Strip EXIF metadata (especially GPS for privacy) and normalize to JPEG
        try {
          processedBuffer = await sharp(fileBuffer)
            .rotate() // Auto-rotate based on EXIF orientation before stripping
            .jpeg({ quality: 85 })
            .toBuffer();
        } catch (sharpError) {
          // If sharp fails (e.g., unsupported format), use original buffer
          logger.warn(`[MediaAsset] Sharp processing failed for ${metadata.fileName}, using original:`, sharpError);
          processedBuffer = fileBuffer;
        }

        // Generate thumbnail (300px max dimension)
        try {
          const thumbBuffer = await sharp(fileBuffer)
            .rotate()
            .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 70 })
            .toBuffer();
          thumbnailData = `data:image/jpeg;base64,${thumbBuffer.toString('base64')}`;
        } catch (thumbError) {
          logger.warn(`[MediaAsset] Thumbnail generation failed for ${metadata.fileName}:`, thumbError);
        }
      }

      // Convert to base64 for storage (Phase 1 - will migrate to S3/R2 later)
      const fileDataBase64 = isImage
        ? `data:image/jpeg;base64,${processedBuffer.toString('base64')}`
        : `data:${metadata.mimeType};base64,${fileBuffer.toString('base64')}`;

      // Insert into database
      const result = await db.query(
        `INSERT INTO media_assets (
          file_data, thumbnail_data, file_name, file_size, mime_type,
          user_description, uploader_user_id, uploader_name, location,
          processing_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
        RETURNING id`,
        [
          fileDataBase64,
          thumbnailData,
          metadata.fileName,
          metadata.fileSize,
          isImage ? 'image/jpeg' : metadata.mimeType,
          metadata.userDescription || null,
          metadata.userId,
          metadata.userName,
          metadata.location || null,
        ]
      );

      const assetId = result.rows[0].id;
      logger.info(`[MediaAsset] Created asset ${assetId} (${metadata.fileName}, ${metadata.fileSize} bytes)`);

      // Enqueue async AI processing (Vision + embedding)
      await addMediaJob(assetId);

      return { id: assetId, thumbnailData };
    } catch (error) {
      logger.error('[MediaAsset] Failed to create asset:', error);
      throw error;
    }
  }

  /**
   * Get asset metadata (no file_data for speed)
   */
  async getById(id: string): Promise<MediaAsset | null> {
    try {
      const result = await db.query(
        `SELECT id, file_name, file_size, mime_type,
                user_description, ai_description, content_summary,
                category, tags, ai_tags,
                processing_status, processing_error,
                uploader_user_id, uploader_name, location,
                created_at, updated_at
         FROM media_assets WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`[MediaAsset] Failed to get asset ${id}:`, error);
      return null;
    }
  }

  /**
   * Get full-resolution file data (base64)
   */
  async getFileData(id: string): Promise<string | null> {
    try {
      const result = await db.query(
        'SELECT file_data, mime_type FROM media_assets WHERE id = $1',
        [id]
      );
      return result.rows[0]?.file_data || null;
    } catch (error) {
      logger.error(`[MediaAsset] Failed to get file data for ${id}:`, error);
      return null;
    }
  }

  /**
   * Get thumbnail data (base64)
   */
  async getThumbnailData(id: string): Promise<string | null> {
    try {
      const result = await db.query(
        'SELECT thumbnail_data FROM media_assets WHERE id = $1',
        [id]
      );
      return result.rows[0]?.thumbnail_data || null;
    } catch (error) {
      logger.error(`[MediaAsset] Failed to get thumbnail for ${id}:`, error);
      return null;
    }
  }

  /**
   * Paginated gallery of assets (thumbnails only, no full file_data)
   */
  async getGallery(options: GalleryOptions = {}): Promise<{ assets: MediaAssetSummary[]; total: number }> {
    const { limit = 20, offset = 0, location, category } = options;

    try {
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (location) {
        conditions.push(`location = $${paramIndex++}`);
        params.push(location);
      }
      if (category) {
        conditions.push(`category = $${paramIndex++}`);
        params.push(category);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await db.query(
        `SELECT COUNT(*) as total FROM media_assets ${whereClause}`,
        params
      );

      const result = await db.query(
        `SELECT id, thumbnail_data, file_name, mime_type,
                user_description, ai_description, category,
                location, uploader_name, created_at, processing_status
         FROM media_assets
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...params, limit, offset]
      );

      return {
        assets: result.rows,
        total: parseInt(countResult.rows[0].total, 10),
      };
    } catch (error) {
      logger.error('[MediaAsset] Failed to get gallery:', error);
      return { assets: [], total: 0 };
    }
  }
}

export const mediaAssetService = new MediaAssetService();
