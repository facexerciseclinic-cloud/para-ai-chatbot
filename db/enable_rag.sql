-- ฟังก์ชันสำหรับค้นหา Knowledge Base ที่ใกล้เคียง (Vector Similarity Search)
-- ต้องรัน SQL นี้ใน Supabase > SQL Editor ก่อน AI ถึงจะทำงานได้

create or replace function match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  content text,
  category kb_category,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    kb.id,
    kb.content,
    kb.category,
    1 - (kb.embedding <=> query_embedding) as similarity
  from knowledge_base kb
  where 1 - (kb.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
end;
$$;
