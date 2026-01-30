/**
 * Script: Check Fine-tuning Status
 * 
 * Usage:
 *   npx tsx scripts/check-finetune-status.ts <job-id>
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

async function checkStatus(jobId?: string) {
  if (!jobId) {
    console.log('📋 Listing all fine-tuning jobs...\n');
    const jobs = await openai.fineTuning.jobs.list({ limit: 10 });
    
    jobs.data.forEach(job => {
      console.log(`Job ID: ${job.id}`);
      console.log(`  Model: ${job.model}`);
      console.log(`  Status: ${job.status}`);
      console.log(`  Created: ${new Date(job.created_at * 1000).toLocaleString()}`);
      if (job.fine_tuned_model) {
        console.log(`  ✅ Fine-tuned Model: ${job.fine_tuned_model}`);
      }
      console.log('');
    });
    
    return;
  }
  
  console.log(`🔍 Checking status for job: ${jobId}\n`);
  
  const job = await openai.fineTuning.jobs.retrieve(jobId);
  
  console.log(`Status: ${job.status}`);
  console.log(`Model: ${job.model}`);
  console.log(`Created: ${new Date(job.created_at * 1000).toLocaleString()}`);
  
  if (job.finished_at) {
    console.log(`Finished: ${new Date(job.finished_at * 1000).toLocaleString()}`);
  }
  
  if (job.fine_tuned_model) {
    console.log(`\n✅ Fine-tuned Model Ready: ${job.fine_tuned_model}`);
    console.log('\n📝 Update your agent.ts:');
    console.log(`   model: '${job.fine_tuned_model}'`);
  } else if (job.status === 'running') {
    console.log('\n⏳ Training in progress...');
  } else if (job.status === 'failed') {
    console.log('\n❌ Training failed!');
    console.log(`   Error: ${job.error?.message}`);
  }
}

const jobId = process.argv[2];
checkStatus(jobId).catch(console.error);
