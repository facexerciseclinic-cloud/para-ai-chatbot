import { google } from '@ai-sdk/google';
import { embed, generateText } from 'ai';
import { supabaseAdmin } from '@/lib/supabase';
import { Message, AIResponse } from '@/types';

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
    // 1. Context Loading: Fetch last 10 messages
    const { data: history } = await supabaseAdmin
      .from('messages')
      .select('sender_type, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(10);

    const formattedHistory = (history || []).reverse().map(m => 
      `${m.sender_type === 'user' ? 'User' : 'Assistant'}: ${m.content}`
    ).join('\n');

    // 2. RAG Retrieval using pgvector (Gemini embedding-004 is 768 dimensions)
    const { embedding } = await embed({
      model: google.textEmbeddingModel('text-embedding-004') as any,
      value: userMessage,
    });
    
    // Note: match_documents must be updated to accept vector(768)
    const { data: documents } = await supabaseAdmin.rpc('match_documents', {
      query_embedding: embedding,
      match_threshold: 0.5, // Gemini embeddings might have different similarity scale
      match_count: 3
    });

    const contextBlock = documents?.map((doc: any) => doc.content).join('\n---\n') || "";

    // 3. Generate Response
    const { text } = await generateText({
      model: google('gemini-1.5-flash') as any, // Fast & Cheap
      system: SYSTEM_PROMPT + `\n\nContext from Knowledge Base:\n${contextBlock}`,
      prompt: `Chat History:\n${formattedHistory}\n\nUser: ${userMessage}`,
    });

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
    
    // Check if it's an API Key issue
    const isKeyIssue = error?.message?.toLowerCase().includes('api key') || 
                        error?.message?.toLowerCase().includes('authentication') ||
                        error?.message?.toLowerCase().includes('unauthorized');
    
    // Fallback if AI fails
    return {
      message: isKeyIssue 
        ? "⚠️ ระบบ AI ยังไม่พร้อมใช้งาน (ไม่มี API Key) กรุณาติดต่อเจ้าหน้าที่ค่ะ"
        : "ขออภัยค่ะ ระบบ AI ขัดข้องชั่วคราว เดี๋ยวเจ้าหน้าที่จะมาตอบให้นะคะ 🙏",
      shouldEscalate: true,
      confidence: 0,
    };
  }
}
