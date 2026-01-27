-- Enable pgvector extension
create extension if not exists vector;

-- 1. Customers Table (Global Profile)
create table customers (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  phone_number text,
  crm_tags text[], -- e.g., ['VIP', 'New Lead']
  skin_concerns text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Social Identities (One customer -> Multiple platforms)
create type social_platform as enum ('line', 'facebook', 'instagram', 'tiktok');

create table social_identities (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete cascade,
  platform social_platform not null,
  platform_user_id text not null, -- ID from the platform (e.g. LINE User ID)
  profile_name text,
  avatar_url text,
  created_at timestamptz default now(),
  unique(platform, platform_user_id)
);

-- 3. Conversations (Session)
create type conversation_status as enum ('active', 'archived');

create table conversations (
  id uuid primary key default gen_random_uuid(),
  social_identity_id uuid references social_identities(id) on delete cascade,
  status conversation_status default 'active',
  ai_mode boolean default true, -- True = AI handles response, False = Human takeover
  last_message_at timestamptz default now(),
  created_at timestamptz default now()
);

-- 4. Messages
create type sender_type as enum ('user', 'ai', 'agent');
create type content_type as enum ('text', 'image', 'sticker');

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  sender_type sender_type not null,
  content_type content_type not null default 'text',
  content text,
  raw_payload jsonb, -- Raw Webhook payload
  created_at timestamptz default now()
);

-- 5. Knowledge Base (RAG)
create type kb_category as enum ('Price', 'Procedure', 'Promotion');

create table knowledge_base (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  category kb_category,
  embedding vector(1536), -- 1536 dim for text-embedding-3-small / ada-002
  metadata jsonb,
  created_at timestamptz default now()
);

-- Indexes for performance
create index idx_messages_conversation on messages(conversation_id);
create index idx_conversations_updated on conversations(last_message_at desc);
create index idx_social_identities_customer on social_identities(customer_id);
