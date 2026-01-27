-- Clean up existing data (optional, be careful in production!)
-- truncate table messages, conversations, social_identities, customers cascade;

-- 1. Insert Customers
insert into customers (id, full_name, phone_number, crm_tags, skin_concerns)
values
  ('a1111111-1111-4111-a111-111111111111', 'คุณพลอย สวยใส', '081-234-5678', ARRAY['VIP', 'High Spender'], ARRAY['Acne', 'Brightening']),
  ('a2222222-2222-4222-a222-222222222222', 'คุณน็อป', '089-999-8888', ARRAY['New Lead'], ARRAY['Anti-Aging']);

-- 2. Insert Social Identities
insert into social_identities (id, customer_id, platform, platform_user_id, profile_name, avatar_url)
values
  ('b1111111-1111-4111-b111-111111111111', 'a1111111-1111-4111-a111-111111111111', 'line', 'U123456789', 'Ploy Suay', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ploy'),
  ('b2222222-2222-4222-b222-222222222222', 'a2222222-2222-4222-a222-222222222222', 'facebook', 'F987654321', 'Nop Deb', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Nop');

-- 3. Insert Conversations
insert into conversations (id, social_identity_id, status, ai_mode, last_message_at)
values
  ('c1111111-1111-4111-c111-111111111111', 'b1111111-1111-4111-b111-111111111111', 'active', true, now() - interval '5 minutes'),
  ('c2222222-2222-4222-c222-222222222222', 'b2222222-2222-4222-b222-222222222222', 'active', false, now() - interval '1 hour');

-- 4. Insert Messages
insert into messages (conversation_id, sender_type, content_type, content, created_at)
values
  -- Chat 1: Ploy (AI Handling)
  ('c1111111-1111-4111-c111-111111111111', 'user', 'text', 'สวัสดีค่ะ สนใจโปรแกรมรักษาสิวค่ะ', now() - interval '10 minutes'),
  ('c1111111-1111-4111-c111-111111111111', 'ai', 'text', 'สวัสดีค่ะ ยินดีต้อนรับสู่ Para Clinic ค่ะ แอดมินขอแนะนำโปรแกรม Acne Clear นะคะ ไม่ทราบว่าคุณลูกค้ากังวลเรื่องสิวอุดตันหรือสิวอักเสบเป็นพิเศษไหมคะ?', now() - interval '9 minutes'),
  ('c1111111-1111-4111-c111-111111111111', 'user', 'text', 'เป็นสิวอักเสบค่ะ ราคาเท่าไหร่คะ?', now() - interval '5 minutes'),
  
  -- Chat 2: Nop (Human Takeover)
  ('c2222222-2222-4222-c222-222222222222', 'user', 'text', 'ขอสายพนักงานหน่อยครับ หงุดหงิดมาก', now() - interval '2 hours'),
  ('c2222222-2222-4222-c222-222222222222', 'agent', 'text', 'ต้องขออภัยในความไม่สะดวกด้วยครับ ผมแอดมินน็อปมารับเรื่องแล้วครับ มีอะไรให้ช่วยดูแลครับ?', now() - interval '1 hour');
