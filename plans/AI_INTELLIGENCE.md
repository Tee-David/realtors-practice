# AI Intelligence Integration: Qwen3 32B (Free APIs) + ZeroClaw + mem0 on Oracle Free Tier

> How to build a zero-cost, production-grade property intelligence layer for the Realtors' Practice platform using **Qwen3 32B** via free inference APIs (Groq, Cerebras, SambaNova) for all AI tasks, **ZeroClaw** as the ultra-lightweight agent runtime, **mem0** for persistent memory, and **Gemini Flash** (free tier) as a chat fallback — all orchestrated from Oracle's Always Free ARM compute.

---

## What Are These Technologies?

### Qwen3 32B (via Free Inference APIs)

Alibaba's latest open-source LLM, served for free by multiple inference providers. The 32B variant is **4x larger** than the previously planned 8B — better reasoning, better extraction, better analysis — and it costs nothing.

| Property | Value |
|---|---|
| Parameters | 32 billion |
| Inference speed | **300-3,000 tokens/second** (via Groq/Cerebras) |
| Max context | 32,768+ tokens |
| Thinking mode | Built-in — toggle with `/think` and `/no_think` |
| Cost | **$0** (free API tiers) |
| Hosting | None — API calls to external providers |
| Quality vs 8B | Significantly better at reasoning, extraction, and Nigerian context understanding |

**Why Qwen3 32B over 8B?** The free API providers serve 32B at 300+ tok/s — that's 15-100x faster than running 8B locally on ARM CPU (3-7 tok/s). Better model, faster speed, zero infrastructure.

**Why not run locally?** Running Qwen3 8B on Oracle ARM gives ~3-7 tok/s. That's painfully slow for interactive features. Free APIs give 32B at 300+ tok/s. There is no contest.

---

### Free Inference Providers

#### Groq (Primary)
| Property | Value |
|---|---|
| Hardware | Custom LPU (Language Processing Unit) |
| Free Tier | Truly free, no credit card |
| Rate Limits | 30 RPM, 6,000 tokens/min, 14,400 requests/day |
| Models | Qwen3 32B, Llama 3.3 70B, Llama 4 Scout |
| Speed | 300-500+ tokens/sec |
| API | OpenAI-compatible |

#### Cerebras (Fallback #1)
| Property | Value |
|---|---|
| Hardware | Wafer-Scale Engine (WSE) |
| Free Tier | Free, no credit card, no waitlist |
| Rate Limits | 30 RPM, 1 million tokens/day |
| Models | Qwen3 32B, Qwen3 235B, Llama 3.3 70B |
| Speed | 450-3,000+ tokens/sec |
| API | OpenAI-compatible |

#### SambaNova (Fallback #2)
| Property | Value |
|---|---|
| Hardware | Custom RDU (Reconfigurable Dataflow Unit) |
| Free Tier | Free API key, no credit card |
| Rate Limits | 10-30 RPM |
| Models | Qwen models, DeepSeek-R1, Llama |
| Speed | 600+ tokens/sec |
| API | OpenAI-compatible |

**Combined capacity**: ~20,000-30,000 requests/day, millions of tokens. More than enough for a property intelligence platform.

---

### ZeroClaw (Ultra-Lightweight Agent Runtime)

ZeroClaw is a Rust-based agent runtime that provides gateway mode for scheduling tasks, routing tool calls, and handling webhooks — all in under 10 MB of RAM. It is already deployed and running on the Oracle VM.

| Property | Value |
|---|---|
| Runtime | Rust binary (`/usr/local/bin/zeroclaw`) |
| RAM usage | **~5-10 MB** (measured 8.6 MB in production) |
| Port | 8000 (gateway mode) |
| Endpoints | `POST /pair` (pairing), `POST /webhook` (prompts), `GET /api/*` (REST) |
| Web dashboard | `http://0.0.0.0:8000/` |
| Docker required | **No** — standalone binary |
| ARM support | Yes — native ARM64 binary |
| Capabilities | Scheduled tasks, tool routing, webhooks, task orchestration |
| Status | **Already deployed and running** on the Oracle VM |

**Why ZeroClaw?**
- Ultra-lightweight: <10 MB RAM vs 300-500 MB for heavier Python-based agent frameworks
- Already deployed and confirmed working on the Oracle VM
- Sufficient for property intelligence tasks: scheduled reports, tool routing, webhooks
- No Docker dependency — reduces operational complexity

**Binary location:** `/usr/local/bin/zeroclaw`

---

### mem0 (Persistent AI Memory)

mem0 is a memory layer that sits between your app and the LLM. It automatically extracts facts from conversations, stores them as vector embeddings, and retrieves relevant context on future queries. This gives your AI persistent, personalized memory across sessions.

| Property | Value |
|---|---|
| Storage backend | PostgreSQL + pgvector (vector DB) + Neo4j (graph) |
| How it works | Conversations → fact extraction → embedding → vector store → retrieval |
| RAM footprint | **~4-6 GB** total (FastAPI + PostgreSQL + Neo4j) |
| Integration | Python SDK, REST API |
| LLM dependency | Uses the same free APIs (Groq/Cerebras) for memory extraction |

**Why mem0 over a custom memory system?** It handles the hard parts — fact extraction, deduplication, relevance scoring, temporal decay — out of the box. No need to reinvent this.

**Repo:** [github.com/mem0ai/mem0](https://github.com/mem0ai/mem0)
**Docs:** [docs.mem0.ai](https://docs.mem0.ai)

---

## Architecture

### High-Level System Design

```
+---------------------------------------------------------------+
|                     Frontend (Next.js)                         |
|   AI Chat Panel | Insight Cards | Smart Search | Report View   |
+-------------------------------+-------------------------------+
                                | REST/WebSocket
+-------------------------------v-------------------------------+
|                    Backend (Node.js)                           |
|   AI Service ---------> AI Router ---------> Intelligence API  |
|   (/api/ai/*,           (decides:            |                 |
|    /api/insights)        provider routing)    |                 |
+-------------------------------+-------------------------------+
                                | HTTP
        +-----------------------+-----------------------+
        |                       |                       |
+-------v-------+     +---------v--------+    +--------v--------+
|   Groq API    |     | Cerebras API     |    | SambaNova API   |
|   (Primary)   |     | (Fallback #1)    |    | (Fallback #2)   |
|   Qwen3 32B   |     | Qwen3 32B/235B   |    | Qwen models     |
|   300+ tok/s  |     | 450+ tok/s       |    | 600+ tok/s      |
+---------------+     +------------------+    +-----------------+

+---------------------------------------------------------------+
|          Oracle Free Tier (ARM VM - 4 OCPU, 24 GB RAM)        |
|                                                                |
|   +---------------------+    +----------------------------+   |
|   |   ZeroClaw           |    |   mem0 (Docker Compose)    |   |
|   |   (Rust binary,      |    |   FastAPI server           |   |
|   |    ~8.6 MB RAM,      |    |   PostgreSQL + pgvector    |   |
|   |    port 8000)        |    |   Neo4j graph DB           |   |
|   |   - Task scheduling  |    |   ~4-6 GB RAM              |   |
|   |   - Tool routing     |    +----------------------------+   |
|   |   - Webhooks         |                                     |
|   |   - Gateway mode     |    +----------------------------+   |
|   |                      |    |   Gemini Flash (cloud)     |   |
|   +---------------------+    |   Chat fallback             |   |
|                               |   1,500 req/day free       |   |
|                               +----------------------------+   |
+---------------------------------------------------------------+
```

### Resource Budget (Oracle VM — 4 OCPU / 24 GB)

| Component | RAM | Notes |
|---|---|---|
| Ubuntu OS + kernel | 400-600 MB | Minimal server install |
| ZeroClaw | 5-10 MB | Rust binary, gateway mode |
| mem0 FastAPI | 200-400 MB | Thin Python wrapper |
| PostgreSQL + pgvector | 1,000-2,000 MB | Vector DB for memories |
| Neo4j | 1,000-2,000 MB | Graph DB for relationships |
| **TOTAL** | **~2.6-5.0 GB** | |
| **Headroom** | **~19-21 GB** | Huge buffer — no LLM running locally |

> **Feasibility verdict:** With inference offloaded to free APIs, the Oracle VM has 19-21 GB of headroom. This is massively more comfortable than the previous 4.7 GB. You could run additional services, increase mem0's cache, or add monitoring without worry.

### Provider Failover Strategy

```
Request → Try Groq (primary)
            ↓ (if rate limited or error)
          Try Cerebras (fallback #1)
            ↓ (if rate limited or error)
          Try SambaNova (fallback #2)
            ↓ (if all fail)
          Gemini Flash (emergency fallback)
```

All providers use OpenAI-compatible APIs. The failover is a simple HTTP retry with provider rotation — no complex logic needed.

```typescript
// backend/src/services/ai.service.ts — provider rotation
const PROVIDERS = [
  { name: "groq", url: "https://api.groq.com/openai/v1", model: "qwen-qwq-32b" },
  { name: "cerebras", url: "https://api.cerebras.ai/v1", model: "qwen3-32b" },
  { name: "sambanova", url: "https://api.sambanova.ai/v1", model: "Qwen3-32B" },
];

async function complete(prompt: string, options?: { thinking?: boolean }): Promise<string> {
  for (const provider of PROVIDERS) {
    try {
      const response = await fetch(`${provider.url}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env[`${provider.name.toUpperCase()}_API_KEY`]}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [{ role: "user", content: prompt }],
          // Qwen3 thinking mode: include <think> tags for /think, omit for /no_think
          ...(options?.thinking === false && { extra_body: { chat_template_kwargs: { enable_thinking: false } } }),
        }),
      });
      if (response.ok) return (await response.json()).choices[0].message.content;
    } catch (e) {
      console.warn(`[AI] ${provider.name} failed, trying next...`);
    }
  }
  // Final fallback: Gemini Flash
  return callGeminiFlash(prompt);
}
```

### Rate Limit Budget

| Provider | Daily Requests | Tokens/Day | Speed |
|---|---|---|---|
| Groq (primary) | 14,400 | ~8.6M (at 6K/min) | 300-500 tok/s |
| Cerebras (fallback) | ~43,200 (30 RPM) | 1,000,000 | 450-3,000 tok/s |
| SambaNova (backup) | ~14,400-43,200 | Generous | 600+ tok/s |
| Gemini Flash (emergency) | 1,500 | ~1.5M | Fast |
| **Combined** | **~73,000-100,000+** | **~11M+** | — |

For context: a property intelligence platform with 100 daily active users generating ~50 AI requests each = 5,000 requests/day. The combined free tier handles **15-20x that capacity**.

---

### Task Routing Logic

| Task Type | Provider | Mode | Why |
|---|---|---|---|
| Query parsing (NL → JSON) | **Groq** | `/no_think` | Fast, structured output, no reasoning needed |
| Classification/tagging | **Groq** | `/no_think` | Simple pattern matching |
| Quality scoring | **Groq** | `/no_think` | Numeric scoring, fast per-listing |
| Chat assistant | **Gemini Flash** | — | Needs real-time speed (user-facing), saves rate limits |
| Market reports | **Groq/Cerebras** | `/think` | Needs reasoning, runs async |
| Investment analysis | **Groq/Cerebras** | `/think` | Needs math + reasoning, runs async |
| Fraud detection | **Groq/Cerebras** | `/think` | Needs semantic understanding, runs async |
| Scrape failure diagnosis | **Cerebras** | `/think` | Multi-step reasoning, larger context |
| Scheduled tasks/tool routing | **ZeroClaw + Groq** | — | Task orchestration + LLM inference |
| Memory extraction (mem0) | **Groq/Cerebras** | `/no_think` | Fact extraction from conversations |
| Embedding generation | **Groq/Cerebras** | — | Use provider's embedding endpoint or local nomic-embed-text |
| Fallback (all providers down) | **Gemini Flash** | — | Free tier cloud backup |

The key insight: Qwen3's `/think` vs `/no_think` modes let one model serve two roles. `/no_think` is ~2-3x faster for simple tasks.

---

## 10 Use Cases for Nigerian Property Intelligence

### 1. Natural Language Query Enhancement
**Current:** Regex-based NL parser — works for "3 bedroom flat in Lekki under 30M" but fails on complex queries.

**With Qwen3 32B (/no_think):** Parse raw query → structured JSON. Handles Nigerian phrasing:
- "Self-con in VI" → studio in Victoria Island
- "Boys quarters Ikoyi" → BQ/separate guest quarters
- "Face-me-I-face-you Surulere" → shared compound building

### 2. Property Quality & Fraud Scoring
When a property is scraped, Qwen3 32B (/no_think) scores quality and detects:
- "Too good to be true" pricing (N500K/month Lekki duplex)
- Templated/copy-pasted descriptions
- Nigerian fraud patterns ("call agent for viewing fee")

### 3. Auto-Generated Area Market Reports
Weekly cron job via ZeroClaw's scheduler. Qwen3 32B (/think) generates plain-English market summaries from your analytics data. Powers a "Market Briefing" feature.

### 4. Comparable Property Matching
Embedding-based semantic search finds comparables that match quality, amenities, and context — not just bedroom count. Uses provider embedding endpoints or local nomic-embed-text on Oracle VM.

### 5. Investment Return Estimator
User asks "Is this N80M duplex in Magodo a good investment?" ZeroClaw routes the task:
1. Pulls listing from DB
2. Queries rental rates for similar properties
3. Pulls historical price data
4. Feeds all context to Qwen3 32B (/think)
5. Returns yield estimate + verdict

### 6. Scrape Failure Diagnosis
When a scrape returns 0 results, ZeroClaw triggers a diagnostic workflow: reads the error log, sends context to Qwen3 32B (/think) for analysis, and identifies: selector changed, anti-bot block, rate limiting, etc.

### 7. AI Chat Assistant
Floating chat button on every page. Routes to Gemini Flash for real-time speed. Has tools: `query_database`, `search_properties`, `get_analytics`. mem0 remembers user preferences across sessions.

### 8. Auto-Enrichment of Scraped Listings
Qwen3 32B (/no_think) extracts from descriptions: nearby amenities, property condition hints, suggested tags. Combined with Nominatim geocoding for richer listings.

### 9. Notification Smart Digest
Weekly AI-generated email summaries instead of individual alerts. "12 properties matching your search. Best value: [property X] at N27M. Prices trending down 3%."

### 10. Data Explorer Anomaly Detection
Nightly cron job via ZeroClaw. Qwen3 32B (/think) scans new listings for: price outliers, near-duplicate descriptions, bad geocoding, phone numbers in descriptions.

---

## Custom AI Chatbot

The free API providers fully support building a custom, production-grade chatbot. This is **not** a compromised version — it's actually more powerful than a local Ollama setup because you get a 32B model at 300+ tok/s with streaming support.

### Architecture: Vercel AI SDK + Shadcn UI + Free APIs

```
User types message
    ↓
Frontend (Vercel AI SDK useChat hook)
    ↓ streaming SSE
Backend API route (/api/ai/chat)
    ↓
Provider Router (Groq → Cerebras → SambaNova → Gemini)
    ↓ OpenAI-compatible streaming
mem0 (context injection: user preferences, search history)
    ↓
Response streams back token-by-token to the UI
```

### Why This Works with Free APIs

| Requirement | How Free APIs Handle It |
|---|---|
| **Streaming responses** | All providers support SSE streaming (OpenAI-compatible `stream: true`) |
| **Tool calling / Function calling** | Groq, Cerebras, SambaNova all support tool_use / function_calling |
| **Generative UI** | Vercel AI SDK renders React components from tool call responses |
| **Conversation memory** | mem0 injects relevant past context into system prompt |
| **Multi-step forms** | LLM triggers tool calls → frontend renders form components in chat |
| **Real-time speed** | 300+ tok/s is faster than ChatGPT — users won't notice it's free |
| **Concurrent users** | 30 RPM per provider × 3 providers = 90 RPM total. 10 concurrent chats is fine |

### Chatbot Capabilities

1. **Property Search in Chat** — "Find me a 3-bed flat in Lekki under 30M"
   - LLM calls `search_properties` tool → backend queries DB → returns results
   - Frontend renders interactive PropertyCard components inside the chat stream

2. **Interactive Forms** — Budget sliders, location pickers, preference selectors
   - LLM detects missing info → triggers `ask_budget` or `ask_location` tool
   - Vercel AI SDK renders the form component → user submits → continues conversation

3. **Investment Analysis in Chat** — "Is this N80M Magodo duplex worth it?"
   - LLM calls `analyze_investment` tool → pulls comparable data → runs yield calc
   - Returns formatted analysis with charts/numbers

4. **Persistent Memory** — "Remember I'm looking for something in Ikoyi"
   - mem0 extracts preference → stores in vector DB → retrieves on next session
   - User gets personalized responses without repeating themselves

5. **Contextual Awareness** — Chat knows which page the user is on
   - Property detail page → chat pre-loads that property's context
   - Search results page → chat can refine the current search

6. **Telegram Bot Integration** — Access the chatbot from Telegram without visiting the app
   - Authorized Telegram users can search properties, get market reports, and receive alerts
   - Same AI backend, same tools, different delivery channel
   - ZeroClaw handles the Telegram webhook → routes to the same AI provider stack

### Implementation Stack

```typescript
// Frontend: Vercel AI SDK
import { useChat } from "@ai-sdk/react";

// Backend: Provider-agnostic with streaming
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, tool } from "ai";

const groq = createOpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY,
});

// Tools the chatbot can use
const tools = {
  search_properties: tool({ description: "Search property database", parameters: z.object({...}) }),
  analyze_investment: tool({ description: "Analyze ROI for a property", parameters: z.object({...}) }),
  get_market_report: tool({ description: "Get area market summary", parameters: z.object({...}) }),
  schedule_viewing: tool({ description: "Schedule a property viewing", parameters: z.object({...}) }),
};
```

---

## Telegram Bot Integration

Connect the AI chatbot to Telegram so authorized users can interact with the platform without visiting the web app.

### Architecture

```
Telegram User sends message
    ↓
Telegram Bot API (webhook)
    ↓
ZeroClaw on Oracle VM (port 8000)
    ↓ webhook handler
Backend API (/api/ai/chat) — same as web chatbot
    ↓
Provider Router (Groq → Cerebras → SambaNova)
    ↓
Response sent back via Telegram Bot API
```

### How It Works

1. **Create a Telegram Bot** via @BotFather → get bot token
2. **Set webhook** to ZeroClaw's webhook endpoint on Oracle VM: `https://your-domain/webhook/telegram`
3. **ZeroClaw receives messages** → authenticates user (whitelist by Telegram user ID) → routes to AI service
4. **Same tools, same memory** — Telegram users get the same `search_properties`, `analyze_investment`, `get_market_report` tools as web users
5. **mem0 tracks Telegram users separately** — their preferences persist across sessions

### Telegram-Specific Features

| Feature | How It Works |
|---|---|
| **Property Search** | User: "3 bed flat Lekki under 30M" → bot returns formatted property cards with photos |
| **Price Alerts** | User: "Alert me when 2-bed Ikoyi under 20M appears" → ZeroClaw schedules check → sends Telegram notification |
| **Market Reports** | User: "Lekki market report" → weekly cached report delivered as message |
| **Investment Analysis** | User sends a property URL → bot scrapes it, analyzes ROI, returns verdict |
| **Inline Search** | User types `@yourbotname 3bed lekki` in any chat → inline results appear |

### Access Control

- Whitelist of authorized Telegram user IDs stored in the database
- Admin can add/remove Telegram users from the web dashboard
- Rate limit per Telegram user: 30 messages/hour (prevents abuse of free API quota)
- Optional: link Telegram account to web account for unified preferences

### Implementation

```typescript
// backend/src/services/telegram.service.ts
import { Telegraf } from "telegraf";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.on("text", async (ctx) => {
  const userId = ctx.from.id.toString();

  // Check whitelist
  if (!await isAuthorizedTelegramUser(userId)) {
    return ctx.reply("You're not authorized. Contact the admin to get access.");
  }

  // Route through same AI service as web chatbot
  const response = await AIService.chat(ctx.message.text, {
    userId: `telegram:${userId}`,
    platform: "telegram",
  });

  await ctx.reply(response, { parse_mode: "Markdown" });
});

// Webhook mode (not polling) — more efficient on Oracle VM
bot.launch({ webhook: { domain: "https://your-domain", port: 8443 } });
```

### Cost: $0

- Telegram Bot API: **Free** (unlimited messages)
- No additional infrastructure — ZeroClaw already runs on Oracle VM
- Uses the same AI provider quota as the web chatbot

---

## AI-Powered Scraper Intelligence

The free APIs unlock powerful scraper capabilities that eliminate the brittleness of CSS selectors.

### 11. LLM-Powered CSS Selector Generation (NEW)

When a site redesigns and selectors break, the scraper can **auto-heal**:

1. Fetch the page HTML
2. Send a truncated sample (first 8K tokens) to Qwen3 32B with the prompt:
   > "This is a Nigerian real estate listing page. Generate CSS selectors that target: property title, price, location, bedrooms, bathrooms, images. Return as JSON."
3. LLM returns fresh selectors matched to the current HTML
4. Cache selectors per-domain, regenerate weekly or on extraction failure

```python
async def generate_selectors_with_llm(html_sample: str, domain: str) -> dict:
    """Ask LLM to generate CSS selectors from live HTML."""
    prompt = f"""Analyze this HTML from {domain} and return CSS selectors as JSON:
    {{
      "title": "CSS selector for property title",
      "price": "CSS selector for price",
      "location": "CSS selector for location/address",
      "bedrooms": "CSS selector for bedroom count",
      "images": "CSS selector for property images"
    }}

    HTML sample:
    {html_sample[:8000]}"""

    response = await ai_complete(prompt, thinking=False)
    return json.loads(response)
```

**Why this matters:** Sites like PropertyPro have redesigned their HTML 3+ times. Manual selector updates create a maintenance treadmill. LLM generation means the scraper adapts automatically.

### 12. Intelligent Page Classification

Before extracting data, classify the page type to avoid wasting extraction attempts on category pages:

| Classification | Action |
|---|---|
| Property detail page | Extract property data |
| Search results / listing index | Extract listing URLs only |
| Agent/contact page | Skip |
| Blocked / CAPTCHA | Retry with different fetcher |
| Empty / error page | Log and skip |

### 13. Data Normalization & Standardization

Nigerian property listings are wildly inconsistent. LLM normalizes:

| Raw Input | Normalized Output |
|---|---|
| "N30m" / "30,000,000" / "30M Naira" | `{ price: 30000000, currency: "NGN" }` |
| "3 bed flat" / "3BR apartment" / "3-bedroom" | `{ bedrooms: 3, type: "flat" }` |
| "Lekki Phase 1" / "Lekki Ph1" / "lekki phase one" | `{ area: "Lekki Phase 1", state: "Lagos" }` |
| "Self-con" / "selfcon" / "studio" | `{ type: "studio", bedrooms: 1 }` |

### 14. Smart Retry & Extraction Strategy Selection

When primary extraction fails, the scraper uses AI to decide the next move:

```
Attempt 1: JSON-LD extraction (fastest, most reliable)
    ↓ (if no JSON-LD found)
Attempt 2: CSS selectors (site config or LLM-generated)
    ↓ (if selectors fail)
Attempt 3: LLM full-page extraction (send HTML to Qwen3 32B)
    ↓ (if page is JS-rendered)
Attempt 4: Crawl4AI with JavaScript rendering + LLM extraction
```

### 15. Duplicate Detection Across Sources

Same property listed on PropertyPro, NPC, and Jiji with different titles/prices. LLM compares:
- Address similarity (semantic, not exact match)
- Photo fingerprinting (perceptual hash)
- Price proximity + bedroom count match
- Agent phone number match

### Scraper AI Task Routing

| Scraper Task | Provider | Mode | Cost per 1000 listings |
|---|---|---|---|
| Selector generation | Groq | `/no_think` | ~50 requests (1 per domain) |
| Page classification | Groq | `/no_think` | ~1000 requests |
| Data normalization | Groq | `/no_think` | ~1000 requests |
| Full-page extraction fallback | Cerebras | `/think` | ~100 requests (failures only) |
| Duplicate detection | Groq | `/no_think` | ~500 requests |
| Scrape failure diagnosis | Cerebras | `/think` | ~10 requests |
| **Total per 1000 listings** | | | **~2,660 requests** (~4% of daily budget) |

---

## Long-Term Stability & Risk Mitigation

### The Risk: Free Tiers Can Change

Free API tiers are marketing tools. They can be:
- Rate-limited further (Groq has already tightened limits once)
- Sunset entirely (unlikely for major providers, but possible)
- Deprioritized during peak load (free users get slower responses)

### Mitigation Strategy: Defense in Depth

**Layer 1: Multi-Provider Redundancy (NOW)**
- 3 independent free providers (Groq, Cerebras, SambaNova) + Gemini Flash
- If any one drops free tier, the others still work
- All use OpenAI-compatible API — switching is a config change, not a code change

**Layer 2: Local Fallback Ready (PREPARED)**
- Oracle VM already has Ollama installed with Qwen3 8B
- If all free APIs disappear, flip one env var to route to local Ollama
- Speed drops to 3-7 tok/s but the app stays functional
- Chat and real-time features degrade gracefully; background jobs unaffected

**Layer 3: Provider-Agnostic Interface (ARCHITECTURE)**
- `AIService` class abstracts all provider details
- Backend code calls `AIService.complete()` — never calls a provider directly
- Adding a new provider = adding one entry to the `PROVIDERS` array
- New free providers appear regularly; easy to add them

**Layer 4: Graceful Degradation (DESIGN)**
- Every AI feature has a non-AI fallback:
  - NL query parsing → falls back to regex parser (already exists)
  - Market reports → falls back to "data not available" card
  - Chat assistant → falls back to FAQ/static responses
  - Fraud scoring → falls back to rule-based scoring
  - Scraper selectors → falls back to URL pattern matching + JSON-LD (already works)
- The app is powerful **without** AI. AI adds capabilities; it doesn't gate-keep them.

### Stability Scorecard

| Provider | Backing | Free Tier Since | Risk Level |
|---|---|---|---|
| Groq | VC-funded ($640M+), custom silicon | 2024 | **Low** — free tier is their growth strategy |
| Cerebras | VC-funded ($720M+), custom silicon | 2024 | **Low** — same growth strategy as Groq |
| SambaNova | VC-funded ($1.1B+), custom silicon | 2024 | **Low-Medium** — smaller developer community |
| Gemini Flash | Google ($2T+ company) | 2024 | **Very Low** — Google rarely kills free API tiers |
| Local Ollama | Open-source, self-hosted | Permanent | **None** — you own it |

### What Happens If Everything Fails

Worst case: all 3 providers kill free tiers AND Gemini Flash gets restricted.

**Response plan:**
1. Route all AI to local Ollama on Oracle VM (already installed)
2. Reduce AI features to background-only (no real-time chat)
3. Use Qwen3 8B locally for: classification, normalization, reports (3-7 tok/s is fine for async)
4. Chat switches to FAQ mode until a new free provider emerges
5. **The core app (search, properties, scraping, analytics) continues working perfectly** — AI is an enhancement, not a dependency

### The App Without AI

This platform is a full-featured Nigerian real estate aggregator regardless of AI:
- Multi-site web scraping with 4-layer adaptive fetching
- Real-time property search with filters, map view, and saved searches
- Analytics dashboard with price trends, area comparisons, market overview
- User accounts with role-based access, property collections, alerts
- Mobile-responsive with PWA capabilities
- Socket.io real-time updates during active scrapes

AI makes it smarter. It doesn't make it work.

---

## Implementation Plan

### Phase 1: API Key Setup + Provider Integration (Week 1)

1. Sign up for free API keys:
   - Groq: [console.groq.com](https://console.groq.com)
   - Cerebras: [cloud.cerebras.ai](https://cloud.cerebras.ai)
   - SambaNova: [cloud.sambanova.ai](https://cloud.sambanova.ai)
2. Store keys in Doppler (project: realtors-practice)
3. Create `backend/src/services/ai.service.ts` with provider rotation logic
4. Add health check endpoint: `GET /api/ai/health`

### Phase 2: mem0 Setup on Oracle VM (Week 1-2)

1. Docker Compose for mem0 stack (FastAPI + PostgreSQL/pgvector + Neo4j)
2. Configure mem0 to use Groq API for memory extraction (not local Ollama)
3. Expose mem0 REST API on internal port
4. ZeroClaw routes memory operations to mem0

### Phase 3: ZeroClaw Integration (COMPLETE)

ZeroClaw is already deployed and running on the Oracle VM as a systemd service.

**Current status (confirmed via SSH):**
- ZeroClaw running on port 8000, using 8.6 MB RAM
- RAM: 11.9 GB total, 374 MB used, 11.3 GB available

**Systemd service configuration** (`/etc/systemd/system/zeroclaw.service`):

```ini
[Unit]
Description=ZeroClaw Agent Runtime (Realtors Practice)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu
Environment="GEMINI_API_KEY=YOUR_GEMINI_KEY_HERE"
Environment="GROQ_API_KEY=YOUR_GROQ_KEY_HERE"
Environment="CEREBRAS_API_KEY=YOUR_CEREBRAS_KEY_HERE"
ExecStart=/usr/local/bin/zeroclaw gateway
Restart=always
RestartSec=5
MemoryMax=64M
OOMScoreAdjust=-200

[Install]
WantedBy=multi-user.target
```

### Phase 4: Backend AI Service Integration (Week 3)

```typescript
// backend/src/services/ai.service.ts
export class AIService {
  // Multi-provider rotation with automatic failover
  static async complete(prompt: string, options?: AIOptions): Promise<string> { ... }

  // Specific task methods
  static async parseNaturalQuery(query: string): Promise<SearchFilters> { ... }
  static async scoreListingQuality(listing: Property): Promise<QualityScore> { ... }
  static async generateAreaReport(areaData: AreaStats): Promise<string> { ... }
  static async detectFraud(listing: Property): Promise<FraudFlags> { ... }
  static async enrichListing(listing: Property): Promise<EnrichedData> { ... }
  static async diagnoseScrapeFailure(log: string): Promise<Diagnosis> { ... }
}
```

New backend routes:
```
POST /api/ai/query-parse        → NL query → structured filters
POST /api/ai/listing-analysis   → single property → quality + fraud flags
GET  /api/ai/market-report/:area → cached weekly report
POST /api/ai/chat               → general assistant (Gemini Flash)
POST /api/ai/enrich             → listing → enriched data
GET  /api/ai/health              → AI service status + provider availability
```

### Phase 5: Frontend AI Components (Week 4)

1. **Floating AI Chat Button** — available on every page, WebSocket to backend, Gemini-powered
2. **Insight Cards** on dashboard — auto-populated market summaries
3. **"AI Analyze" button** on property detail — investment analysis
4. **Smart Search Enhancement** — show AI-interpreted query

---

## Cost Analysis

| Component | Monthly Cost |
|---|---|
| Oracle ARM VM (4 OCPU, 24 GB) | **$0** (Always Free) |
| Groq API (Qwen3 32B) | **$0** (free tier) |
| Cerebras API (Qwen3 32B) | **$0** (free tier) |
| SambaNova API (Qwen models) | **$0** (free tier) |
| ZeroClaw | **$0** (open-source, Rust binary) |
| mem0 + PostgreSQL + Neo4j | **$0** (open-source, self-hosted) |
| Gemini Flash (chat fallback) | **$0** (free tier, 1,500 req/day) |
| **Total** | **$0/month** |

---

## Comparison: Old Architecture vs New

| Metric | Old (Qwen3 8B on Ollama) | New (Qwen3 32B via APIs) |
|---|---|---|
| Model size | 8B parameters | **32B parameters** (4x larger) |
| Inference speed | 3-7 tok/s (ARM CPU) | **300-3,000 tok/s** (100x faster) |
| RAM for inference | ~5.5 GB (model + KV cache) | **0 GB** (offloaded to APIs) |
| Concurrent requests | 1 (queue everything else) | **30+ RPM** per provider |
| Model quality | Good | **Significantly better** |
| Infrastructure | Complex (Ollama + model management) | **Simple** (HTTP API calls) |
| Failure mode | VM crash = total outage | **3 independent providers** + Gemini fallback |
| Embedding | Ollama model swap (slow) | Provider embedding endpoint or local |
| Scaling ceiling | 1 request at a time | **~100K requests/day combined** |

---

## Key Links

- Groq Console: https://console.groq.com
- Cerebras Cloud: https://cloud.cerebras.ai
- SambaNova Cloud: https://cloud.sambanova.ai
- ZeroClaw binary: `/usr/local/bin/zeroclaw` (Rust binary on the Oracle VM)
- mem0: https://github.com/mem0ai/mem0
- mem0 docs: https://docs.mem0.ai
- Oracle Free: https://oracle.com/cloud/free
- Gemini API: https://ai.google.dev

---

*Revised 2026-03-17. Architecture updated from local Ollama/Qwen3 8B to free inference APIs (Groq/Cerebras/SambaNova) serving Qwen3 32B at 300-3,000 tok/s. Oracle VM now runs only ZeroClaw + mem0, freeing 19-21 GB of RAM headroom. Zero cost, 100x faster inference, 4x larger model.*
