-- ⚠️ WARNING: THIS SCRIPT WILL DELETE ALL DATA
-- Use this to Reset and Fix "Type already exists" errors

-- 1. RESET DATABASE (Drop and Recreate Public Schema)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- 2. RE-CREATE TABLES (From schema.sql)
create extension if not exists vector;

-- Customers
create table customers (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  phone_number text,
  crm_tags text[], 
  skin_concerns text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Social Identities
create type social_platform as enum ('line', 'facebook', 'instagram', 'tiktok');

create table social_identities (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete cascade,
  platform social_platform not null,
  platform_user_id text not null,
  profile_name text,
  avatar_url text,
  created_at timestamptz default now(),
  unique(platform, platform_user_id)
);

-- Conversations
create type conversation_status as enum ('active', 'archived');

create table conversations (
  id uuid primary key default gen_random_uuid(),
  social_identity_id uuid references social_identities(id) on delete cascade,
  status conversation_status default 'active',
  ai_mode boolean default true, 
  last_message_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Messages
create type sender_type as enum ('user', 'ai', 'agent');
create type content_type as enum ('text', 'image', 'sticker');

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  sender_type sender_type not null,
  content_type content_type not null default 'text',
  content text,
  raw_payload jsonb, 
  created_at timestamptz default now()
);

-- Knowledge Base
create type kb_category as enum ('Price', 'Procedure', 'Promotion');

create table knowledge_base (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  category kb_category,
  embedding vector(1536),
  metadata jsonb,
  created_at timestamptz default now()
);

-- Indexes
create index idx_messages_conversation on messages(conversation_id);
create index idx_conversations_updated on conversations(last_message_at desc);
create index idx_social_identities_customer on social_identities(customer_id);

-- 3. ENABLE REALTIME
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table conversations;

-- 4. INSERT DUMMY DATA (From seed.sql)
insert into customers (id, full_name, phone_number, crm_tags, skin_concerns)
values
  ('a1111111-1111-4111-a111-111111111111', 'คุณพลอย สวยใส', '081-234-5678', ARRAY['VIP', 'High Spender'], ARRAY['Acne', 'Brightening']),
  ('a2222222-2222-4222-a222-222222222222', 'คุณน็อป', '089-999-8888', ARRAY['New Lead'], ARRAY['Anti-Aging']);

insert into social_identities (id, customer_id, platform, platform_user_id, profile_name, avatar_url)
values
  ('b1111111-1111-4111-b111-111111111111', 'a1111111-1111-4111-a111-111111111111', 'line', 'U123456789', 'Ploy Suay', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ploy'),
  ('b2222222-2222-4222-b222-222222222222', 'a2222222-2222-4222-a222-222222222222', 'facebook', 'F987654321', 'Nop Deb', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Nop');

insert into conversations (id, social_identity_id, status, ai_mode, last_message_at)
values
  ('c1111111-1111-4111-c111-111111111111', 'b1111111-1111-4111-b111-111111111111', 'active', true, now() - interval '5 minutes'),
  ('c2222222-2222-4222-c222-222222222222', 'b2222222-2222-4222-b222-222222222222', 'active', false, now() - interval '1 hour');

insert into messages (conversation_id, sender_type, content_type, content, created_at)
values
  ('c1111111-1111-4111-c111-111111111111', 'user', 'text', 'สวัสดีค่ะ สนใจโปรแกรมรักษาสิวค่ะ', now() - interval '10 minutes'),
  ('c1111111-1111-4111-c111-111111111111', 'ai', 'text', 'สวัสดีค่ะ ยินดีต้อนรับสู่ Para Clinic ค่ะ แอดมินขอแนะนำโปรแกรม Acne Clear นะคะ ไม่ทราบว่าคุณลูกค้ากังวลเรื่องสิวอุดตันหรือสิวอักเสบเป็นพิเศษไหมคะ?', now() - interval '9 minutes'),
  ('c1111111-1111-4111-c111-111111111111', 'user', 'text', 'เป็นสิวอักเสบค่ะ ราคาเท่าไหร่คะ?', now() - interval '5 minutes'),
  ('c2222222-2222-4222-c222-222222222222', 'user', 'text', 'ขอสายพนักงานหน่อยครับ หงุดหงิดมาก', now() - interval '2 hours'),
  ('c2222222-2222-4222-c222-222222222222', 'agent', 'text', 'ต้องขออภัยในความไม่สะดวกด้วยครับ ผมแอดมินน็อปมารับเรื่องแล้วครับ มีอะไรให้ช่วยดูแลครับ?', now() - interval '1 hour');

-- 5. FIX PERMISSIONS (Allow API Access without RLS for now)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
