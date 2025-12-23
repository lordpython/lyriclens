/**
 * Supported languages for subtitle translation.
 * Used in the translation dropdown selector.
 */
export const LANGUAGES = [
  "Spanish",
  "French",
  "German",
  "Japanese",
  "Korean",
  "Chinese",
  "Hindi",
  "Italian",
  "Portuguese",
  "English",
  "Arabic",
] as const;

export type Language = (typeof LANGUAGES)[number];
