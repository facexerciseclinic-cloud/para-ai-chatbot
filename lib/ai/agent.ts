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
      .in('key', ['strict_mode', 'require_knowledge', 'fallback_message', 'min_confidence']);
    
    const settingsMap = new Map(settings?.map(s => [s.key, s.value]) || []);
    // Parse JSONB boolean values properly
    const strictMode = settingsMap.get('strict_mode') === true || settingsMap.get('strict_mode') === 'true';
    const requireKnowledge = settingsMap.get('require_knowledge') === true || settingsMap.get('require_knowledge') === 'true';
    const fallbackMessage = settingsMap.get('fallback_message') || 'ขอโทษค่ะ ตอนนี้ผมยังไม่มีข้อมูลเกี่ยวกับเรื่องนี้ รบกวนติดต่อเจ้าหน้าที่โดยตรงได้เลยนะคะ';
    const minConfidence = Number(settingsMap.get('min_confidence')) || 0.5;
    
    console.log('⚙️ AI Settings:', { strictMode, requireKnowledge, minConfidence });

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

    // 2. RAG Retrieval using pgvector
    // 2. RAG Retrieval using pgvector
    console.log('🔍 [Step 2] Generating embeddings...');
    let contextBlock = "";
    
    try {
      const { embedding } = await Promise.race([
        embed({
          model: openai.embedding('text-embedding-3-small') as any,
          value: userMessage,
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Embedding timeout')), 8000)
        )
      ]) as any;
      console.log(`✅ [Step 2] Embedding generated (${embedding.length} dimensions)`);
      
      // Search knowledge base
      console.log('📚 [Step 3] Searching knowledge base...');
      const { data: documents, error: searchError } = await Promise.race([
        supabaseAdmin.rpc('match_documents', {
          query_embedding: embedding,
          match_threshold: minConfidence,
          match_count: 2
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Vector search timeout')), 5000)
        )
      ]) as any;
      
      if (searchError) {
        console.error('❌ Vector search error:', searchError);
      }
      
      console.log(`✅ [Step 3] Found ${documents?.length || 0} relevant documents`);
      console.log('📄 Documents:', JSON.stringify(documents, null, 2));
      
      // Check if knowledge is required but not found
      if (requireKnowledge && (!documents || documents.length === 0)) {
        console.warn('⚠️ Require Knowledge enabled: No documents found, returning fallback');
        console.warn('🔧 Debug: minConfidence =', minConfidence, 'embedding length =', embedding.length);
        return {
          message: fallbackMessage,
          shouldEscalate: true,
          confidence: 0,
        };
      }
      
      contextBlock = documents?.map((doc: any) => doc.content).join('\n---\n') || "";
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
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt + `\n\nContext from Knowledge Base:\n${contextBlock}`
          },
          {
            role: 'user',
            content: `Chat History:\n${formattedHistory}\n\nUser: ${userMessage}`
          }
        ],
        temperature: strictMode ? 0.3 : 0.7, // Lower temperature in strict mode
        max_tokens: 300,
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('AI generation timeout')), 20000)
      )
    ]) as OpenAI.Chat.Completions.ChatCompletion;
    
    const text = completion.choices[0]?.message?.content || '';
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
