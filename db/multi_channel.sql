-- Multi-Channel Support Migration

-- 1. Create table for storing Channel Credentials
create table connected_channels (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('line', 'facebook')), 
  platform_account_id text not null, -- LINE: Destination ID (U...), FB: Page ID
  name text, -- e.g. "Para Clinic - Siam Branch"
  access_token text not null,
  channel_secret text, 
  created_at timestamptz default now(),
  unique(platform, platform_account_id)
);

-- 2. Add 'channel_id' to conversations (Optional: to know which branch the chat belongs to)
alter table conversations 
add column if not exists channel_id uuid references connected_channels(id);

-- 3. Example Data (INSERT YOUR REAL TOKENS HERE LATER)
-- insert into connected_channels (platform, platform_account_id, name, access_token, channel_secret)
-- values ('line', 'U123456...', 'Main Branch', 'ey...', 'secret...');
