// lib/infrastructure/llm-adapter.ts
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Provider selection strategy
type Provider = 'openai' | 'gemini' | 'openrouter';

function getActiveProvider(): Provider {
  // Priority: OpenAI > OpenRouter > Gemini (fallback)
  if (process.env.OPENAI_API_KEY && process.env.USE_GEMINI_FOR_DEV !== 'true') {
    return 'openai';
  }
  if (process.env.OPENROUTER_API_KEY && process.env.USE_OPENROUTER === 'true') {
    return 'openrouter';
  }
  if (process.env.GOOGLE_API_KEY) {
    return 'gemini';
  }
  throw new Error('No AI provider configured');
}

// OpenAI Client (for production)
const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set');
  }
  
  const useOpenRouter = process.env.USE_OPENROUTER === 'true';
  return new OpenAI({
    apiKey: useOpenRouter ? process.env.OPENROUTER_API_KEY : apiKey,
    baseURL: useOpenRouter ? 'https://openrouter.ai/api/v1' : undefined,
  });
};

// Gemini Client (for development)
const getGeminiClient = () => {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY not set');
  }
  return new GoogleGenerativeAI(apiKey);
};

// Unified interface for both providers
export const llm = {
  activeProvider: getActiveProvider(),
  
  // Chat completions (unified)
  chat: {
    completions: {
      create: async (params: {
        model: string;
        messages: Array<{ role: string; content: string }>;
        max_tokens?: number;
        temperature?: number;
      }) => {
        const provider = getActiveProvider();
        
        if (provider === 'gemini') {
          console.log('[LLM] Using Gemini (dev mode)');
          const gemini = getGeminiClient();
          
          // Use gemini-2.5-flash which is available in free tier
          const geminiModel = 'gemini-2.5-flash';
          
          const model = gemini.getGenerativeModel({ model: geminiModel });
          
          // Convert messages to Gemini format
          const prompt = params.messages
            .map(m => `${m.role}: ${m.content}`)
            .join('\n\n');
          
          const result = await model.generateContent(prompt);
          const response = result.response;
          const text = response.text();
          
          // Return OpenAI-compatible format
          return {
            choices: [
              {
                message: {
                  role: 'assistant' as const,
                  content: text,
                },
              },
            ],
            usage: {
              prompt_tokens: Math.ceil(prompt.length / 4),
              completion_tokens: Math.ceil(text.length / 4),
              total_tokens: Math.ceil((prompt.length + text.length) / 4),
            },
          };
        }
        
        // OpenAI/OpenRouter
        const openai = getOpenAIClient();
        return await openai.chat.completions.create(params as any);
      },
    },
  },
  
  // Embeddings (unified)
  embeddings: {
    create: async (params: { model: string; input: string }) => {
      const provider = getActiveProvider();
      
      if (provider === 'gemini') {
        console.log('[LLM] Using Gemini embeddings (dev mode)');
        const gemini = getGeminiClient();
        const model = gemini.getGenerativeModel({ model: 'text-embedding-004' });
        
        const result = await model.embedContent(params.input);
        const embedding = result.embedding.values;
        
        // Return OpenAI-compatible format
        return {
          data: [{ embedding: embedding }],
          usage: {
            total_tokens: Math.ceil(params.input.length / 4),
          },
        };
      }
      
      // OpenAI/OpenRouter
      const openai = getOpenAIClient();
      return await openai.embeddings.create(params as any);
    },
  },
};

// Helper to get provider info
export function getProviderInfo() {
  const provider = getActiveProvider();
  return {
    provider,
    isProduction: provider === 'openai' || provider === 'openrouter',
    isDevelopment: provider === 'gemini',
  };
}

console.log('[LLM] Active provider:', getActiveProvider());