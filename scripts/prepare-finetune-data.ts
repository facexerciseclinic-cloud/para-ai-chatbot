/**
 * Script: Prepare Fine-tuning Data for OpenAI
 * 
 * This script exports knowledge base to JSONL format for GPT-4o-mini fine-tuning.
 * 
 * Usage:
 *   npx tsx scripts/prepare-finetune-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SYSTEM_MESSAGE = `You are "Aesthetic Consultant", an expert AI assistant for an aesthetic clinic in Thailand.
Your goal is to provide helpful information about beauty procedures, prices, and promotions.
Tone: Professional, Friendly, Empathetic, and Trustworthy (Medical Grade).

Key rules:
1. DO NOT diagnose medical conditions. If a user asks for medical advice, recommend chatting with a real doctor/staff.
2. Focus on closing sales or booking appointments.
3. Always speak Thai language naturally.
4. Be concise but informative.`;

interface TrainingExample {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
}

async function generateTrainingData() {
  console.log('🔍 Fetching knowledge base from Supabase...');
  
  const { data: knowledge, error } = await supabase
    .from('knowledge_base')
    .select('content, category')
    .not('embedding', 'is', null);
  
  if (error) {
    console.error('❌ Error fetching knowledge:', error);
    process.exit(1);
  }
  
  console.log(`✅ Loaded ${knowledge.length} knowledge items`);
  
  // Generate training examples
  const trainingExamples: TrainingExample[] = [];
  
  // Group by category
  const categories = {
    General: knowledge.filter(k => k.category === 'General'),
    Price: knowledge.filter(k => k.category === 'Price'),
    Procedure: knowledge.filter(k => k.category === 'Procedure'),
    Promotion: knowledge.filter(k => k.category === 'Promotion'),
  };
  
  console.log('\n📊 Knowledge distribution:');
  Object.entries(categories).forEach(([cat, items]) => {
    console.log(`   ${cat}: ${items.length} items`);
  });
  
  // Generate Q&A pairs for each knowledge item
  console.log('\n🤖 Generating training examples...');
  
  for (const item of knowledge) {
    // Create variations of questions
    const examples = generateQAPairs(item.content, item.category);
    trainingExamples.push(...examples);
  }
  
  console.log(`✅ Generated ${trainingExamples.length} training examples`);
  
  // Save to JSONL file
  const outputPath = path.join(process.cwd(), 'finetune-data.jsonl');
  const jsonlContent = trainingExamples
    .map(ex => JSON.stringify(ex))
    .join('\n');
  
  fs.writeFileSync(outputPath, jsonlContent, 'utf-8');
  console.log(`\n💾 Saved to: ${outputPath}`);
  console.log(`📦 File size: ${(jsonlContent.length / 1024).toFixed(2)} KB`);
  
  // Show statistics
  console.log('\n📈 Training Statistics:');
  console.log(`   Total examples: ${trainingExamples.length}`);
  console.log(`   Estimated tokens: ~${(jsonlContent.length / 4).toLocaleString()}`);
  console.log(`   Estimated cost: $${((jsonlContent.length / 4 / 1_000_000) * 8).toFixed(2)} USD`);
  
  console.log('\n✅ Data preparation complete!');
  console.log('\n📝 Next steps:');
  console.log('   1. Upload to OpenAI: https://platform.openai.com/finetune');
  console.log('   2. Create fine-tuning job');
  console.log('   3. Wait for completion (~1-2 hours)');
  console.log('   4. Update model name in agent.ts');
}

function generateQAPairs(content: string, category: string): TrainingExample[] {
  const examples: TrainingExample[] = [];
  
  // Extract key information
  const lines = content.split('\n').filter(line => line.trim());
  
  // Generate different question styles
  if (category === 'Price') {
    examples.push({
      messages: [
        { role: 'system', content: SYSTEM_MESSAGE },
        { role: 'user', content: extractQuestion(content, 'ราคา') },
        { role: 'assistant', content: content }
      ]
    });
  } else if (category === 'Procedure') {
    examples.push({
      messages: [
        { role: 'system', content: SYSTEM_MESSAGE },
        { role: 'user', content: extractQuestion(content, 'ขั้นตอน') },
        { role: 'assistant', content: content }
      ]
    });
  } else if (category === 'Promotion') {
    examples.push({
      messages: [
        { role: 'system', content: SYSTEM_MESSAGE },
        { role: 'user', content: extractQuestion(content, 'โปรโมชั่น') },
        { role: 'assistant', content: content }
      ]
    });
  } else if (category === 'General') {
    examples.push({
      messages: [
        { role: 'system', content: SYSTEM_MESSAGE },
        { role: 'user', content: 'คุณช่วยแนะนำเกี่ยวกับบริการของคลินิกได้ไหม' },
        { role: 'assistant', content: content }
      ]
    });
  }
  
  return examples;
}

function extractQuestion(content: string, type: string): string {
  // Extract service/product name from content
  const firstLine = content.split('\n')[0];
  const productName = firstLine.match(/[^\s]+/)?.[0] || 'บริการ';
  
  const questions = {
    'ราคา': [
      `${productName} ราคาเท่าไหร่คะ`,
      `บอกราคา${productName}หน่อย`,
      `อยากรู้ราคา${productName}`,
    ],
    'ขั้นตอน': [
      `${productName} ทำยังไงบ้างคะ`,
      `ขั้นตอนการทำ${productName}เป็นอย่างไร`,
      `อธิบายวิธีการทำ${productName}หน่อย`,
    ],
    'โปรโมชั่น': [
      `มีโปรโมชั่นอะไรบ้าง`,
      `ช่วงนี้มีโปรอะไรไหม`,
      `มีส่วนลดไหมคะ`,
    ],
  };
  
  const options = questions[type as keyof typeof questions] || [`บอกข้อมูลเกี่ยวกับ${productName}`];
  return options[Math.floor(Math.random() * options.length)];
}

// Run the script
generateTrainingData().catch(console.error);
