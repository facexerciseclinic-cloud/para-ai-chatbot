-- Fix min_confidence directly in database
-- Run this in Supabase SQL Editor

UPDATE ai_settings 
SET value = '0.3'::jsonb
WHERE key = 'min_confidence';

-- Verify
SELECT key, value FROM ai_settings ORDER BY key;
