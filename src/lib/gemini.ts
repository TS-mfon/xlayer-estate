import { GoogleGenerativeAI } from "@google/generative-ai";

/** Returns a configured Gemini client, or null when no API key is set. */
export function getGenAI(): GoogleGenerativeAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenerativeAI(key);
}
