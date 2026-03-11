-- CedarwoodOS Media Knowledge Engine - Phase 1
-- Adds media_assets table for intelligent photo/PDF recall
-- Uses full-text search + ILIKE. Embedding stored as JSON text for future pgvector migration.

CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- File storage (base64 for Phase 1, migrate to S3/R2 later)
  file_data TEXT,
  thumbnail_data TEXT,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT NOT NULL,

  -- Descriptions
  user_description TEXT,
  ai_description TEXT,
  content_summary TEXT,

  -- Embedding stored as JSON array text (migrate to VECTOR(1536) when pgvector is available)
  embedding_json TEXT,

  -- Full-text search
  search_vector TSVECTOR,

  -- Auto-generated metadata
  category TEXT,
  tags TEXT[],
  ai_tags TEXT[],

  -- Processing status
  processing_status TEXT DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  processing_error TEXT,

  -- Ownership
  uploader_user_id UUID REFERENCES users(id),
  uploader_name TEXT,
  location TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Standard performance indexes
CREATE INDEX IF NOT EXISTS idx_media_location ON media_assets(location);
CREATE INDEX IF NOT EXISTS idx_media_created ON media_assets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_status ON media_assets(processing_status);
CREATE INDEX IF NOT EXISTS idx_media_uploader ON media_assets(uploader_user_id);
CREATE INDEX IF NOT EXISTS idx_media_tags ON media_assets USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_media_ai_tags ON media_assets USING gin(ai_tags);
CREATE INDEX IF NOT EXISTS idx_media_search ON media_assets USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_media_category ON media_assets(category);

-- Auto-update search_vector on INSERT or UPDATE
CREATE OR REPLACE FUNCTION update_media_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector = to_tsvector('english',
    COALESCE(NEW.user_description, '') || ' ' ||
    COALESCE(NEW.ai_description, '') || ' ' ||
    COALESCE(NEW.location, '') || ' ' ||
    COALESCE(array_to_string(NEW.tags, ' '), '') || ' ' ||
    COALESCE(array_to_string(NEW.ai_tags, ' '), '') || ' ' ||
    COALESCE(NEW.file_name, '')
  );
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS media_search_vector_update ON media_assets;
CREATE TRIGGER media_search_vector_update
  BEFORE INSERT OR UPDATE ON media_assets
  FOR EACH ROW
  EXECUTE FUNCTION update_media_search_vector();
