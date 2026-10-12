import dotenv from 'dotenv';
import path from 'path';

// Load .env from workspace root or current directory
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  APP_URL: (process.env.APP_URL || 'https://urgrowup.com').replace(/\/$/, ''),
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://doorbell_user:doorbell_secure_pass_2026@localhost:5432/doorbell_db?schema=public',
  JWT_SECRET: process.env.JWT_SECRET || 'dev_secret_urgrowup_doorbell_webrtc_token_key_2026',
  TOKEN_EXPIRES_IN_SECONDS: parseInt(process.env.TOKEN_EXPIRES_IN_SECONDS || '600', 10), // 10 minutes
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_DEFAULT_CHAT_ID: process.env.TELEGRAM_DEFAULT_CHAT_ID || '',
  CALL_TIMEOUT_SECONDS: parseInt(process.env.CALL_TIMEOUT_SECONDS || '45', 10),
  RATE_LIMIT_MAX_CALLS: parseInt(process.env.RATE_LIMIT_MAX_CALLS || '2', 10),
  RATE_LIMIT_WINDOW_SECONDS: parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS || '60', 10),
  STUN_SERVER_URL: process.env.STUN_SERVER_URL || 'stun:stun.l.google.com:19302',
};

// Allowed CORS origins
export const ALLOWED_ORIGINS = [
  ENV.APP_URL,
  'https://urgrowup.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];
