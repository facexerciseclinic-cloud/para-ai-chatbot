import { generateAIResponse } from '@/lib/ai/agent';
import { messagingApi } from '@line/bot-sdk'; // Import SDK directly

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
// import lineClient from '@/lib/line'; // REMOVE static client
import { WebhookEvent } from '@line/bot-sdk';
import crypto from 'crypto';

// Initialize Supabase Admin
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper: Dynamic Signature Verification
const verifySignature = (body: string, signature: string, secret: string) => {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('base64');
  return hash === signature;
};

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-line-signature') as string;

    // 1. Parse Body first to find "Destination" (Bot User ID)
    const jsonBody = JSON.parse(body);
    const destination = jsonBody.destination; // LINE Webhook includes this!
    const events = jsonBody.events;

    if (!destination) {
        // Fallback or Ping event
        return NextResponse.json({ status: 'no_destination' });
    }

    // 2. Load Credentials dynamically from DB
    const { data: channelConfig } = await supabase
        .from('connected_channels')
        .select('*')
        .eq('platform', 'line')
        .eq('platform_account_id', destination) // Match the bot receiving the message
        .single();

    if (!channelConfig) {
        console.error(`No channel config found for destination: ${destination}`);
        return NextResponse.json({ error: 'Channel not configured' }, { status: 404 });
    }

    const { channel_secret: channelSecret, access_token: channelAccessToken } = channelConfig;

    // 3. Verify Signature using the retrieved secret
    if (!verifySignature(body, signature, channelSecret)) {
      console.error('Invalid LINE Signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Initialize Dynamic Client
    const client = new messagingApi.MessagingApiClient({
        channelAccessToken: channelAccessToken,
    });

    // 4. Process Events
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
            // New User -> Fetch Profile
            const PROFILE_URL = `https://api.line.me/v2/bot/profile/${userId}`;
            const profRes = await fetch(PROFILE_URL, {
                headers: { Authorization: `Bearer ${channelAccessToken}` } // Use Dynamic Token
            });
            const profile = await profRes.json();
            
            // Create Customer logic... (Same as before)
            const { data: newCust, error: custErr } = await supabase
                .from('customers')
                .insert({ full_name: profile.displayName || 'LINE User' })
                .select().single();
            if (custErr) throw custErr;

            const { data: newIdent, error: identErr } = await supabase
                .from('social_identities')
                .insert({
                    customer_id: newCust.id,
                    platform: 'line',
                    platform_user_id: userId,
                    profile_name: profile.displayName || 'LINE User',
                    avatar_url: profile.pictureUrl
                }).select().single();
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
                    channel_id: channelConfig.id, // Link conversation to specific channel
                    status: 'active',
                    ai_mode: true
                }).select().single();
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

        // Update timestamp
        await supabase
            .from('conversations')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', conversation.id);

        // D. Auto-reply logic
        if (conversation.ai_mode && event.message.type === 'text') {
            try {
              const aiRes = await generateAIResponse(conversation.id, text);
              
              await supabase.from('messages').insert({
                conversation_id: conversation.id,
                sender_type: 'ai',
                content_type: 'text',
                content: aiRes.message
              });

              // Reply using Dynamic Client
              await client.replyMessage({
                replyToken: replyToken,
                messages: [{ type: 'text', text: aiRes.message }]
              });
                messages: [{ type: 'text', text: aiRes.message }]
              });

              // 4. Update Timestamp again
               await supabase
                .from('conversations')
                .update({ last_message_at: new Date().toISOString() })
                .eq('id', conversation.id);

            } catch (aiErr) {
               console.error("AI Error:", aiErr);
               // Fallback: don't crash webhook, just log
            }
        }
      })
    );
// ...existing code...

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    console.error('Webhook Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
