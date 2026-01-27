import { NextRequest, NextResponse } from 'next/server';
import { LineService } from '@/lib/services/line';
import { FacebookService } from '@/lib/services/facebook';
import { supabaseAdmin } from '@/lib/supabase';
import { generateAIResponse } from '@/lib/ai/agent';
import { NormalizedPayload } from '@/types';

// Webhook Handler
export async function POST(
  req: NextRequest,
  { params }: { params: { platform: string } }
) {
  const platform = params.platform;
  const body = await req.json();

  let payloads: NormalizedPayload[] = [];

  try {
    // 1. Normalization
    switch (platform) {
      case 'line':
        payloads = await LineService.parseWebhook(body);
        break;
      case 'facebook':
        payloads = await FacebookService.parseWebhook(body);
        break;
      default:
        return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 });
    }

    for (const payload of payloads) {
      // 2. Identity Resolution
      // Check if identity exists
      let { data: identity } = await supabaseAdmin
        .from('social_identities')
        .select('id, customer_id')
        .eq('platform', platform)
        .eq('platform_user_id', payload.platformUserId)
        .single();
        
      let customerId = identity?.customer_id;

      if (!identity) {
        // Create new Customer & Identity
        const { data: newCustomer } = await supabaseAdmin
          .from('customers')
          .insert({ full_name: payload.userProfile?.displayName || 'Unknown' })
          .select('id')
          .single();
        
        customerId = newCustomer?.id;

        const { data: newIdentity } = await supabaseAdmin
          .from('social_identities')
          .insert({
            customer_id: customerId,
            platform: platform,
            platform_user_id: payload.platformUserId,
            profile_name: payload.userProfile?.displayName,
            avatar_url: payload.userProfile?.pictureUrl
          })
          .select('id')
          .single();
          
        identity = newIdentity;
      }

      // 3. Get or Create Conversation
      let { data: conversation } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('social_identity_id', identity.id)
        .eq('status', 'active')
        .single();

      if (!conversation) {
        const { data: newConv } = await supabaseAdmin
          .from('conversations')
          .insert({ social_identity_id: identity.id })
          .select('*')
          .single();
        conversation = newConv;
      }

      // 4. Save User Message
      await supabaseAdmin.from('messages').insert({
        conversation_id: conversation.id,
        sender_type: 'user',
        content_type: payload.type,
        content: payload.text || '[Non-text message]',
        raw_payload: payload.raw
      });

      // 5. AI Logic (If Active)
      if (conversation.ai_mode && payload.type === 'text') {
         // Run AI in background (in generic serverless, maybe trigger another async job, but here await)
         const response = await generateAIResponse(conversation.id, payload.text!);
         
         // Save AI Response
         await supabaseAdmin.from('messages').insert({
           conversation_id: conversation.id,
           sender_type: 'ai',
           content: response.message
         });
         
         // Reply to Platform
         if (platform === 'line') {
           // await LineService.replyMessage(...)
         } else if (platform === 'facebook') {
           // await FacebookService.sendText(...)
         }

         // Handle Escalation
         if (response.shouldEscalate) {
           await supabaseAdmin
             .from('conversations')
             .update({ ai_mode: false })
             .eq('id', conversation.id);
           // Notify Admin Logic
         }
      }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: { platform: string } }) {
  // Verification for Facebook/Instagram
  if (params.platform === 'facebook') {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === process.env.FB_VERIFY_TOKEN) {
      return new NextResponse(challenge);
    }
  }
  return NextResponse.json({ status: 'ok' });
}
