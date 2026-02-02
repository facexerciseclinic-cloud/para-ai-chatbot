-- Fix AI Settings: Lower min_confidence for better matching
UPDATE ai_settings 
SET value = '0.3'
WHERE key = 'min_confidence';

-- Verify the change
SELECT key, value FROM ai_settings WHERE key = 'min_confidence';
