-- AI Settings Table
-- Controls AI behavior and response rules

create table if not exists ai_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb not null,
  description text,
  updated_at timestamptz default now()
);

-- Grant permissions to authenticated users and service role
grant select, insert, update, delete on ai_settings to authenticated;
grant select, insert, update, delete on ai_settings to service_role;
grant select, insert, update, delete on ai_settings to anon;

-- Enable Row Level Security (but allow all operations for now)
alter table ai_settings enable row level security;

-- Create permissive policy for service role (admin access)
create policy "Allow all operations for service role"
  on ai_settings
  for all
  to service_role
  using (true)
  with check (true);

-- Create policy for authenticated users (can read/update settings)
create policy "Allow authenticated users to read settings"
  on ai_settings
  for select
  to authenticated
  using (true);

create policy "Allow authenticated users to update settings"
  on ai_settings
  for update
  to authenticated
  using (true)
  with check (true);

-- Insert default settings
insert into ai_settings (key, value, description) values
('strict_mode', 'true', 'Only answer from knowledge base, no hallucination'),
('require_knowledge', 'true', 'Require at least 1 relevant document from RAG'),
('fallback_message', '"ขอโทษค่ะ ตอนนี้ผมยังไม่มีข้อมูลเกี่ยวกับเรื่องนี้ รบกวนติฟดต่อเจ้าหน้าที่โดยตรงได้เลยนะคะ"', 'Message when no knowledge found'),
('min_confidence', '0.5', 'Minimum similarity score for RAG documents'),
('max_response_length', '300', 'Maximum tokens for AI response')
on conflict (key) do nothing;

-- Create updated_at trigger
create or replace function update_ai_settings_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger ai_settings_updated_at
  before update on ai_settings
  for each row
  execute function update_ai_settings_timestamp();
