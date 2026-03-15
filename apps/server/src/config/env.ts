import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Try multiple .env locations (server-local first, then monorepo root)
// Works from both src/ (dev with tsx) and dist/ (production with node)
const envPaths = [
    path.resolve(process.cwd(), 'apps/server/.env'), // monorepo root cwd
    path.resolve(process.cwd(), '.env'),              // server cwd (when cd into apps/server)
    path.resolve(__dirname, '../../.env'),             // relative to src/config or dist/config
    path.resolve(__dirname, '../../../../.env'),       // monorepo root from src/config
];

for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
        console.log(`📁 Loaded .env from: ${envPath}`);
        break;
    }
}

export const env = {
    // Server
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '3001', 10),
    CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',

    // Database
    DATABASE_URL: process.env.DATABASE_URL || '',

    // Redis
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

    // Auth
    JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

    // Encryption (BYOK)
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'dev-encryption-key-change-me-now!',

    // mediasoup
    MEDIASOUP_LISTEN_IP: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0',
    MEDIASOUP_ANNOUNCED_IP: process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1',
    MEDIASOUP_MIN_PORT: parseInt(process.env.MEDIASOUP_MIN_PORT || '40000', 10),
    MEDIASOUP_MAX_PORT: parseInt(process.env.MEDIASOUP_MAX_PORT || '49999', 10),

    // LLM Provider fallback keys (optional)
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
    GROQ_API_KEY: process.env.GROQ_API_KEY || '',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || '',
    TOGETHER_API_KEY: process.env.TOGETHER_API_KEY || '',

    // Email (SMTP)
    SMTP_HOST: process.env.SMTP_HOST || '',
    SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
    SMTP_USER: process.env.SMTP_USER || '',
    SMTP_PASS: process.env.SMTP_PASS || '',
    SMTP_FROM: process.env.SMTP_FROM || '',
} as const;

// Validate critical environment variables
export function validateEnv(): void {
    const errors: string[] = [];

    if (!env.DATABASE_URL) {
        errors.push('DATABASE_URL is required');
    }
    if (env.JWT_SECRET === 'dev-secret-change-me' && env.NODE_ENV === 'production') {
        errors.push('JWT_SECRET must be changed in production');
    }
    if (env.ENCRYPTION_KEY === 'dev-encryption-key-change-me-now!' && env.NODE_ENV === 'production') {
        errors.push('ENCRYPTION_KEY must be changed in production');
    }

    if (errors.length > 0) {
        console.error('❌ Environment validation failed:');
        errors.forEach((e) => console.error(`   - ${e}`));
        if (env.NODE_ENV === 'production') {
            process.exit(1);
        }
    }
}
