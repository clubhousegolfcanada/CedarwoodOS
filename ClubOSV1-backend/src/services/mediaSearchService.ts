/**
 * CedarwoodOS Media Knowledge Engine - Search Service
 *
 * Three-tier search for media assets:
 * 1. Semantic (embedding cosine similarity — application-level, pgvector pending)
 * 2. Full-text (PostgreSQL tsvector)
 * 3. ILIKE fallback (for proper nouns/addresses)
 *
 * "Never return nothing" — always return partial matches if no strong results.
 */

import OpenAI from 'openai';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { config } from '../utils/envValidator';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MediaSearchResult {
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
  similarity: number;
  isPartialMatch: boolean;
}

export interface SearchOptions {
  location?: string;
  limit?: number;
}

// ─── OpenAI Client ───────────────────────────────────────────────────────────

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

// ─── Service ─────────────────────────────────────────────────────────────────

class MediaSearchService {
  /**
   * Search media assets using 3-tier approach: semantic → full-text → ILIKE.
   * Merges, deduplicates, and always returns something.
   */
  async searchMedia(query: string, options: SearchOptions = {}): Promise<MediaSearchResult[]> {
    const { limit = 10, location } = options;

    if (!query || query.trim().length === 0) {
      return [];
    }

    const allResults: Map<string, MediaSearchResult> = new Map();

    // Tier 1: Semantic search (pgvector)
    try {
      const semanticResults = await this.semanticSearch(query, limit, location);
      for (const r of semanticResults) {
        if (!allResults.has(r.id) || r.similarity > (allResults.get(r.id)?.similarity || 0)) {
          allResults.set(r.id, r);
        }
      }
    } catch (error) {
      logger.error('[MediaSearch] Semantic search failed:', error);
    }

    // Tier 2: Full-text search (tsvector)
    try {
      const ftsResults = await this.fullTextSearch(query, limit, location);
      for (const r of ftsResults) {
        if (!allResults.has(r.id) || r.similarity > (allResults.get(r.id)?.similarity || 0)) {
          allResults.set(r.id, r);
        }
      }
    } catch (error) {
      logger.error('[MediaSearch] Full-text search failed:', error);
    }

    // Tier 3: ILIKE fallback (proper nouns, addresses)
    try {
      const ilikeResults = await this.ilikeFallback(query, limit, location);
      for (const r of ilikeResults) {
        if (!allResults.has(r.id)) {
          allResults.set(r.id, r);
        }
      }
    } catch (error) {
      logger.error('[MediaSearch] ILIKE search failed:', error);
    }

    // Sort by similarity descending
    let results = Array.from(allResults.values())
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    // "Never return nothing" — widen search if no strong results
    if (results.length === 0 || results.every(r => r.similarity < 0.3)) {
      try {
        const partialResults = await this.widenedSearch(query, limit, location);
        for (const r of partialResults) {
          if (!allResults.has(r.id)) {
            r.isPartialMatch = true;
            allResults.set(r.id, r);
          }
        }
        results = Array.from(allResults.values())
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, limit);
      } catch (error) {
        logger.error('[MediaSearch] Widened search failed:', error);
      }
    }

    logger.info(`[MediaSearch] Query "${query.substring(0, 50)}" → ${results.length} results`);
    return results;
  }

  /**
   * Tier 1: Semantic search using embedding cosine similarity.
   * Without pgvector, we fetch candidate embeddings and compute similarity in application code.
   * For large datasets, migrate to pgvector VECTOR(1536) + IVFFlat index.
   */
  private async semanticSearch(
    query: string,
    limit: number,
    location?: string
  ): Promise<MediaSearchResult[]> {
    // Generate query embedding
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Fetch candidates that have embeddings (cap at 200 for app-level similarity)
    const locationFilter = location ? 'AND location = $2' : '';
    const params: any[] = [200];
    if (location) params.push(location);

    const result = await db.query(
      `SELECT id, thumbnail_data, file_name, mime_type,
              user_description, ai_description, category,
              location, uploader_name, created_at,
              embedding_json
       FROM media_assets
       WHERE embedding_json IS NOT NULL
         AND processing_status = 'completed'
         ${locationFilter}
       LIMIT $1`,
      params
    );

    // Compute cosine similarity in application code
    const scored = result.rows
      .map((row: any) => {
        try {
          const storedEmbedding: number[] = JSON.parse(row.embedding_json);
          const similarity = this.cosineSimilarity(queryEmbedding, storedEmbedding);
          return {
            id: row.id,
            thumbnail_data: row.thumbnail_data,
            file_name: row.file_name,
            mime_type: row.mime_type,
            user_description: row.user_description,
            ai_description: row.ai_description,
            category: row.category,
            location: row.location,
            uploader_name: row.uploader_name,
            created_at: row.created_at,
            similarity,
            isPartialMatch: false,
          };
        } catch {
          return null;
        }
      })
      .filter((r: any): r is MediaSearchResult => r !== null && r.similarity > 0.2)
      .sort((a: MediaSearchResult, b: MediaSearchResult) => b.similarity - a.similarity)
      .slice(0, limit);

    return scored;
  }

  /**
   * Cosine similarity between two vectors.
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
  }

  /**
   * Tier 2: Full-text search using PostgreSQL tsvector
   */
  private async fullTextSearch(
    query: string,
    limit: number,
    location?: string
  ): Promise<MediaSearchResult[]> {
    const locationFilter = location ? 'AND location = $3' : '';
    const params: any[] = [query, limit];
    if (location) params.push(location);

    const result = await db.query(
      `SELECT id, thumbnail_data, file_name, mime_type,
              user_description, ai_description, category,
              location, uploader_name, created_at,
              ts_rank(search_vector, plainto_tsquery('english', $1)) as similarity
       FROM media_assets
       WHERE search_vector @@ plainto_tsquery('english', $1)
         AND processing_status = 'completed'
         ${locationFilter}
       ORDER BY similarity DESC
       LIMIT $2`,
      params
    );

    return result.rows.map((row: any) => ({
      ...row,
      similarity: Math.min(parseFloat(row.similarity) || 0, 1), // Normalize ts_rank
      isPartialMatch: false,
    }));
  }

  /**
   * Tier 3: ILIKE fallback for proper nouns, addresses, names
   */
  private async ilikeFallback(
    query: string,
    limit: number,
    location?: string
  ): Promise<MediaSearchResult[]> {
    const likePattern = `%${query}%`;
    const locationFilter = location ? 'AND location = $3' : '';
    const params: any[] = [likePattern, limit];
    if (location) params.push(location);

    const result = await db.query(
      `SELECT id, thumbnail_data, file_name, mime_type,
              user_description, ai_description, category,
              location, uploader_name, created_at,
              0.5 as similarity
       FROM media_assets
       WHERE (user_description ILIKE $1
              OR ai_description ILIKE $1
              OR location ILIKE $1
              OR file_name ILIKE $1
              OR content_summary ILIKE $1)
         AND processing_status = 'completed'
         ${locationFilter}
       LIMIT $2`,
      params
    );

    return result.rows.map((row: any) => ({
      ...row,
      similarity: 0.5,
      isPartialMatch: false,
    }));
  }

  /**
   * Widened search: broader category/location match when primary search returns nothing.
   * Marks results as partial matches so frontend can label them "Related:".
   */
  private async widenedSearch(
    query: string,
    limit: number,
    location?: string
  ): Promise<MediaSearchResult[]> {
    // Try matching by location alone, or just return most recent assets
    const params: any[] = [limit];
    let whereClause = "processing_status = 'completed'";

    if (location) {
      whereClause += ` AND location = $2`;
      params.push(location);
    }

    const result = await db.query(
      `SELECT id, thumbnail_data, file_name, mime_type,
              user_description, ai_description, category,
              location, uploader_name, created_at,
              0.1 as similarity
       FROM media_assets
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $1`,
      params
    );

    return result.rows.map((row: any) => ({
      ...row,
      similarity: 0.1,
      isPartialMatch: true,
    }));
  }
}

export const mediaSearchService = new MediaSearchService();
