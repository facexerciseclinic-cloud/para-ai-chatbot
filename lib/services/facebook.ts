import { NormalizedPayload } from '@/types';

export const FacebookService = {
  async parseWebhook(body: any): Promise<NormalizedPayload[]> {
    // Facebook/Messenger webhook structure
    const results: NormalizedPayload[] = [];
    
    if (body.object === 'page') {
      for (const entry of body.entry) {
        for (const messaging of entry.messaging) {
          if (messaging.message) {
             results.push({
               platform: 'facebook',
               platformUserId: messaging.sender.id,
               messageId: messaging.message.mid,
               timestamp: messaging.timestamp,
               type: messaging.message.attachments ? 'image' : 'text',
               text: messaging.message.text,
               imageUrl: messaging.message.attachments?.[0]?.payload?.url,
               raw: messaging
             });
          }
        }
      }
    }
    return results;
  },
  
  async sendText(recipientId: string, text: string) {
    // Call Graph API
  }
};
