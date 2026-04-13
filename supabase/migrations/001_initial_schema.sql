-- ============================================
-- VoiceBot Studio — Database Schema
-- Run this in Supabase SQL Editor or via migration
-- ============================================

-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- Bot Configurations
-- ============================================
CREATE TABLE IF NOT EXISTS bot_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Nuovo Chatbot',
  system_prompt TEXT NOT NULL DEFAULT '',
  personality JSONB NOT NULL DEFAULT '{
    "tone": "professional",
    "responseStyle": "Clear and helpful",
    "detailLevel": "balanced",
    "language": "it-IT"
  }'::jsonb,
  llm_provider TEXT NOT NULL DEFAULT 'openai',
  llm_model TEXT NOT NULL DEFAULT 'gpt-4o',
  stt_provider TEXT NOT NULL DEFAULT 'web-speech',
  tts_provider TEXT NOT NULL DEFAULT 'web-speech',
  temperature FLOAT NOT NULL DEFAULT 0.7,
  max_tokens INTEGER NOT NULL DEFAULT 2048,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Knowledge Base Documents
-- ============================================
CREATE TABLE IF NOT EXISTS kb_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bot_configs(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx', 'doc')),
  file_size BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'processing', 'indexed', 'error')),
  chunk_count INTEGER,
  error_message TEXT,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_documents_bot_id ON kb_documents(bot_id);

-- ============================================
-- Document Chunks with Vector Embeddings
-- ============================================
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES bot_configs(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding vector(1536),
  chunk_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_bot_id ON document_chunks(bot_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);

-- Create HNSW index for fast vector similarity search
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================
-- Vector Search Function (used by the app)
-- ============================================
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(1536),
  match_bot_id UUID,
  match_count INTEGER DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  WHERE dc.bot_id = match_bot_id
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================
-- Storage Bucket (run in Supabase Dashboard > Storage)
-- Or uncomment below if using SQL:
-- ============================================
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('documents', 'documents', false)
-- ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Row Level Security (basic — extend for multi-user)
-- ============================================
ALTER TABLE bot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- Allow all operations via service role (server-side only)
CREATE POLICY "Service role full access" ON bot_configs
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON kb_documents
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON document_chunks
  FOR ALL USING (true) WITH CHECK (true);
