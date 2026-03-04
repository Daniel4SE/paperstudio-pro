import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const LOCAL_AUTH_ENDPOINT = "/api/local-auth/google-key";
const LOCAL_STORAGE_GOOGLE_KEY = "paperstudio.provider.google.api-key";

let cachedGeminiKey: string | null = null;
let cachedClient: GoogleGenAI | null = null;

const readBundledGeminiKey = (): string => {
  const env = (globalThis as any)?.process?.env || {};
  return env.API_KEY || env.GEMINI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY || "";
};

const readStoredGeminiKey = (): string => {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(LOCAL_STORAGE_GOOGLE_KEY) || "";
  } catch {
    return "";
  }
};

const writeStoredGeminiKey = (value?: string) => {
  if (typeof window === "undefined") return;
  try {
    if (value?.trim()) {
      localStorage.setItem(LOCAL_STORAGE_GOOGLE_KEY, value.trim());
    } else {
      localStorage.removeItem(LOCAL_STORAGE_GOOGLE_KEY);
    }
  } catch {
    // ignore storage errors
  }
};

const fetchGeminiKeyFromLocalAuth = async (): Promise<string> => {
  try {
    const res = await fetch(LOCAL_AUTH_ENDPOINT, { method: "GET", credentials: "same-origin" });
    if (!res.ok) return "";
    const data = await res.json();
    return typeof data?.key === "string" ? data.key.trim() : "";
  } catch {
    return "";
  }
};

const resolveGeminiKey = async (): Promise<string> => {
  if (cachedGeminiKey?.trim()) return cachedGeminiKey.trim();

  const bundled = readBundledGeminiKey().trim();
  if (bundled) {
    cachedGeminiKey = bundled;
    return bundled;
  }

  const stored = readStoredGeminiKey().trim();
  if (stored) {
    cachedGeminiKey = stored;
    return stored;
  }

  const fromAuth = await fetchGeminiKeyFromLocalAuth();
  if (fromAuth) {
    cachedGeminiKey = fromAuth;
    writeStoredGeminiKey(fromAuth);
    return fromAuth;
  }

  return "";
};

const getGeminiClient = async (): Promise<GoogleGenAI> => {
  if (cachedClient) return cachedClient;
  const key = await resolveGeminiKey();
  if (!key) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please connect Google in OpenCode Providers (auth.json -> "google.key").',
    );
  }
  cachedClient = new GoogleGenAI({ apiKey: key });
  return cachedClient;
};

export const setGeminiApiKey = (apiKey?: string) => {
  const next = apiKey?.trim() || "";
  cachedGeminiKey = next || null;
  cachedClient = null;
  writeStoredGeminiKey(next || undefined);
};

// Retry wrapper with exponential backoff
const retryWrapper = async <T>(fn: () => Promise<T>, retries = 3, initialDelay = 2000): Promise<T> => {
  let currentDelay = initialDelay;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const isTransient = error.status === 429 || error.status === 503 || 
                          error.message?.includes('429') || error.message?.includes('Quota') ||
                          error.message?.includes('503');
      
      if (i === retries - 1 || !isTransient) {
        throw error;
      }
      
      console.warn(`API Busy/Rate Limit. Retrying in ${currentDelay}ms... (Attempt ${i + 1}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, currentDelay));
      currentDelay *= 2;
    }
  }
  throw new Error("Max retries reached");
};

/**
 * Text-to-image generation using Gemini.
 * Triggered via @image in chat. Returns base64 data URL and optional text description.
 */
export const generateImage = async (prompt: string): Promise<{ imageData: string | null; text: string }> => {
  const ai = await getGeminiClient();
  try {
    console.log('[geminiService] generateImage called with prompt:', prompt.slice(0, 100) + '...');
    const response = await retryWrapper<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        temperature: 1,
        responseModalities: ['image', 'text'],
        tools: [{ googleSearch: {} }],
        imageConfig: {
          aspectRatio: '16:9',
          imageSize: '4K',
        },
      },
    }));

    let imageData: string | null = null;
    let text = '';

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        imageData = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
      if (part.text) {
        text += part.text;
      }
    }

    return { imageData, text };
  } catch (error) {
    console.error("Image Generation Error:", error);
    throw error;
  }
};

/**
 * AI image editing using Gemini (image generation model).
 * This is the ONLY function using Gemini — all text tasks use Claude.
 */
export const editImage = async (base64Data: string, mimeType: string, prompt: string): Promise<string | null> => {
  const ai = await getGeminiClient();
  try {
    const response = await retryWrapper<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data.split(',')[1], 
              mimeType: mimeType, 
            },
          },
          {
            text: `Edit instruction: ${prompt}`,
          },
        ],
      },
      config: {
        temperature: 1,
        responseModalities: ['image', 'text'],
        tools: [{ googleSearch: {} }],
        imageConfig: {
          aspectRatio: '16:9',
          imageSize: '4K',
        },
      },
    }));

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Image Edit Error:", error);
    throw error;
  }
};
