import { openai } from '@ai-sdk/openai';
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

    // 2. RAG Retrieval using pgvector
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small') as any,
      value: userMessage,
    });
    
    const { data: documents } = await supabaseAdmin.rpc('match_documents', {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: 3
    });

    const contextBlock = documents?.map((doc: any) => doc.content).join('\n---\n') || "";

    // 3. Generate Response
    const { text } = await generateText({
      model: openai('gpt-4o'),
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

  } catch (error) {
    console.error("AI Generation Error:", error);
    // Fallback if AI fails
    return {
      message: "ขออภัยครับ ระบบขัดข้องชั่วคราว เดี๋ยวเจ้าหน้าที่รีบมาตอบนะครับ",
      shouldEscalate: true,
      confidence: 0,
    };
  }
}
