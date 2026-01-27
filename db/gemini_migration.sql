-- 1. ลบ Function เดิมก่อน (เพราะ Parameter type เปลี่ยน)
drop function if exists match_documents;

-- 2. แก้ไขขนาด Vector ในตาราง knowledge_base (จาก 1536 ของ OpenAI เป็น 768 ของ Gemini)
-- หมายเหตุ: ข้อมูล Embedding เก่า (ถ้ามี) จะใช้ไม่ได้ ต้อง Generate ใหม่
alter table knowledge_base 
alter column embedding type vector(768);

-- 3. สร้าง Function match_documents ใหม่ (รองรับ vector 768)
create or replace function match_documents (
  query_embedding vector(768),
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
