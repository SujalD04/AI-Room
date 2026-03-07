import { LLMProvider } from '@airoom/shared';
import { prisma } from '../../lib/prisma';
import { decryptApiKey } from '../crypto';
import { env } from '../../config/env';

/**
 * Unified LLM Gateway
 *
 * Routes requests to the appropriate provider, resolves API keys
 * (user BYOK keys or system fallback), and provides a uniform
 * streaming interface across all providers.
 */

export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface LLMRequestOptions {
    model: string;
    provider: LLMProvider;
    messages: LLMMessage[];
    temperature?: number;
    maxTokens?: number;
    userId: string; // for BYOK key resolution
}

export interface LLMStreamCallbacks {
    onToken: (token: string) => void;
    onDone: (metadata: { tokensUsed?: number; latencyMs?: number }) => void;
    onError: (error: string) => void;
}

/**
 * Resolve the API key for a given user and provider.
 * Priority: user's BYOK key > system fallback key
 */
async function resolveApiKey(userId: string, provider: LLMProvider): Promise<string | null> {
    // Try user's BYOK key first
    const userKey = await prisma.apiKey.findFirst({
        where: { userId, provider: provider as any },
        orderBy: { createdAt: 'desc' },
    });

    if (userKey) {
        try {
            return decryptApiKey(userKey.encryptedKey!, userKey.iv!, userKey.authTag!);
        } catch (err) {
            console.error(`Failed to decrypt key for user ${userId}, provider ${provider}:`, err);
        }
    }

    // Fallback to system keys
    const systemKeyMap: Record<LLMProvider, string> = {
        openrouter: env.OPENROUTER_API_KEY,
        groq: env.GROQ_API_KEY,
        google: env.GEMINI_API_KEY,
        openai: env.OPENAI_API_KEY,
        anthropic: env.ANTHROPIC_API_KEY,
        deepseek: env.DEEPSEEK_API_KEY,
        together: env.TOGETHER_API_KEY,
    };

    return systemKeyMap[provider] || null;
}

/**
 * Provider-specific endpoint and header configuration.
 */
const PROVIDER_CONFIG: Record<LLMProvider, { baseUrl: string; authHeader: (key: string) => Record<string, string> }> = {
    openrouter: {
        baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
        authHeader: (key) => ({
            'Authorization': `Bearer ${key}`,
            'HTTP-Referer': env.CLIENT_URL,
            'X-Title': 'AIRoom',
        }),
    },
    groq: {
        baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
        authHeader: (key) => ({ 'Authorization': `Bearer ${key}` }),
    },
    google: {
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        authHeader: (key) => ({ 'Authorization': `Bearer ${key}` }),
    },
    openai: {
        baseUrl: 'https://api.openai.com/v1/chat/completions',
        authHeader: (key) => ({ 'Authorization': `Bearer ${key}` }),
    },
    anthropic: {
        baseUrl: 'https://api.anthropic.com/v1/messages',
        authHeader: (key) => ({
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
        }),
    },
    deepseek: {
        baseUrl: 'https://api.deepseek.com/chat/completions',
        authHeader: (key) => ({ 'Authorization': `Bearer ${key}` }),
    },
    together: {
        baseUrl: 'https://api.together.xyz/v1/chat/completions',
        authHeader: (key) => ({ 'Authorization': `Bearer ${key}` }),
    },
};

/**
 * Stream a chat completion from any supported provider.
 * Uses the OpenAI-compatible API format (most providers support this).
 * Anthropic is handled separately due to its different API format.
 */
export async function streamCompletion(
    options: LLMRequestOptions,
    callbacks: LLMStreamCallbacks
): Promise<void> {
    const { model, provider, messages, temperature = 0.7, maxTokens = 4096, userId } = options;
    const startTime = Date.now();

    // Resolve API key
    const apiKey = await resolveApiKey(userId, provider);
    if (!apiKey) {
        callbacks.onError(`No API key configured for ${provider}. Add one in Settings → API Keys.`);
        return;
    }

    const config = PROVIDER_CONFIG[provider];

    try {
        if (provider === 'anthropic') {
            await streamAnthropic(apiKey, model, messages, temperature, maxTokens, callbacks, startTime);
        } else {
            await streamOpenAICompat(config, apiKey, model, messages, temperature, maxTokens, callbacks, startTime);
        }
    } catch (err: any) {
        console.error(`LLM stream error (${provider}/${model}):`, err.message);
        callbacks.onError(`LLM request failed: ${err.message}`);
    }
}

/**
 * Stream using OpenAI-compatible API (works for OpenRouter, Groq, Gemini, OpenAI, DeepSeek, Together).
 */
async function streamOpenAICompat(
    config: { baseUrl: string; authHeader: (key: string) => Record<string, string> },
    apiKey: string,
    model: string,
    messages: LLMMessage[],
    temperature: number,
    maxTokens: number,
    callbacks: LLMStreamCallbacks,
    startTime: number
): Promise<void> {
    const response = await fetch(config.baseUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...config.authHeader(apiKey),
        },
        body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
            stream: true,
        }),
    });

    if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errBody.substring(0, 200)}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let totalTokens = 0;

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;

                const data = trimmed.slice(6);
                if (data === '[DONE]') {
                    callbacks.onDone({ tokensUsed: totalTokens, latencyMs: Date.now() - startTime });
                    return;
                }

                try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (delta) {
                        totalTokens++;
                        callbacks.onToken(delta);
                    }
                } catch {
                    // Skip malformed JSON chunks
                }
            }
        }
    } finally {
        reader.releaseLock();
    }

    callbacks.onDone({ tokensUsed: totalTokens, latencyMs: Date.now() - startTime });
}

/**
 * Stream using Anthropic's native Messages API.
 */
async function streamAnthropic(
    apiKey: string,
    model: string,
    messages: LLMMessage[],
    temperature: number,
    maxTokens: number,
    callbacks: LLMStreamCallbacks,
    startTime: number
): Promise<void> {
    // Separate system message from conversation
    const systemMsg = messages.find((m) => m.role === 'system');
    const conversationMsgs = messages.filter((m) => m.role !== 'system');

    const body: any = {
        model,
        messages: conversationMsgs,
        temperature,
        max_tokens: maxTokens,
        stream: true,
    };

    if (systemMsg) {
        body.system = systemMsg.content;
    }

    const response = await fetch(PROVIDER_CONFIG.anthropic.baseUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...PROVIDER_CONFIG.anthropic.authHeader(apiKey),
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errBody.substring(0, 200)}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let totalTokens = 0;

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;

                const data = trimmed.slice(6);

                try {
                    const parsed = JSON.parse(data);

                    if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                        totalTokens++;
                        callbacks.onToken(parsed.delta.text);
                    }

                    if (parsed.type === 'message_delta' && parsed.usage?.output_tokens) {
                        totalTokens = parsed.usage.output_tokens;
                    }

                    if (parsed.type === 'message_stop') {
                        callbacks.onDone({
                            tokensUsed: totalTokens,
                            latencyMs: Date.now() - startTime,
                        });
                        return;
                    }
                } catch {
                    // Skip malformed JSON
                }
            }
        }
    } finally {
        reader.releaseLock();
    }

    callbacks.onDone({ tokensUsed: totalTokens, latencyMs: Date.now() - startTime });
}

/**
 * Non-streaming completion (used for AI Council aggregation).
 */
export async function getCompletion(options: LLMRequestOptions): Promise<{ content: string; tokensUsed?: number; latencyMs: number }> {
    const { model, provider, messages, temperature = 0.7, maxTokens = 4096, userId } = options;
    const startTime = Date.now();

    const apiKey = await resolveApiKey(userId, provider);
    if (!apiKey) {
        throw new Error(`No API key configured for ${provider}`);
    }

    const config = PROVIDER_CONFIG[provider];

    if (provider === 'anthropic') {
        const systemMsg = messages.find((m) => m.role === 'system');
        const conversationMsgs = messages.filter((m) => m.role !== 'system');

        const body: any = { model, messages: conversationMsgs, temperature, max_tokens: maxTokens };
        if (systemMsg) body.system = systemMsg.content;

        const response = await fetch(config.baseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...config.authHeader(apiKey) },
            body: JSON.stringify(body),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        return {
            content: (data as any).content?.[0]?.text || '',
            tokensUsed: (data as any).usage?.output_tokens,
            latencyMs: Date.now() - startTime,
        };
    }

    // OpenAI-compatible
    const response = await fetch(config.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...config.authHeader(apiKey) },
        body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    return {
        content: (data as any).choices?.[0]?.message?.content || '',
        tokensUsed: (data as any).usage?.total_tokens,
        latencyMs: Date.now() - startTime,
    };
}

/**
 * Available models catalog — shown in the UI model selector.
 */
export const MODEL_CATALOG = {
    openrouter: [
        { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)', free: true },
        { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Free)', free: true },
        { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (Free)', free: true },
        { id: 'qwen/qwen-2.5-72b-instruct:free', name: 'Qwen 2.5 72B (Free)', free: true },
        { id: 'mistralai/mistral-small-24b-instruct-2501:free', name: 'Mistral Small 24B (Free)', free: true },
        { id: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet', free: false },
        { id: 'openai/gpt-4o', name: 'GPT-4o', free: false },
        { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', free: false },
    ],
    groq: [
        { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 (Llama 70B)', free: true },
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', free: true },
        { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Fast)', free: true },
        { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', free: true },
        { id: 'gemma2-9b-it', name: 'Gemma 2 9B', free: true },
    ],
    google: [
        { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Preview)', free: true },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', free: true },
        { id: 'gemini-2.0-pro-exp-02-05', name: 'Gemini 2.0 Pro Experimental', free: true },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', free: true },
    ],
    openai: [
        { id: 'gpt-4o', name: 'GPT-4o', free: false },
        { id: 'gpt-4.5-preview', name: 'GPT-4.5 Preview', free: false },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', free: false },
        { id: 'o1', name: 'o1', free: false },
        { id: 'o3-mini', name: 'o3-mini', free: false },
    ],
    anthropic: [
        { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', free: false },
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', free: false },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', free: false },
    ],
    deepseek: [
        { id: 'deepseek-chat', name: 'DeepSeek Chat (V3)', free: false },
        { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)', free: false },
    ],
    together: [
        { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B Turbo', free: false },
        { id: 'Qwen/Qwen2.5-72B-Instruct-Turbo', name: 'Qwen 2.5 72B Turbo', free: false },
        { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek R1', free: false },
    ],
} as const;
