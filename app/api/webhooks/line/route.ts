import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import lineClient from '@/lib/line'; // MessagingApiClient
import { WebhookEvent } from '@line/bot-sdk';
import crypto from 'crypto';

// Initialize Supabase Admin Client (Service Role for backend ops)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const channelSecret = process.env.LINE_CHANNEL_SECRET || '';

// Verify Signature Helper
const verifySignature = (body: string, signature: string) => {
  const hash = crypto
    .createHmac('sha256', channelSecret)
    .update(body)
    .digest('base64');
  return hash === signature;
};

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-line-signature') as string;

    if (!channelSecret) {
      console.error('LINE_CHANNEL_SECRET is missing');
      return NextResponse.json({ error: 'Config error' }, { status: 500 });
    }

    // 1. Verify Request
    if (!verifySignature(body, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const { events } = JSON.parse(body);

    // 2. Process Events
    await Promise.all(
      events.map(async (event: WebhookEvent) => {
        if (event.type !== 'message' || event.message.type !== 'text') {
          return;
        }

        const userId = event.source.userId!;
        const text = event.message.text;
        const replyToken = event.replyToken;

        // A. Find or Create Identity
        let { data: identity } = await supabase
          .from('social_identities')
          .select('*, customers(*)')
          .eq('platform', 'line')
          .eq('platform_user_id', userId)
          .single();

        if (!identity) {
            // New User -> Create Customer + Identity
            const PROFILE_URL = `https://api.line.me/v2/bot/profile/${userId}`;
            const profRes = await fetch(PROFILE_URL, {
                headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` }
            });
            const profile = await profRes.json();
            
            // 1. Create Customer
            const { data: newCust, error: custErr } = await supabase
                .from('customers')
                .insert({ full_name: profile.displayName || 'LINE User' })
                .select()
                .single();
            
            if (custErr) throw custErr;

            // 2. Create Identity
            const { data: newIdent, error: identErr } = await supabase
                .from('social_identities')
                .insert({
                    customer_id: newCust.id,
                    platform: 'line',
                    platform_user_id: userId,
                    profile_name: profile.displayName || 'LINE User',
                    avatar_url: profile.pictureUrl
                })
                .select()
                .single();
            
            if (identErr) throw identErr;
            identity = newIdent;
        }

        // B. Find Active Conversation
        let { data: conversation } = await supabase
            .from('conversations')
            .select('*')
            .eq('social_identity_id', identity.id)
            .eq('status', 'active')
            .single();

        if (!conversation) {
            const { data: newConv } = await supabase
                .from('conversations')
                .insert({
                    social_identity_id: identity.id,
                    status: 'active',
                    ai_mode: true
                })
                .select()
                .single();
            conversation = newConv;
        }

        // C. Save User Message
        await supabase.from('messages').insert({
            conversation_id: conversation.id,
            sender_type: 'user',
            content_type: 'text',
            content: text,
            raw_payload: event as any
        });

        // Update conversation timestamp
        await supabase
            .from('conversations')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', conversation.id);

        // D. (Optional) Auto-reply if AI is ON
        // For now, we just save to DB. Next step is "AI Reply".
        // We can add a simple "Received" echo for testing if needed.
      })
    );

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    console.error('Webhook Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
