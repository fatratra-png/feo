import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

const list = (...values: (string | undefined)[]) =>
  [...new Set(values.filter((v): v is string => Boolean(v && v.trim())))];

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim(),
  /** Allowed browser origins (comma-separated FRONTEND_URL); Expo web is allowed in development. */
  corsOrigins: [
    ...(process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map((o) => o.trim()).filter(Boolean),
    ...((process.env.NODE_ENV || 'development') === 'development' ? ['http://localhost:8081', 'http://localhost:19006'] : []),
  ],
  databaseUrl: required('DATABASE_URL'),
  migrationDatabaseUrl: process.env.DATABASE_URL_UNPOOLED || required('DATABASE_URL'),
  jwt: {
    secret: required('JWT_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessExpiry: '15m',
    refreshDays: 30,
  },
  /** Public URL of this API, used to build OAuth callback URLs (Render sets RENDER_EXTERNAL_URL). */
  publicApiUrl: (process.env.PUBLIC_API_URL
    || (process.env.RENDER_EXTERNAL_URL ? `${process.env.RENDER_EXTERNAL_URL}/api` : `http://localhost:${process.env.PORT || '3001'}/api`)).replace(/\/$/, ''),
  oauth: {
    google: { clientId: process.env.GOOGLE_CLIENT_ID || '', clientSecret: process.env.GOOGLE_CLIENT_SECRET || '' },
    github: { clientId: process.env.GITHUB_CLIENT_ID || '', clientSecret: process.env.GITHUB_CLIENT_SECRET || '' },
    /** Deep link the mobile app listens on after an OAuth login. */
    mobileRedirect: process.env.MOBILE_OAUTH_REDIRECT || 'feo://auth',
  },
  mail: {
    /** Resend (https://resend.com) API key. Without it, emails are printed to the logs instead. */
    resendApiKey: process.env.RESEND_API_KEY || '',
    from: process.env.MAIL_FROM || 'FEO <onboarding@resend.dev>',
  },
  ai: {
    baseUrl: (process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, ''),
    apiKey: process.env.LLM_API_KEY || '',
    /** Ordered chain: the "smart" models are tried first, then the fallbacks. */
    models: list(
      process.env.AI_MODEL,
      process.env.AI_FALLBACK_MODEL,
      process.env.AI_MODEL_FAST,
      process.env.AI_MODEL_ALT,
    ),
    fallbackModel: process.env.AI_FALLBACK_MODEL,
    fastModel: process.env.AI_MODEL_FAST,
    altModel: process.env.AI_MODEL_ALT,
    timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '45000', 10),
    dailyLimitPerUser: parseInt(process.env.AI_DAILY_LIMIT_PER_USER || '60', 10),
  },
};

export const aiEnabled = () => Boolean(config.ai.apiKey && config.ai.models.length);
