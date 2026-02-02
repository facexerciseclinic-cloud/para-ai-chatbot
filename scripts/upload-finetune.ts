/**
 * Script: Upload Fine-tuning Data to OpenAI
 * 
 * This script uploads the prepared JSONL file to OpenAI and creates a fine-tuning job.
 * 
 * Usage:
 *   npx tsx scripts/upload-finetune.ts
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

async function uploadAndFinetune() {
  const filePath = path.join(process.cwd(), 'finetune-data.jsonl');
  
  if (!fs.existsSync(filePath)) {
    console.error('❌ finetune-data.jsonl not found!');
    console.log('   Run: npx tsx scripts/prepare-finetune-data.ts first');
    process.exit(1);
  }
  
  console.log('📤 Step 1: Uploading training file to OpenAI...');
  
  const file = await openai.files.create({
    file: fs.createReadStream(filePath),
    purpose: 'fine-tune'
  });
  
  console.log(`✅ File uploaded: ${file.id}`);
  
  console.log('\n🚀 Step 2: Creating fine-tuning job...');
  
  const fineTune = await openai.fineTuning.jobs.create({
    training_file: file.id,
    model: 'gpt-4o-mini-2024-07-18',
    hyperparameters: {
      n_epochs: 3 // Adjust based on data size
    }
  });
  
  console.log(`✅ Fine-tuning job created: ${fineTune.id}`);
  console.log(`   Status: ${fineTune.status}`);
  
  console.log('\n⏳ Training in progress...');
  console.log('   This will take 1-2 hours depending on data size.');
  console.log('\n📝 Monitor progress:');
  console.log(`   Job ID: ${fineTune.id}`);
  console.log('   Dashboard: https://platform.openai.com/finetune');
  
  console.log('\n💡 Check status with:');
  console.log(`   npx tsx scripts/check-finetune-status.ts ${fineTune.id}`);
}

uploadAndFinetune().catch(console.error);
