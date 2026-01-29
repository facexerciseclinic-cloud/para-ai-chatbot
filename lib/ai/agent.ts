import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { embed, generateText } from 'ai';
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
      // Note: match_documents must be updated to accept vector(768)
      console.log('📚 [Step 3] Searching knowledge base...');
      const { data: documents } = await Promise.race([
        supabaseAdmin.rpc('match_documents', {
          query_embedding: embedding,
          match_threshold: 0.5,
          match_count: 2
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Vector search timeout')), 5000)
        )
      ]) as any;
      console.log(`✅ [Step 3] Found ${documents?.length || 0} relevant documents`);
      
      contextBlock = documents?.map((doc: any) => doc.content).join('\n---\n') || "";
    } catch (ragError: any) {
      console.warn(`⚠️ RAG failed, continuing without context:`, ragError.message);
      // Continue without RAG context
    }

    // 3. Generate Response (Use OpenAI GPT-4o-mini)
    console.log(`✨ [Step 4] Calling OpenAI API...`);
    
    const generationModel = openai('gpt-4o-mini'); // Fast and affordable
    
    console.log('📤 Sending to AI:', {
      model: 'gpt-4o-mini',
      historyLength: formattedHistory.length,
      contextLength: contextBlock.length,
      messageLength: userMessage.length
    });
    
    const result = await Promise.race([
      generateText({
        model: generationModel as any,
        system: SYSTEM_PROMPT + `\n\nContext from Knowledge Base:\n${contextBlock}`,
        prompt: `Chat History:\n${formattedHistory}\n\nUser: ${userMessage}`,
        temperature: 0.7,
        maxTokens: 300, // Reduce tokens for faster response
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('AI generation timeout')), 20000) // 20s timeout
      )
    ]) as any;
    
    const text = result.text || '';
    console.log(`✅ [Step 4] AI response received (${text.length} chars)`);
    console.log('📝 Response preview:', text.substring(0, 100));
    
    // Validate response
    if (!text || text.trim().length === 0) {
      console.error('⚠️ Gemini returned empty response');
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
