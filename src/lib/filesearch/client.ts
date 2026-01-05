/**
 * Shared GoogleGenAI client for File Search operations
 */

import { GoogleGenAI } from "@google/genai";

let clientInstance: GoogleGenAI | null = null;

export function getGenAIClient(): GoogleGenAI {
  if (!clientInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    clientInstance = new GoogleGenAI({ apiKey });
  }
  return clientInstance;
}
