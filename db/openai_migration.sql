-- Migration: Gemini (768) → OpenAI (1536) Embeddings
-- ⚠️ Warning: This will delete existing embeddings!

-- 1. Drop existing match_documents function
drop function if exists match_documents;

-- 2. Drop existing index (if any)
drop index if exists knowledge_base_embedding_idx;

-- 3. Clear existing embeddings FIRST (before changing dimensions)
update knowledge_base set embedding = null;

-- 4. Alter knowledge_base table to use 1536 dimensions
alter table knowledge_base 
alter column embedding type vector(1536);

-- 5. Create new match_documents function for OpenAI (1536 dimensions)
create or replace function match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    kb.id,
    kb.content,
    kb.metadata,
    1 - (kb.embedding <=> query_embedding) as similarity
  from knowledge_base kb
  where 1 - (kb.embedding <=> query_embedding) > match_threshold
  and kb.embedding is not null
  order by kb.embedding <=> query_embedding
  limit match_count;
$$;

-- 5. Create index for faster vector search
drop index if exists knowledge_base_embedding_idx;
create index knowledge_base_embedding_idx 
  on knowledge_base 
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ✅ Migration complete! 
-- Next step: Re-generate embeddings by clicking "Teach AI" for each knowledge item
