export type Platform = 'line' | 'facebook' | 'instagram' | 'tiktok';
export type SenderType = 'user' | 'ai' | 'agent';
export type ContentType = 'text' | 'image' | 'sticker';
export type ConversationStatus = 'active' | 'archived';

export interface Customer {
  id: string;
  full_name: string | null;
  phone_number: string | null;
  crm_tags: string[];
  skin_concerns: string[];
  created_at: string;
}

export interface SocialIdentity {
  id: string;
  customer_id: string;
  platform: Platform;
  platform_user_id: string;
  profile_name: string | null;
  avatar_url: string | null;
}

export interface Conversation {
  id: string;
  social_identity_id: string;
  status: ConversationStatus;
  ai_mode: boolean;
  last_message_at: string;
  created_at: string;
  // Included for convenience in UI
  customer?: Customer;
  identity?: SocialIdentity;
  unread_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_type: SenderType;
  content_type: ContentType;
  content: string;
  raw_payload?: any;
  created_at: string;
}

export interface NormalizedPayload {
  platform: Platform;
  platformUserId: string;
  messageId: string;
  timestamp: number;
  type: ContentType;
  text?: string;
  imageUrl?: string;
  stickerId?: string;
  raw: any;
  userProfile?: {
    displayName: string;
    pictureUrl: string;
  }
}

export interface AIResponse {
  message: string;
  shouldEscalate: boolean; // Turn off AI mode?
  confidence: number;
}
