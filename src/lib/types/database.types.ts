// src/lib/types/database.types.ts

export interface Database {
  public: {
    Tables: {
      conversations: {
        Row: {
          id: string;
          business_id: string;
          customer_chat_id: string;
          intent: string;
          status: 'ai' | 'human' | 'escalated';
          state: any;
          history: any[];
          platform: string | null;
          notes: string | null;
          tags: string[];
          last_message_at: string;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          customer_chat_id: string;
          intent: string;
          status?: 'ai' | 'human' | 'escalated';
          state?: any;
          history?: any[];
          platform?: string | null;
          notes?: string | null;
          tags?: string[];
          last_message_at?: string;
          created_at?: string;
          expires_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          customer_chat_id?: string;
          intent?: string;
          status?: 'ai' | 'human' | 'escalated';
          state?: any;
          history?: any[];
          platform?: string | null;
          notes?: string | null;
          tags?: string[];
          last_message_at?: string;
          created_at?: string;
          expires_at?: string;
        };
      };
      businesses: {
        Row: {
          id: string;
          name: string;
          is_active: boolean;
          user_id?: string | null;
          telegram_bot_token?: string | null;
          fb_page_id?: string | null;
          fb_page_access_token?: string | null;
          fb_page_name?: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          is_active?: boolean;
          user_id?: string | null;
          telegram_bot_token?: string | null;
          fb_page_id?: string | null;
          fb_page_access_token?: string | null;
          fb_page_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          is_active?: boolean;
          user_id?: string | null;
          telegram_bot_token?: string | null;
          fb_page_id?: string | null;
          fb_page_access_token?: string | null;
          fb_page_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          password_hash: string;
          name: string;
          role: 'admin' | 'business';
          business_id?: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          password_hash: string;
          name: string;
          role?: 'admin' | 'business';
          business_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          password_hash?: string;
          name?: string;
          role?: 'admin' | 'business';
          business_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      request_queue: {
        Row: {
          id: string;
          business_id: string;
          raw_payload: any;
          status: 'pending' | 'processing' | 'completed' | 'failed';
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          raw_payload: any;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          raw_payload?: any;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          created_at?: string;
        };
      };
      // ... other tables
    };
  };
}
