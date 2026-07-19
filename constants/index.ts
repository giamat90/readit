// Keep in sync with tailwind.config.js
export const COLORS = {
  primary: "#4F46E5",
  secondary: "#818CF8",
  paper: "#FAF7F0",
  ink: "#1E1E2E",
  muted: "#6B7280",
  danger: "#D32F2F",
  warning: "#F57C00",
  success: "#2E7D32",
} as const;

export const CONFIG = {
  // Target chunk size in characters; chunking splits on paragraph/sentence
  // boundaries so real chunks land near (not exactly at) this size
  CHUNK_SIZE: 1000,
  RATE_MIN: 0.5,
  RATE_MAX: 2.0,
  RATE_DEFAULT: 1.0,
} as const;
