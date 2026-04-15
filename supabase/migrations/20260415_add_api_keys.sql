-- Migration: Add api_keys column to bot_configs
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

ALTER TABLE bot_configs
ADD COLUMN IF NOT EXISTS api_keys jsonb DEFAULT NULL;

-- Optional: Add a comment for documentation
COMMENT ON COLUMN bot_configs.api_keys IS 'Per-bot API keys (openai, anthropic, google, elevenlabs, elevenLabsVoiceId). Stored as plaintext JSON for now — encrypt in production.';
