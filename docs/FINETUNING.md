# Fine-tuning Guide: Train GPT-4o-mini with Clinic Knowledge

## Overview
Fine-tuning จะทำให้ AI มีความรู้ของคลินิกฝังอยู่ในตัวโมเดล ไม่ต้องส่ง context ทุกครั้ง

## Benefits
- ✅ ประหยัด tokens ~70-80% (ไม่ต้องส่ง knowledge context)
- ✅ เร็วขึ้น (context สั้นลง)
- ✅ AI ตอบได้แม่นยำกว่า (ความรู้ฝังในโมเดล)
- ✅ รองรับ knowledge ได้มากขึ้น

## Cost Estimate
- Training: ~$3-8 USD (ขึ้นกับจำนวน knowledge)
- API usage: เท่าเดิม ($0.15/$0.60 per 1M tokens)
- ROI: คุ้มค่าถ้าใช้งาน >1000 messages/month

## Steps

### 1. Prepare Training Data
```bash
npx tsx scripts/prepare-finetune-data.ts
```

Output: `finetune-data.jsonl` (~20-50 KB)

### 2. Upload & Start Training
```bash
npx tsx scripts/upload-finetune.ts
```

จะได้ Job ID สำหรับติดตามสถานะ

### 3. Monitor Progress (1-2 hours)
```bash
# Check specific job
npx tsx scripts/check-finetune-status.ts <job-id>

# List all jobs
npx tsx scripts/check-finetune-status.ts
```

### 4. Use Fine-tuned Model

เมื่อ training เสร็จ จะได้ model name เช่น: `ft:gpt-4o-mini-2024-07-18:org:custom:abc123`

แก้ไขใน `lib/ai/agent.ts`:
```typescript
const completion = await openaiClient.chat.completions.create({
  model: 'ft:gpt-4o-mini-2024-07-18:org:custom:abc123', // ← เปลี่ยนที่นี่
  messages: [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage }
  ],
  temperature: 0.7,
  max_tokens: 500,
});
```

**ไม่ต้องส่ง context แล้ว!** AI รู้อยู่แล้ว 🎉

## Testing

หลัง fine-tune เสร็จ ทดสอบโดย:
1. Deploy code ใหม่
2. ถามคำถามเกี่ยวกับ Hutox, ราคา, โปรโมชั่น
3. ตรวจสอบ token usage (ควรลดลง 70-80%)

## Re-training

เมื่อมี knowledge ใหม่:
```bash
# 1. Re-export data
npx tsx scripts/prepare-finetune-data.ts

# 2. Upload & train
npx tsx scripts/upload-finetune.ts

# 3. Update model name ใน agent.ts
```

## Notes
- Fine-tuned model จะหมดอายุหลัง 90 วันไม่ใช้งาน
- สามารถ train ใหม่ได้ไม่จำกัด
- แนะนำ re-train ทุก 1-2 เดือนเมื่อมีข้อมูลใหม่
