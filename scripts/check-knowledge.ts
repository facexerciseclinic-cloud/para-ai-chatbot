/**
 * Script: Check Knowledge Base and AI Settings
 * 
 * This script checks:
 * 1. AI Settings status
 * 2. Knowledge base with embedding status
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkData() {
  console.log('🔍 Checking AI Settings...\n');
  
  // Check AI Settings
  const { data: settings, error: settingsError } = await supabase
    .from('ai_settings')
    .select('key, value')
    .order('key');
  
  if (settingsError) {
    console.error('❌ Error fetching settings:', settingsError);
  } else {
    console.log('⚙️ Current AI Settings:');
    settings?.forEach(s => {
      console.log(`   ${s.key}: ${JSON.stringify(s.value)}`);
    });
  }
  
  console.log('\n📚 Checking Knowledge Base...\n');
  
  // Check knowledge with embedding status
  const { data: knowledge, error: knowledgeError } = await supabase
    .from('knowledge_base')
    .select('id, category, content, embedding, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (knowledgeError) {
    console.error('❌ Error fetching knowledge:', knowledgeError);
  } else {
    console.log(`📊 Total items checked: ${knowledge?.length || 0}\n`);
    
    let withEmbedding = 0;
    let withoutEmbedding = 0;
    
    knowledge?.forEach((item, index) => {
      const hasEmbedding = item.embedding !== null;
      if (hasEmbedding) withEmbedding++;
      else withoutEmbedding++;
      
      const status = hasEmbedding ? '✅' : '❌';
      const preview = item.content.substring(0, 80).replace(/\n/g, ' ');
      
      console.log(`${index + 1}. ${status} [${item.category}] ${preview}...`);
      console.log(`   Created: ${new Date(item.created_at).toLocaleString()}`);
      console.log(`   Embedding: ${hasEmbedding ? 'YES' : 'NO'}\n`);
    });
    
    console.log('\n📈 Summary:');
    console.log(`   ✅ With embedding: ${withEmbedding}`);
    console.log(`   ❌ Without embedding: ${withoutEmbedding}`);
    
    if (withoutEmbedding > 0) {
      console.log('\n⚠️  WARNING: Some knowledge items are missing embeddings!');
      console.log('   These items will NOT be searchable by the AI.');
      console.log('   The embedding should be generated automatically when adding knowledge.');
    }
  }
}

checkData().catch(console.error);
