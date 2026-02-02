import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';
import OpenAI from 'openai';
import { supabaseAdmin } from '@/lib/supabase';
import { Message, AIResponse } from '@/types';

// Choose AI Provider based on available API Key
const USE_OPENAI = !!process.env.OPENAI_API_KEY;
const USE_GOOGLE = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;

const SYSTEM_PROMPT = `
You are "Aesthetic Consultant", an expert AI assistant for an aesthetic clinic.
Your goal is to provide helpful information about beauty procedures, prices, and promotions.
Tone: Professional, Friendly, Empathetic, and Trustworthy (Medical Grade).

key rules:
1. DO NOT diagnose medical conditions. If a user asks for medical advice, recommend chatting with a real doctor/staff.
2. Focus on closing sales or booking appointments.
3. Use the provided "Context" to answer questions about price and procedures.
4. If the user seems angry or asks for a human, signal to escalate.
`;

export async function generateAIResponse(conversationId: string, userMessage: string): Promise<AIResponse> {
  try {
    // Check API Key
    if (!process.env.OPENAI_API_KEY) {
      console.error("❌ Missing OPENAI_API_KEY");
      throw new Error("No OpenAI API Key configured");
    }

    console.log(`🤖 Using OpenAI for AI generation`);

    // Load AI Settings from database
    const { data: settings } = await supabaseAdmin
      .from('ai_settings')
      .select('key, value')
      .in('key', ['strict_mode', 'require_knowledge', 'fallback_message', 'min_confidence', 'use_finetuned_model']);
    
    const settingsMap = new Map(settings?.map(s => [s.key, s.value]) || []);
    // Parse JSONB boolean values properly
    const strictMode = settingsMap.get('strict_mode') === true || settingsMap.get('strict_mode') === 'true';
    const requireKnowledge = settingsMap.get('require_knowledge') === true || settingsMap.get('require_knowledge') === 'true';
    const fallbackMessage = settingsMap.get('fallback_message') || 'ขอโทษค่ะ ตอนนี้ผมยังไม่มีข้อมูลเกี่ยวกับเรื่องนี้ รบกวนติดต่อเจ้าหน้าที่โดยตรงได้เลยนะคะ';
    const minConfidence = Number(settingsMap.get('min_confidence')) || 0.5;
    const useFinetunedModel = settingsMap.get('use_finetuned_model') === true || settingsMap.get('use_finetuned_model') === 'true';
    
    console.log('⚙️ AI Settings:', { strictMode, requireKnowledge, minConfidence, useFinetunedModel });

    console.log('🤖 [Step 1] Loading conversation history...');
    // 1. Context Loading: Fetch last 5 messages (reduced from 10 for speed)
    const historyPromise = supabaseAdmin
      .from('messages')
      .select('sender_type, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(5);
    
    const { data: history } = await Promise.race([
      historyPromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('History timeout')), 5000)
      )
    ]) as any;

    const formattedHistory = (history || []).reverse().map((m: any) => 
      `${m.sender_type === 'user' ? 'User' : 'Assistant'}: ${m.content}`
    ).join('\n');
    
    console.log(`✅ [Step 1] Loaded ${history?.length || 0} messages`);

    // 2. Smart RAG: Load new knowledge that wasn't in fine-tuning
    console.log('📚 [Step 2] Checking for new knowledge...');
    let contextBlock = "";
    
    try {
      // Only load RAG context if NOT using fine-tuned model, or to supplement with new data
      if (!useFinetunedModel) {
        console.log('🔍 Using RAG (no fine-tuned model)');
        
        // 2.1 Always load ALL General guidelines (must-know rules)
        console.log('📋 [Step 2.1] Loading General guidelines...');
        const { data: generalKnowledge } = await supabaseAdmin
          .from('knowledge_base')
          .select('content')
          .eq('category', 'General')
          .not('embedding', 'is', null);
        
        const generalContext = generalKnowledge?.map(k => k.content).join('\n---\n') || "";
        console.log(`✅ Loaded ${generalKnowledge?.length || 0} General guidelines`);
        
        // 2.2 Semantic search for relevant specific knowledge
        console.log('🔍 [Step 2.2] Semantic search for relevant knowledge...');
        const { embedding } = await embed({
          model: openai.embedding('text-embedding-3-small') as any,
          value: userMessage,
        });
        
        const { data: relevantDocs } = await supabaseAdmin.rpc('match_documents', {
          query_embedding: embedding,
          match_threshold: minConfidence,
          match_count: 5
        });
        
        const relevantContext = relevantDocs?.map((doc: any) => doc.content).join('\n---\n') || "";
        console.log(`✅ Found ${relevantDocs?.length || 0} relevant documents`);
        
        // Combine: General (all) + Relevant (top 5)
        contextBlock = generalContext 
          ? (relevantContext ? `${generalContext}\n---\n${relevantContext}` : generalContext)
          : relevantContext;
        
        console.log(`📊 Total context length: ${contextBlock.length} chars`);
        
        // Truncate if still too long (safety net)
        if (contextBlock.length > 10000) {
          console.warn(`⚠️ Context too long (${contextBlock.length} chars), truncating...`);
          contextBlock = contextBlock.substring(0, 10000) + '\n\n[... more knowledge available ...]';
        }
      } else {
        console.log('🎓 Using fine-tuned model - knowledge embedded in model');
        // Optionally load only very recent knowledge (last 7 days) to supplement
        const { data: recentKnowledge } = await supabaseAdmin
          .from('knowledge_base')
          .select('content')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .not('embedding', 'is', null)
          .limit(3);
        
        if (recentKnowledge && recentKnowledge.length > 0) {
          contextBlock = '📌 Recent Updates:\n' + recentKnowledge.map(k => k.content).join('\n---\n');
          console.log(`✅ Loaded ${recentKnowledge.length} recent knowledge items (last 7 days)`);
        }
      }
      
      // Check if knowledge is required but not found
      if (requireKnowledge && !contextBlock && !useFinetunedModel) {
        console.warn('⚠️ Require Knowledge enabled: No knowledge found in database');
        return {
          message: fallbackMessage,
          shouldEscalate: true,
          confidence: 0,
        };
      }
    } catch (ragError: any) {
      console.warn(`⚠️ RAG failed, continuing without context:`, ragError.message);
      // Continue without RAG context
    }

    // 3. Generate Response (Use OpenAI SDK directly)
    console.log(`✨ [Step 4] Calling OpenAI API...`);
    
    const openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Build system prompt with strict rules if enabled
    let systemPrompt = SYSTEM_PROMPT;
    if (strictMode && contextBlock) {
      systemPrompt += `\n\n⚠️ STRICT MODE ENABLED:
- You MUST answer ONLY from the provided "Context from Knowledge Base"
- DO NOT make up information or use general knowledge
- If the answer is not in the context, say: "${fallbackMessage}"`;
    }
    
    const completion = await Promise.race([
      openaiClient.chat.completions.create({
        model: useFinetunedModel 
          ? 'ft:gpt-4o-mini-2024-07-18:personal:drdenv2:D4iJpcog' 
          : 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: useFinetunedModel && !contextBlock
              ? systemPrompt // Fine-tuned: no context needed
              : systemPrompt + `\n\nContext from Knowledge Base:\n${contextBlock}` // Base model or new data
          },
          {
            role: 'user',
            content: `Chat History:\n${formattedHistory}\n\nUser: ${userMessage}`
          }
        ],
        temperature: strictMode ? 0.3 : 0.7,
        max_tokens: 500,
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('AI generation timeout')), 60000) // Increased to 60s for fine-tuned model
      )
    ]) as OpenAI.Chat.Completions.ChatCompletion;
    
    const text = completion.choices[0]?.message?.content || '';
    
    // Token usage and cost calculation
    const usage = completion.usage;
    const promptTokens = usage?.prompt_tokens || 0;
    const completionTokens = usage?.completion_tokens || 0;
    const totalTokens = usage?.total_tokens || 0;
    
    // GPT-4o-mini pricing (as of 2024)
    const inputCostPer1M = 0.150; // $0.150 per 1M input tokens
    const outputCostPer1M = 0.600; // $0.600 per 1M output tokens
    
    const inputCost = (promptTokens / 1_000_000) * inputCostPer1M;
    const outputCost = (completionTokens / 1_000_000) * outputCostPer1M;
    const totalCost = inputCost + outputCost;
    
    console.log(`\n💰 Token Usage & Cost:`);
    console.log(`   📥 Input tokens: ${promptTokens.toLocaleString()} ($${inputCost.toFixed(6)})`);
    console.log(`   📤 Output tokens: ${completionTokens.toLocaleString()} ($${outputCost.toFixed(6)})`);
    console.log(`   📊 Total tokens: ${totalTokens.toLocaleString()}`);
    console.log(`   💵 Total cost: $${totalCost.toFixed(6)} (~฿${(totalCost * 35).toFixed(4)} THB)`);
    console.log(`✅ [Step 4] AI response received (${text.length} chars)`);
    console.log('📝 Response preview:', text.substring(0, 100));
    
    // Validate response
    if (!text || text.trim().length === 0) {
      console.error('⚠️ OpenAI returned empty response');
      throw new Error('Empty AI response');
    }
    
    // 4. Safety Layer & Post-processing
    const lowerText = text.toLowerCase();
    const shouldEscalate = 
      lowerText.includes("contact staff") || 
      lowerText.includes("talk to human") ||
      userMessage.toLowerCase().includes("complain") ||
      userMessage.toLowerCase().includes("angry");

    return {
      message: text,
      shouldEscalate,
      confidence: 1.0, // Simplified
    };

  } catch (error: any) {
    console.error("❌ AI Generation Error:", error);
    console.error("Error details:", {
      message: error?.message,
      cause: error?.cause,
      stack: error?.stack?.substring(0, 200)
    });
    
    // Check error type
    const errorMsg = error?.message?.toLowerCase() || '';
    const isQuotaExceeded = errorMsg.includes('quota') || errorMsg.includes('exceeded') || errorMsg.includes('limit');
    const isKeyIssue = errorMsg.includes('api key') || errorMsg.includes('authentication') || errorMsg.includes('unauthorized');
    
    // Fallback if AI fails
    return {
      message: isQuotaExceeded
        ? "🙏 ขออภัยค่ะ ระบบ AI ใช้งานเกินโควต้าวันนี้แล้ว กรุณาติดต่อเจ้าหน้าที่โดยตรงนะคะ หรือลองใหม่พรุ่งนี้ค่ะ"
        : isKeyIssue 
          ? "⚠️ ระบบ AI ยังไม่พร้อมใช้งาน (ไม่มี API Key) กรุณาติดต่อเจ้าหน้าที่ค่ะ"
          : "ขออภัยค่ะ ระบบ AI ขัดข้องชั่วคราว เดี๋ยวเจ้าหน้าที่จะมาตอบให้นะคะ 🙏",
      shouldEscalate: true,
      confidence: 0,
    };
  }
}
