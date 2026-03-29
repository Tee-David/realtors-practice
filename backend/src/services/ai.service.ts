/**
 * AI Service — Provider Router
 *
 * Rotation order: Groq → Cerebras → SambaNova → Gemini
 *
 * Features:
 * - Circuit breaker per provider: 3 failures → 15s backoff
 * - Per-provider RPM tracking: auto-skip if near limit
 * - Token estimation (pre-call) and tracking (post-call)
 * - Failover circular buffer (last 10 events) exposed via getFailoverLog()
 * - `feature` param for usage logging
 *
 * Dependencies (install before use):
 *   npm install ai @ai-sdk/groq @ai-sdk/google
 *
 * Cerebras and SambaNova use OpenAI-compatible endpoints via `createOpenAI`.
 */

import { config } from "../config/env";
import { logUsage } from "./ai-usage.service";
import { Logger } from "../utils/logger.util";

// ─── Provider Configuration ────────────────────────────────────────────────

interface ProviderConfig {
  slug: string;
  name: string;
  model: string;
  rpmLimit: number;
  apiKey: string;
  baseUrl?: string; // OpenAI-compatible base URL (Cerebras/SambaNova)
  type: "groq" | "google" | "openai-compat";
}

const PROVIDERS: ProviderConfig[] = [
  {
    slug: "groq",
    name: "Groq",
    model: "qwen-qwq-32b",
    rpmLimit: 30,
    apiKey: config.ai.groqApiKey,
    type: "groq",
  },
  {
    slug: "cerebras",
    name: "Cerebras",
    model: "qwen3-32b",
    rpmLimit: 30,
    apiKey: config.ai.cerebrasApiKey,
    baseUrl: "https://api.cerebras.ai/v1",
    type: "openai-compat",
  },
  {
    slug: "sambanova",
    name: "SambaNova",
    model: "Qwen3-32B",
    rpmLimit: 10,
    apiKey: config.ai.sambanovaApiKey,
    baseUrl: "https://api.sambanova.ai/v1",
    type: "openai-compat",
  },
  {
    slug: "gemini",
    name: "Gemini",
    model: "gemini-2.0-flash",
    rpmLimit: 10,
    apiKey: config.ai.geminiApiKey,
    type: "google",
  },
];

// ─── Circuit Breaker + Rate Tracker State ─────────────────────────────────

interface ProviderState {
  failureCount: number;
  backoffUntil: number; // epoch ms
  requestTimestamps: number[]; // sliding window for RPM
  lastSuccessAt: number | null;
  tokensInToday: number;
  tokensOutToday: number;
  requestsToday: number;
  todayDate: string; // "YYYY-MM-DD" for daily reset
}

const providerState: Record<string, ProviderState> = {};

function getState(slug: string): ProviderState {
  const today = new Date().toISOString().slice(0, 10);
  if (!providerState[slug]) {
    providerState[slug] = {
      failureCount: 0,
      backoffUntil: 0,
      requestTimestamps: [],
      lastSuccessAt: null,
      tokensInToday: 0,
      tokensOutToday: 0,
      requestsToday: 0,
      todayDate: today,
    };
  }

  // Daily reset
  const state = providerState[slug];
  if (state.todayDate !== today) {
    state.tokensInToday = 0;
    state.tokensOutToday = 0;
    state.requestsToday = 0;
    state.todayDate = today;
  }

  return state;
}

function getCurrentRpm(slug: string): number {
  const state = getState(slug);
  const now = Date.now();
  const windowStart = now - 60_000;
  state.requestTimestamps = state.requestTimestamps.filter((t) => t > windowStart);
  return state.requestTimestamps.length;
}

function recordRequest(slug: string) {
  getState(slug).requestTimestamps.push(Date.now());
  getState(slug).requestsToday++;
}

function recordSuccess(slug: string, tokensIn: number, tokensOut: number) {
  const state = getState(slug);
  state.failureCount = 0;
  state.backoffUntil = 0;
  state.lastSuccessAt = Date.now();
  state.tokensInToday += tokensIn;
  state.tokensOutToday += tokensOut;
}

function recordFailure(slug: string) {
  const state = getState(slug);
  state.failureCount++;
  if (state.failureCount >= 3) {
    state.backoffUntil = Date.now() + 15_000; // 15s circuit-open
    Logger.warn(`AI circuit breaker OPEN for ${slug} (${state.failureCount} failures)`);
  }
}

function isAvailable(provider: ProviderConfig): boolean {
  if (!provider.apiKey) return false;

  const state = getState(provider.slug);
  if (state.backoffUntil > Date.now()) return false;

  const rpm = getCurrentRpm(provider.slug);
  if (rpm >= provider.rpmLimit - 2) return false; // Leave a 2-RPM buffer

  return true;
}

// ─── Failover Circular Buffer ──────────────────────────────────────────────

export interface FailoverEvent {
  timestamp: string;
  fromProvider: string;
  toProvider: string | null;
  reason: string;
}

const FAILOVER_BUFFER_SIZE = 10;
const failoverLog: FailoverEvent[] = [];

function recordFailover(from: string, to: string | null, reason: string) {
  const event: FailoverEvent = {
    timestamp: new Date().toISOString(),
    fromProvider: from,
    toProvider: to,
    reason,
  };
  failoverLog.unshift(event);
  if (failoverLog.length > FAILOVER_BUFFER_SIZE) {
    failoverLog.pop();
  }
}

export function getFailoverLog(): FailoverEvent[] {
  return [...failoverLog];
}

// ─── Token Estimator ──────────────────────────────────────────────────────

/**
 * Rough token estimate: ~4 chars per token (GPT-4 heuristic).
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ─── Call Options ────────────────────────────────────────────────────────

export interface AICallOptions {
  /** Tagging string for usage logs */
  feature?: string;
  /** Max tokens to generate */
  maxTokens?: number;
  /** Temperature 0-1 */
  temperature?: number;
  /** System prompt */
  system?: string;
}

// ─── Core HTTP caller (OpenAI-compatible) ─────────────────────────────────

interface ChatCompletionResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
}

async function callOpenAICompat(
  provider: ProviderConfig,
  prompt: string,
  options: AICallOptions
): Promise<ChatCompletionResult> {
  const baseUrl = provider.baseUrl || "https://api.groq.com/openai/v1";
  const messages: Array<{ role: string; content: string }> = [];

  if (options.system) {
    messages.push({ role: "system", content: options.system });
  }
  messages.push({ role: "user", content: prompt });

  const body = {
    model: provider.model,
    messages,
    max_tokens: options.maxTokens ?? 2048,
    temperature: options.temperature ?? 0.3,
    stream: false,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    const tokensIn = data.usage?.prompt_tokens ?? estimateTokens(prompt);
    const tokensOut = data.usage?.completion_tokens ?? estimateTokens(text);

    return { text, tokensIn, tokensOut };
  } finally {
    clearTimeout(timeout);
  }
}

async function callGemini(
  provider: ProviderConfig,
  prompt: string,
  options: AICallOptions
): Promise<ChatCompletionResult> {
  const parts: Array<{ text: string }> = [];
  if (options.system) {
    parts.push({ text: `System: ${options.system}\n\n` });
  }
  parts.push({ text: prompt });

  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      maxOutputTokens: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.3,
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${provider.apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const tokensIn =
      data.usageMetadata?.promptTokenCount ?? estimateTokens(prompt);
    const tokensOut =
      data.usageMetadata?.candidatesTokenCount ?? estimateTokens(text);

    return { text, tokensIn, tokensOut };
  } finally {
    clearTimeout(timeout);
  }
}

async function callProvider(
  provider: ProviderConfig,
  prompt: string,
  options: AICallOptions
): Promise<ChatCompletionResult> {
  if (provider.type === "google") {
    return callGemini(provider, prompt, options);
  }
  return callOpenAICompat(provider, prompt, options);
}

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Generate text from the best available provider, auto-rotating on failure.
 * Returns the generated text string.
 */
export async function generateText(
  prompt: string,
  options: AICallOptions = {}
): Promise<string> {
  const feature = options.feature ?? "unknown";
  let lastError: Error | null = null;
  let previousSlug: string | null = null;

  for (const provider of PROVIDERS) {
    if (!isAvailable(provider)) {
      continue;
    }

    const start = Date.now();
    recordRequest(provider.slug);

    try {
      const result = await callProvider(provider, prompt, options);
      const latencyMs = Date.now() - start;

      recordSuccess(provider.slug, result.tokensIn, result.tokensOut);

      // Log usage asynchronously
      logUsage(
        provider.slug,
        feature,
        result.tokensIn,
        result.tokensOut,
        latencyMs,
        true
      ).catch(() => {});

      if (previousSlug) {
        recordFailover(previousSlug, provider.slug, lastError?.message ?? "unknown error");
      }

      return result.text;
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      recordFailure(provider.slug);

      logUsage(provider.slug, feature, estimateTokens(prompt), 0, latencyMs, false).catch(
        () => {}
      );

      Logger.warn(`AI provider ${provider.name} failed: ${err.message}`);
      previousSlug = provider.slug;
      lastError = err;
    }
  }

  // All providers failed
  if (previousSlug) {
    recordFailover(previousSlug, null, lastError?.message ?? "all providers failed");
  }

  throw new Error(
    `All AI providers failed. Last error: ${lastError?.message ?? "unknown"}`
  );
}

/**
 * Stream text from the best available provider.
 *
 * Returns an async generator yielding text chunks.
 * Falls back to non-streaming if streaming is not available for a provider.
 */
export async function* streamText(
  prompt: string,
  options: AICallOptions = {}
): AsyncGenerator<string> {
  const feature = options.feature ?? "unknown";
  let lastError: Error | null = null;
  let previousSlug: string | null = null;

  for (const provider of PROVIDERS) {
    if (!isAvailable(provider)) {
      continue;
    }

    const start = Date.now();
    recordRequest(provider.slug);

    try {
      // Use streaming-capable fetch with SSE for OpenAI-compatible providers
      if (provider.type === "google") {
        // Gemini: fall back to non-streaming for simplicity
        const result = await callGemini(provider, prompt, options);
        recordSuccess(provider.slug, result.tokensIn, result.tokensOut);
        const latencyMs = Date.now() - start;
        logUsage(provider.slug, feature, result.tokensIn, result.tokensOut, latencyMs, true).catch(() => {});
        if (previousSlug) recordFailover(previousSlug, provider.slug, lastError?.message ?? "");
        yield result.text;
        return;
      }

      // OpenAI-compatible streaming
      const baseUrl = provider.baseUrl || "https://api.groq.com/openai/v1";
      const messages: Array<{ role: string; content: string }> = [];
      if (options.system) messages.push({ role: "system", content: options.system });
      messages.push({ role: "user", content: prompt });

      const body = {
        model: provider.model,
        messages,
        max_tokens: options.maxTokens ?? 2048,
        temperature: options.temperature ?? 0.3,
        stream: true,
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let tokensIn = estimateTokens(prompt);
      let tokensOut = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const dataStr = line.slice(6).trim();
          if (dataStr === "[DONE]") continue;

          try {
            const data = JSON.parse(dataStr);
            const delta = data.choices?.[0]?.delta?.content ?? "";
            if (delta) {
              fullText += delta;
              tokensOut++;
              yield delta;
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }

      const latencyMs = Date.now() - start;
      recordSuccess(provider.slug, tokensIn, tokensOut);
      logUsage(provider.slug, feature, tokensIn, tokensOut, latencyMs, true).catch(() => {});
      if (previousSlug) recordFailover(previousSlug, provider.slug, lastError?.message ?? "");
      return;
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      recordFailure(provider.slug);
      logUsage(provider.slug, feature, estimateTokens(prompt), 0, latencyMs, false).catch(() => {});
      Logger.warn(`AI streaming provider ${provider.name} failed: ${err.message}`);
      previousSlug = provider.slug;
      lastError = err;
    }
  }

  throw new Error(
    `All AI providers failed for streaming. Last error: ${lastError?.message ?? "unknown"}`
  );
}

// ─── Provider Stats (for status endpoint) ────────────────────────────────

export interface ProviderStats {
  slug: string;
  name: string;
  rpmUsed: number;
  rpmLimit: number;
  requestsToday: number;
  tokensInToday: number;
  tokensOutToday: number;
  lastSuccessAt: string | null;
  circuitOpen: boolean;
  hasKey: boolean;
}

export function getProviderStats(): ProviderStats[] {
  return PROVIDERS.map((p) => {
    const state = getState(p.slug);
    return {
      slug: p.slug,
      name: p.name,
      rpmUsed: getCurrentRpm(p.slug),
      rpmLimit: p.rpmLimit,
      requestsToday: state.requestsToday,
      tokensInToday: state.tokensInToday,
      tokensOutToday: state.tokensOutToday,
      lastSuccessAt: state.lastSuccessAt
        ? new Date(state.lastSuccessAt).toISOString()
        : null,
      circuitOpen: state.backoffUntil > Date.now(),
      hasKey: Boolean(p.apiKey),
    };
  });
}
