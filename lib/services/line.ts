import { NormalizedPayload } from '@/types';

export const LineService = {
  async parseWebhook(body: any): Promise<NormalizedPayload[]> {
    // Logic to parse LINE webhook events
    // LINE usually sends an array of events
    const events = body.events || [];
    const results: NormalizedPayload[] = [];

    for (const event of events) {
      if (event.type === 'message') {
        results.push({
          platform: 'line',
          platformUserId: event.source.userId,
          messageId: event.message.id,
          timestamp: event.timestamp,
          type: event.message.type === 'image' ? 'image' : 'text',
          text: event.message.text,
          imageUrl: event.message.type === 'image' ? 'https://line-api-content...' : undefined, // Placeholder
          raw: event,
        });
      }
    }
    return results;
  },

  async verifySignature(signature: string, body: string): Promise<boolean> {
    // Implementation needed
    return true;
  },

  async replyMessage(replyToken: string, text: string) {
    // Call LINE API
  },
  
  async pushMessage(userId: string, text: string) {
     // Call LINE API
  }
};
