# AI Intelligence Plan — Realtors' Practice

> Separate plan for all AI/intelligence features. Pending approval before adding to MASTER_CHECKLIST.
> Generated: 2026-03-27

---

## Architecture Overview

Inspired by the Valentine project's multi-agent architecture, adapted for a **web-based property intelligence platform** (not a Telegram bot). Key differences from Valentine:

- **No Redis bus needed** — we're a web app, not a process supervisor. Use HTTP + Server-Sent Events instead.
- **No separate OS processes** — agents run as serverless functions or backend service calls.
- **Same core patterns**: Intent routing, specialized agents, memory, LLM fallback chain, graceful degradation.

---

## 1. Agent Architecture

### 1.1 Intent Router (inspired by Valentine's ZeroClaw)

A lightweight router that classifies user intent and dispatches to the right specialist agent.

```
User message → Intent Router → Agent selection → Agent processes → Response
```

**Implementation**: Single function, not a separate process. Uses LLM with structured output (JSON mode) + keyword overrides for disambiguation.

**Routing categories:**
| Intent | Agent | Example |
|--------|-------|---------|
| Property search/filter | PropertySearchAgent | "Find 3-bed flats in Lekki under 5M" |
| Price analysis | PriceIntelAgent | "Is this property overpriced?" |
| Market trends | MarketAnalysisAgent | "How is the Ajah market trending?" |
| Property enrichment | EnrichmentAgent | "Fill in missing details for this property" |
| Scraper issues | ScraperDiagAgent | "Why did the last scrape fail?" |
| General Q&A | OracleAgent | "What's the best area for investment?" |

### 1.2 Specialized Agents

Each agent has:
- A **system prompt** defining its domain expertise (Nigerian real estate)
- **Tools** it can call (DB queries, API calls, calculations)
- **Memory context** injected from Mem0

#### PropertySearchAgent
- Converts natural language → structured Prisma/Meilisearch queries
- Returns properties with explanation of why they match
- Tools: `searchProperties()`, `getPropertyById()`, `getMeilisearchResults()`

#### PriceIntelAgent
- Compares property price against market data
- Calculates price per sqm for the area
- Identifies over/underpriced listings
- Tools: `getAreaPriceStats()`, `getPriceHistory()`, `getSimilarProperties()`

#### MarketAnalysisAgent
- Analyzes trends from scraped data (supply, prices, time-on-market)
- Generates area reports
- Tools: `getMarketTrends()`, `getAreaStats()`, `getSupplyTrends()`

#### EnrichmentAgent
- Uses LLM to fill missing fields from description text
- Geocodes addresses
- Normalizes data (price formats, area names)
- Tools: `updateProperty()`, `geocode()`, `normalizeFields()`

#### ScraperDiagAgent
- Analyzes failed scrape jobs
- Suggests CSS selector fixes
- Monitors site health
- Tools: `getRecentJobs()`, `getSiteHealth()`, `getJobErrors()`, `testSelector()`

#### OracleAgent (general)
- Handles anything that doesn't fit other agents
- Has access to all tools as fallback
- Nigerian real estate domain knowledge baked into system prompt

### 1.3 Agent Base Pattern

```typescript
// Simplified from Valentine's BaseAgent — no process management needed
interface Agent {
  name: string;
  systemPrompt: string;
  tools: Tool[];
  process(message: string, context: AgentContext): Promise<AgentResponse>;
}

interface AgentContext {
  userId: string;
  conversationHistory: Message[];
  memoryContext: MemoryItem[];  // from Mem0
  currentProperty?: Property;   // if on a property page
}
```

---

## 2. LLM Provider Layer

### 2.1 Multi-Provider Fallback (from Valentine)

Same pattern as Valentine's `FallbackChain` — circuit breaker + automatic failover:

| Priority | Provider | Use Case | Free Tier |
|----------|----------|----------|-----------|
| 1 | **Groq** | Primary chat + extraction (fastest) | 30 RPM, ~14.4k req/day |
| 2 | **Google Gemini** | Voice (Gemini 2.5/3.1 Flash Live) + complex analysis (2.5 Pro) | 10 RPM, 250 req/day (Flash); 5 RPM, 100 req/day (Pro) |
| 3 | **Cerebras** | Fallback chat (also very fast) | 1M tokens/day |
| 4 | **SambaNova** | Multimodal (image analysis), background batch | 20 RPM, 50 req/day |

> **CONFIRMED (2026-03-27):** Using Groq, Cerebras, SambaNova, and Gemini free tiers as the primary LLM providers. No paid tiers initially. The fallback chain ensures resilience when any single provider hits rate limits.
>
> **Warning:** Google reduced free tier limits by 50-80% in December 2025. Do not build the entire platform around a single free tier. Budget for at least Groq's $10/mo developer tier as safety net.

### 2.2 Circuit Breaker

```typescript
// From Valentine — 15s backoff after failure
class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private readonly threshold = 3;
  private readonly resetMs = 15_000;

  isOpen(): boolean {
    if (this.failures >= this.threshold) {
      return Date.now() - this.lastFailure < this.resetMs;
    }
    return false;
  }
}
```

### 2.3 Rate Limiter

Token-bucket per provider (from Valentine's `rate_limiter.py`). Tracks both RPM and RPD limits.

---

## 3. Memory System (Mem0 + Qdrant)

### 3.1 Why Mem0

- Already used in Valentine project — proven pattern
- Provides vector-based semantic search over memories
- Uses `all-MiniLM-L6-v2` embeddings (runs locally, no API cost)
- Qdrant for vector storage (can run in Docker on Oracle Cloud VM)

### 3.2 Memory Types (adapted from Valentine's Cortex agent)

| Type | Scope | Examples |
|------|-------|---------|
| **User Preferences** | Per-user | "Prefers Lekki area", "Budget under 10M", "Looking for 3-bed" |
| **Search Patterns** | Per-user | Past searches, viewed properties, saved filters |
| **Market Knowledge** | Global | "Lekki prices rose 15% in Q1 2026", area summaries |
| **Scraper Knowledge** | Global | "propertypro.ng changed their layout on March 15" |

### 3.3 Memory Flow

```
1. User asks question
2. Router fetches top-5 relevant memories from Qdrant
3. Memories injected into agent context
4. Agent processes with memory-enriched context
5. After response, new learnings stored back to memory
```

### 3.4 Privacy

Same as Valentine: per-user facts are scoped. Global knowledge is PII-scrubbed before storage.

---

## 4. Voice Chat (Gemini 2.0 Flash — Live API)

### 4.1 Why Gemini Live

- **Real-time bidirectional streaming** — true voice conversation, not STT→LLM→TTS pipeline
- **Free tier available** — Google's AI Studio provides free access (10 RPM, 250 req/day for Flash)
- **Native multimodal** — can process audio directly without separate STT service
- **Low latency** — designed for conversational use

> **IMPORTANT**: Gemini 2.0 Flash Live was **deprecated March 3, 2026** (shutdown September 2026). Target **Gemini 2.5 Flash** or **Gemini 3.1 Flash Live** (developer preview).

Google provides a [React-based starter app](https://github.com/google-gemini/live-api-web-console) with audio playback, mic recording, webcam/screen capture — use as base for our implementation.

### 4.2 Integration Architecture

```
Browser (mic) → WebSocket → Backend proxy → wss://generativelanguage.googleapis.com/ws/...
                                          ← Streaming audio response
Backend proxy ← Audio chunks             → Browser (speaker)
```

**Why a backend proxy:**
- Protects API key (never exposed to frontend)
- Injects system prompt with property context
- Can fall back to Groq Whisper STT + edge-tts if Gemini is unavailable

### 4.3 UI Design (Jotform-style)

Three tabs in the AI Assistant page:

| Tab | Description |
|-----|-------------|
| **Chat** | Text-based conversation with agents. Markdown responses. Property cards inline. |
| **Voice** | Push-to-talk or continuous listening. Animated waveform. Real-time transcription shown. Gemini Live handles the conversation. |
| **History** | Per-user conversation history. Searchable. Resumable sessions. |

### 4.4 Voice-Specific Features

- "Tell me about this property" — reads current property details aloud
- "Find me something cheaper" — voice-driven property search
- Nigerian English understanding (Gemini handles this natively)
- Fallback: Groq Whisper (STT) + Gemini text (LLM) + edge-tts (TTS) if Live API unavailable

---

## 5. Infrastructure (Oracle Cloud VM)

### 5.1 What Runs on Oracle Cloud Free Tier

Your existing Oracle Cloud VM (ARM64, 4 OCPU, 24GB RAM free tier) can host:

| Service | RAM | Purpose |
|---------|-----|---------|
| **Qdrant** | ~400MB | Vector DB for Mem0 memory |
| **Mem0 service** | ~200MB | Memory management layer |
| **Meilisearch** | ~500MB | Search engine (already needed) |

Total: ~1.1GB — well within free tier limits.

### 5.2 What Stays on Render/Vercel

- Backend API (Express) — stays on Render
- Frontend (Next.js) — stays on Vercel
- LLM calls go directly to Groq/Cerebras/SambaNova/Gemini (no self-hosted models needed)

### 5.3 Why NOT Self-Host LLMs

Valentine runs on free API tiers because self-hosting LLMs on ARM64 with 24GB RAM is impractical for quality models. Same applies here. The free tiers of Groq/Cerebras/SambaNova/Gemini provide better models than anything you could self-host.

---

## 6. AgentScope Assessment

### 6.1 What AgentScope Is

AgentScope is a Python framework for building multi-agent applications. It provides:
- Agent abstractions
- Message passing between agents
- Workflow pipelines (sequential, parallel, conditional)
- Built-in service functions (web search, code execution, file ops)
- Monitoring and logging dashboard

### 6.2 Verdict: NOT Recommended for This Project

**Why not:**
1. **Python-only** — your backend is Node.js/TypeScript. Adding a Python agent service creates a second runtime to maintain (you already have the scraper in Python — adding more Python increases operational complexity).
2. **Process-based** — designed for multi-process applications like Valentine. Your web app doesn't need OS-level process isolation.
3. **Overkill** — AgentScope's workflow engine, message bus, and monitoring are powerful but unnecessary when your agents are just LLM calls with tools.
4. **Alternative is simpler** — Vercel AI SDK (already in your Next.js stack) provides `generateText()`, `streamText()`, tool calling, and multi-step agents natively in TypeScript.

### 6.3 What to Use Instead

**Option A: Vercel AI SDK** (recommended — stays in TypeScript):
- Already compatible with your Next.js 16 stack
- Supports Groq, Google (Gemini), and custom providers
- Built-in streaming, tool calling, structured output
- No separate service to deploy

**Option B: LangGraph JS SDK** (if you need more complex agent workflows):
- Has a JavaScript/TypeScript SDK that works with Express
- Best for deterministic, debuggable, stateful pipelines
- More battle-tested than Vercel AI SDK for complex multi-step agents
- Steeper learning curve

**Option C: CrewAI** (if you prefer Python sidecar):
- Fastest path to working role-based agents
- Python-only — would run as a separate microservice
- Lowest learning curve for multi-agent setup

**Recommendation**: Start with **Vercel AI SDK** (simplest, no new deps). Migrate to **LangGraph JS** only if agent workflows become complex enough to need it.

**Pattern from Valentine to keep:**
- Intent routing (implement as a TypeScript function)
- Specialized system prompts per agent
- Fallback chain across providers
- Memory injection from Mem0 (Node.js SDK: `npm install mem0ai`)
- Circuit breaker for resilience

**Pattern from Valentine to skip:**
- Redis Streams message bus (use direct function calls)
- Process supervisor (not needed)
- Telegram adapter (not relevant)
- Skills system (not needed for web app)

---

## 7. Backup Solution

### 7.1 Recommendation: Databasus + CockroachDB CSV Export

> **Note:** CockroachDB's built-in `BACKUP` command requires an **Enterprise license**. For our free/self-managed CockroachDB, use pg_dump-compatible tools instead.

**Primary: Databasus** (~400k Docker pulls, most popular open-source backup tool as of 2026):
- Web UI for scheduling, one-click restore
- Supports PostgreSQL, MySQL, MongoDB
- Storage: local, S3, Cloudflare R2, Google Drive, Azure Blob, SFTP
- Single Docker container: `docker run -p 4005:4005 databasus/databasus`
- [GitHub](https://github.com/databasus/databasus)
- Can run on the Oracle Cloud VM

**CockroachDB-specific:**
- `cockroach sql --execute "EXPORT INTO CSV ..."` for table-level exports
- `pg_dump` works for most cases (CockroachDB is PostgreSQL wire-compatible)

**Fallback: pgBackRest** (for serious PostgreSQL-level ops):
- Full, differential, incremental backups
- Parallel backup and restore
- Overkill for current stage but available if data volumes grow

### 7.2 UI Integration

Instead of the current mock backup UI in Settings, wire it to:
1. **Trigger manual backup** → calls backend endpoint → Databasus API or pg_dump
2. **List backups** → queries Databasus backup history
3. **Download backup** → streams backup file to browser
4. **Schedule** → configures Databasus scheduled backups
5. **Retention** → configures how long to keep backups
6. **Storage** → Cloudflare R2 (free 10GB) or S3-compatible

---

## 8. What's Useful vs What's Not

| Feature | Verdict | Reason |
|---------|---------|--------|
| **Multi-agent with intent routing** | USEFUL | Keeps each agent focused and expert in its domain |
| **LLM fallback chain** | USEFUL | Free tiers have rate limits — failover is essential |
| **Mem0 memory** | USEFUL | Personalized experience, remembers user preferences |
| **Gemini Live voice** | USEFUL | Differentiator — voice property search is compelling |
| **Qdrant on Oracle VM** | USEFUL | Free vector DB, needed for Mem0 |
| **AgentScope** | NOT USEFUL | Wrong language, overkill for web app |
| **Redis message bus** | NOT USEFUL | Direct function calls are simpler for web app |
| **Self-hosted LLMs** | NOT USEFUL | Free API tiers are better quality |
| **MCP servers** | MAYBE LATER | Could be useful for tool extensibility but adds complexity |
| **Skills system** | NOT USEFUL | Over-engineered for this use case |

---

## 9. Implementation Plan

### Phase 1: Foundation (do with Phase 11 of master checklist)
1. Set up Vercel AI SDK in frontend + backend
2. Create LLM provider layer with fallback chain (Groq → Cerebras → SambaNova → Gemini)
3. Create circuit breaker + rate limiter
4. Build intent router
5. Build first agent: PropertySearchAgent (natural language → search)

### Phase 2: Intelligence Agents
6. PriceIntelAgent — price analysis, market comparison
7. MarketAnalysisAgent — trends, area reports
8. EnrichmentAgent — auto-fill missing property data
9. ScraperDiagAgent — diagnose scraper issues

### Phase 3: Memory
10. Deploy Qdrant on Oracle Cloud VM
11. Set up Mem0 service
12. Integrate memory into agent context
13. Build memory UI (what the AI remembers about user)

### Phase 4: Voice
14. Integrate Gemini 2.0 Flash Live API
15. Build voice chat UI (Jotform-style)
16. Backend WebSocket proxy for voice streaming
17. Fallback: Groq Whisper STT + edge-tts

### Phase 5: Chat UI
18. Build AI Assistant page with Chat + Voice + History tabs
19. Use AI Elements (elements.ai-sdk.dev) for chat UI components
20. Property cards inline in chat responses
21. Conversation persistence (per-user history in DB)

### Phase 6: Property-Aware AI
22. AI understands property versioning (origin, enrichment status, change history)
23. AI Price Estimate card on property detail page
24. Investment Analysis card
25. Neighborhood Profile card
26. "Ask AI about this property" button on every property page

---

## 10. Environment Requirements

### New Env Vars
```
# LLM Providers
GROQ_API_KEY=
CEREBRAS_API_KEY=
SAMBANOVA_API_KEY=
GOOGLE_AI_API_KEY=          # For Gemini

# Memory (Oracle Cloud VM)
QDRANT_URL=                  # http://oracle-vm-ip:6333
MEM0_API_URL=                # if using hosted Mem0, or local

# Voice
GEMINI_LIVE_API_KEY=         # Same as GOOGLE_AI_API_KEY
```

### Oracle Cloud VM Setup
```bash
# Qdrant
docker run -d -p 6333:6333 qdrant/qdrant

# Meilisearch (if moving off Render)
docker run -d -p 7700:7700 getmeili/meilisearch
```

---

## 11. Property Versioning & AI Understanding

The AI assistant MUST understand the property data lifecycle:

```
SCRAPED (origin=SCRAPED, enrichmentStatus=RAW)
  → GEOCODED (ChangeSource.GEOCODING, enrichmentStatus=PARTIALLY_ENRICHED)
  → LLM ENRICHED (ChangeSource.ENRICHMENT, enrichmentStatus=FULLY_ENRICHED)
  → USER EDITED (ChangeSource.MANUAL_EDIT)
  → RE-SCRAPED (ChangeSource.SCRAPER, price changed → PriceHistory entry)
  → MANUALLY VERIFIED (enrichmentStatus=MANUALLY_VERIFIED)
```

Each agent's system prompt includes this lifecycle so it can:
- Explain version history to users
- Identify what data came from scraping vs enrichment vs manual edit
- Flag stale data that needs re-scraping
- Suggest enrichment for RAW properties

---

*This plan is pending your approval. Once approved, relevant sections will be merged into MASTER_CHECKLIST.md Phase 11.*
