/**
 * Script: Fix AI Settings
 * Update min_confidence to reasonable value
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixSettings() {
  console.log('🔧 Fixing AI Settings...\n');
  
  // Update min_confidence to 0.3 (30% similarity is reasonable)
  const { error } = await supabase
    .from('ai_settings')
    .update({ value: 0.3 })
    .eq('key', 'min_confidence');
  
  if (error) {
    console.error('❌ Error updating settings:', error);
  } else {
    console.log('✅ Updated min_confidence to 0.3 (was 1.0)');
  }
  
  // Verify
  const { data } = await supabase
    .from('ai_settings')
    .select('key, value')
    .eq('key', 'min_confidence')
    .single();
  
  console.log('\n✅ Current setting:', data);
  console.log('\n💡 Now AI can match knowledge with 30%+ similarity');
}

fixSettings().catch(console.error);
