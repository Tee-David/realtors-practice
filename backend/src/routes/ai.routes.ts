import { Router, Request, Response } from "express";
import { config } from "../config/env";

const router = Router();

interface ProviderStatus {
  name: string;
  slug: string;
  status: "operational" | "degraded" | "down" | "no_key";
  latencyMs: number | null;
  model: string | null;
  error: string | null;
  checkedAt: string;
}

interface ProviderConfig {
  name: string;
  slug: string;
  apiKey: string;
  checkUrl: string;
  headers: (key: string) => Record<string, string>;
  model: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    name: "Groq",
    slug: "groq",
    apiKey: config.ai.groqApiKey,
    checkUrl: "https://api.groq.com/openai/v1/models",
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    model: "qwen-qwq-32b",
  },
  {
    name: "Cerebras",
    slug: "cerebras",
    apiKey: config.ai.cerebrasApiKey,
    checkUrl: "https://api.cerebras.ai/v1/models",
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    model: "qwen3-32b",
  },
  {
    name: "SambaNova",
    slug: "sambanova",
    apiKey: config.ai.sambanovaApiKey,
    checkUrl: "https://api.sambanova.ai/v1/models",
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    model: "Qwen3-32B",
  },
  {
    name: "Gemini",
    slug: "gemini",
    apiKey: config.ai.geminiApiKey,
    checkUrl: "https://generativelanguage.googleapis.com/v1beta/models",
    headers: () => ({}),
    model: "gemini-2.0-flash",
  },
];

async function checkProvider(provider: ProviderConfig): Promise<ProviderStatus> {
  const checkedAt = new Date().toISOString();

  if (!provider.apiKey) {
    return {
      name: provider.name,
      slug: provider.slug,
      status: "no_key",
      latencyMs: null,
      model: provider.model,
      error: "API key not configured",
      checkedAt,
    };
  }

  const start = Date.now();
  try {
    const url =
      provider.slug === "gemini"
        ? `${provider.checkUrl}?key=${provider.apiKey}`
        : provider.checkUrl;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        ...provider.headers(provider.apiKey),
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - start;

    if (res.ok) {
      return {
        name: provider.name,
        slug: provider.slug,
        status: "operational",
        latencyMs,
        model: provider.model,
        error: null,
        checkedAt,
      };
    }

    // Rate limited but API is reachable
    if (res.status === 429) {
      return {
        name: provider.name,
        slug: provider.slug,
        status: "degraded",
        latencyMs,
        model: provider.model,
        error: "Rate limited",
        checkedAt,
      };
    }

    // Auth error
    if (res.status === 401 || res.status === 403) {
      return {
        name: provider.name,
        slug: provider.slug,
        status: "down",
        latencyMs,
        model: provider.model,
        error: `Authentication failed (${res.status})`,
        checkedAt,
      };
    }

    return {
      name: provider.name,
      slug: provider.slug,
      status: "degraded",
      latencyMs,
      model: provider.model,
      error: `HTTP ${res.status}`,
      checkedAt,
    };
  } catch (err: any) {
    return {
      name: provider.name,
      slug: provider.slug,
      status: "down",
      latencyMs: Date.now() - start,
      model: provider.model,
      error: err.name === "AbortError" ? "Timeout (8s)" : (err.message || "Connection failed"),
      checkedAt,
    };
  }
}

// GET /api/ai/health — check all AI providers
router.get("/health", async (_req: Request, res: Response) => {
  const results = await Promise.all(PROVIDERS.map(checkProvider));

  const operational = results.filter((r) => r.status === "operational").length;
  const overall =
    operational === results.length
      ? "all_operational"
      : operational > 0
      ? "partial"
      : "all_down";

  res.json({
    success: true,
    data: {
      overall,
      operational,
      total: results.length,
      providers: results,
      checkedAt: new Date().toISOString(),
    },
  });
});

// GET /api/ai/health/:slug — check a single provider
router.get("/health/:slug", async (req: Request, res: Response) => {
  const provider = PROVIDERS.find((p) => p.slug === req.params.slug);
  if (!provider) {
    return res.status(404).json({ success: false, error: "Provider not found" });
  }

  const result = await checkProvider(provider);
  res.json({ success: true, data: result });
});

export default router;
