/**
 * Script: Analyze General Guidelines
 * Check length and suggest how to split them
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeGeneral() {
  console.log('📊 Analyzing General Guidelines...\n');
  
  const { data: general, error } = await supabase
    .from('knowledge_base')
    .select('id, content, created_at')
    .eq('category', 'General')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log(`📚 Found ${general?.length || 0} General guidelines\n`);
  
  let totalChars = 0;
  
  general?.forEach((item, index) => {
    const chars = item.content.length;
    totalChars += chars;
    
    console.log(`${index + 1}. ID: ${item.id}`);
    console.log(`   Length: ${chars.toLocaleString()} chars`);
    console.log(`   Created: ${new Date(item.created_at).toLocaleString()}`);
    console.log(`   Preview: ${item.content.substring(0, 100).replace(/\n/g, ' ')}...\n`);
  });
  
  console.log(`\n📊 Summary:`);
  console.log(`   Total items: ${general?.length || 0}`);
  console.log(`   Total characters: ${totalChars.toLocaleString()}`);
  console.log(`   Average per item: ${Math.round(totalChars / (general?.length || 1)).toLocaleString()}`);
  
  if (totalChars > 10000) {
    console.log(`\n⚠️  WARNING: General guidelines are too long (${totalChars.toLocaleString()} chars)`);
    console.log(`   Recommendation: Split into smaller chunks or categorize differently`);
    console.log(`   Suggested categories:`);
    console.log(`   - General-Core (tone, persona, basic rules) ~1000 chars`);
    console.log(`   - General-Medical (medical disclaimers) ~500 chars`);
    console.log(`   - General-Sales (closing techniques) ~500 chars`);
  }
}

analyzeGeneral().catch(console.error);
