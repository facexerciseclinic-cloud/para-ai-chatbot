import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';

export async function POST(req: Request) {
  try {
    const { content, category } = await req.json();

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // 1. Generate Embedding using OpenAI (1536 dimensions)
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small') as any,
      value: content,
    });

    // 2. Insert into Supabase
    const { data, error } = await supabaseAdmin
      .from('knowledge_base')
      .insert({
        content,
        category,
        embedding,
        metadata: { source: 'admin-dashboard' }
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error adding knowledge:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
    // List latest knowledge
    const { data, error } = await supabaseAdmin
        .from('knowledge_base')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
    
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
}

export async function DELETE(req: Request) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const { error } = await supabaseAdmin
        .from('knowledge_base')
        .delete()
        .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
