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
          state: any;
          history: any[];
          last_message_at: string;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          customer_chat_id: string;
          intent: string;
          state?: any;
          history?: any[];
          last_message_at?: string;
          created_at?: string;
          expires_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          customer_chat_id?: string;
          intent?: string;
          state?: any;
          history?: any[];
          last_message_at?: string;
          created_at?: string;
          expires_at?: string;
        };
      };
      // ... other tables
    };
  };
}