import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/settings/ai - Get all AI settings
export async function GET() {
  try {
    const { data: settings, error } = await supabaseAdmin
      .from('ai_settings')
      .select('*')
      .order('key');

    if (error) throw error;

    // Convert to key-value map and parse JSONB values
    const settingsMap: Record<string, any> = {};
    settings?.forEach(s => {
      // JSONB values need to be parsed
      const value = s.value;
      // Handle different types: boolean (true/false), string, number
      if (value === true || value === false) {
        settingsMap[s.key] = value;
      } else if (typeof value === 'string') {
        settingsMap[s.key] = value;
      } else if (typeof value === 'number') {
        settingsMap[s.key] = value;
      } else {
        settingsMap[s.key] = value;
      }
    });

    return NextResponse.json(settingsMap);
  } catch (error: any) {
    console.error('Error fetching AI settings:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/settings/ai - Update AI settings
export async function PUT(request: Request) {
  try {
    const updates = await request.json();

    // Update each setting
    const promises = Object.entries(updates).map(([key, value]) =>
      supabaseAdmin
        .from('ai_settings')
        .update({ value })
        .eq('key', key)
    );

    await Promise.all(promises);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating AI settings:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
