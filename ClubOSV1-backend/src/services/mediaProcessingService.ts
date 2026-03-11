/**
 * CedarwoodOS Media Knowledge Engine - AI Processing Service
 *
 * Runs inside BullMQ worker (or in-process fallback). For each media asset:
 * 1. GPT-4 Vision analyzes the image → description, tags, category
 * 2. Builds content_summary from user description + AI description
 * 3. Generates 1536-dim embedding via text-embedding-3-small (stored as JSON text)
 * 4. Updates the media_assets row with all AI results
 */

import OpenAI from 'openai';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { config } from '../utils/envValidator';

// ─── Types ───────────────────────────────────────────────────────────────────

interface VisionAnalysis {
  description: string;
  tags: string[];
  category: string;
}

// ─── OpenAI Client ───────────────────────────────────────────────────────────

const openai = config.OPENAI_API_KEY
  ? new OpenAI({ apiKey: config.OPENAI_API_KEY })
  : null;

// ─── Service ─────────────────────────────────────────────────────────────────

class MediaProcessingService {
  /**
   * Process a media asset: Vision analysis → embedding generation → DB update.
   * Called by the BullMQ worker or in-process fallback.
   */
  async processAsset(assetId: string): Promise<void> {
    logger.info(`[MediaProcessing] Starting processing for asset ${assetId}`);

    try {
      // Mark as processing
      await db.query(
        `UPDATE media_assets SET processing_status = 'processing' WHERE id = $1`,
        [assetId]
      );

      // Fetch the asset
      const result = await db.query(
        `SELECT id, file_data, user_description, mime_type, file_name
         FROM media_assets WHERE id = $1`,
        [assetId]
      );

      if (result.rows.length === 0) {
        throw new Error(`Asset ${assetId} not found`);
      }

      const asset = result.rows[0];
      const isImage = asset.mime_type.startsWith('image/');

      let aiDescription = '';
      let aiTags: string[] = [];
      let category = 'other';

      // Step 1: Vision Analysis (images only)
      if (isImage && asset.file_data && openai) {
        const analysis = await this.analyzeImage(asset.file_data);
        aiDescription = analysis.description;
        aiTags = analysis.tags;
        category = analysis.category;
      } else if (asset.mime_type === 'application/pdf') {
        // Phase 1: PDFs get basic metadata only. PDF text extraction is Phase 2.
        aiDescription = `PDF document: ${asset.file_name}`;
        aiTags = ['pdf', 'document'];
        category = 'document';
      }

      // Step 2: Build content summary
      const parts: string[] = [];
      if (asset.user_description) parts.push(asset.user_description);
      if (aiDescription) parts.push(aiDescription);
      if (!parts.length) parts.push(asset.file_name || 'Uploaded media');
      const contentSummary = parts.join('. ');

      // Step 3: Generate embedding
      let embeddingStr: string | null = null;
      if (openai) {
        try {
          const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: contentSummary,
          });
          const embedding = embeddingResponse.data[0].embedding;
          embeddingStr = `[${embedding.join(',')}]`;
        } catch (embError) {
          logger.error(`[MediaProcessing] Embedding generation failed for ${assetId}:`, embError);
          // Continue without embedding — asset is still searchable via full-text
        }
      } else {
        logger.warn(`[MediaProcessing] OpenAI not configured, skipping embedding for ${assetId}`);
      }

      // Step 4: Update asset with AI results
      // Note: embedding stored as JSON text (embedding_json) — will migrate to pgvector VECTOR(1536) later
      await db.query(
        `UPDATE media_assets SET
          ai_description = $1,
          ai_tags = $2,
          category = $3,
          content_summary = $4,
          embedding_json = $5,
          processing_status = 'completed',
          processing_error = NULL
        WHERE id = $6`,
        [
          aiDescription || null,
          aiTags.length > 0 ? aiTags : null,
          category,
          contentSummary,
          embeddingStr,
          assetId,
        ]
      );

      logger.info(`[MediaProcessing] Completed asset ${assetId}: "${contentSummary.substring(0, 80)}..."`);
    } catch (error: any) {
      logger.error(`[MediaProcessing] Failed to process asset ${assetId}:`, error);

      // Mark as failed
      try {
        await db.query(
          `UPDATE media_assets SET
            processing_status = 'failed',
            processing_error = $1
          WHERE id = $2`,
          [error.message || 'Unknown error', assetId]
        );
      } catch (updateError) {
        logger.error(`[MediaProcessing] Failed to update error status for ${assetId}:`, updateError);
      }

      throw error; // Re-throw so BullMQ retries
    }
  }

  /**
   * Analyze an image using GPT-4 Vision.
   * Follows the exact pattern from receiptOCR.ts.
   */
  private async analyzeImage(base64DataUrl: string): Promise<VisionAnalysis> {
    try {
      // Ensure the data URL has the correct prefix
      let imageUrl = base64DataUrl;
      if (!imageUrl.startsWith('data:')) {
        imageUrl = `data:image/jpeg;base64,${imageUrl}`;
      }

      if (!openai) throw new Error('OpenAI not configured');
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are analyzing a photo for a facility management knowledge base.
Describe what you see in detail: objects, conditions, text visible, equipment, work progress, locations, materials, people count (not identities).

Return valid JSON only, no markdown:
{
  "description": "detailed description of what you see",
  "tags": ["tag1", "tag2", "tag3"],
  "category": "maintenance|equipment|facility|job|document|incident|other"
}

Be specific. Include any visible text, brand names, model numbers, addresses, or signs.
If you see work in progress, note the state (completed, in-progress, damaged, etc.).`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: imageUrl, detail: 'high' },
              },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content || '{}';

      // Parse JSON — handle cases where GPT wraps in markdown code blocks
      let cleaned = content.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(cleaned);

      return {
        description: parsed.description || 'Image analyzed',
        tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 10) : [],
        category: parsed.category || 'other',
      };
    } catch (error) {
      logger.error('[MediaProcessing] Vision analysis failed:', error);
      return {
        description: 'Image could not be analyzed',
        tags: [],
        category: 'other',
      };
    }
  }
}

export const mediaProcessingService = new MediaProcessingService();
