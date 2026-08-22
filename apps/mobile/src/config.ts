/**
 * App-level config. Expo inlines `EXPO_PUBLIC_*` env vars at build time — no
 * app.config.js or expo-constants plumbing needed. Put the real key in a
 * local `.env` (git-ignored); `.env.example` documents the shape.
 */

/** Single point of truth for which Gemini model the Money Coach calls. */
export const GEMINI_MODEL_ID = 'gemini-3.1-flash-lite';

export const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';

export const hasGeminiKey = GEMINI_API_KEY.length > 0;
