-- Check AI Settings
SELECT key, value 
FROM ai_settings 
ORDER BY key;

-- Check recent knowledge with embedding status
SELECT 
  id,
  category,
  LEFT(content, 100) as content_preview,
  CASE 
    WHEN embedding IS NULL THEN '❌ NO EMBEDDING'
    ELSE '✅ HAS EMBEDDING'
  END as embedding_status,
  created_at
FROM knowledge_base
ORDER BY created_at DESC
LIMIT 10;
