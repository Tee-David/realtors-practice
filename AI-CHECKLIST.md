# AI Implementation Checklist

> Based on [plans/AI_INTELLIGENCE.md](plans/AI_INTELLIGENCE.md). Every AI feature is **opt-in and toggle-able**. The app must work perfectly without any AI feature enabled.

---

## Design Principles

- **Enhancement, not dependency** — Every AI feature has a non-AI fallback that already works.
- **Feature toggles** — Global master switch + per-feature switches in Settings. Stored in DB (`system_settings` table), cached in Redis. When a feature is off, its UI placeholder shows "Enable in Settings" instead of "Coming Soon".
- **Graceful degradation** — If all AI providers are down, features silently fall back to non-AI behavior. No error modals, no broken pages. Just the existing app.
- **User clarity** — AI-generated content is always labeled (small "AI" badge). Users know what's AI and what's real data.
- **Rate limit awareness** — Track usage per provider. When approaching limits, auto-rotate. Show usage in the AI status panel so the admin knows.
- **Privacy** — No property data leaves the system except through the AI provider APIs. mem0 stores preferences locally on the Oracle VM, not in any cloud.

---

## Phase 0: Foundation (Must do first)

### 0.1 AI Feature Toggle System
- [ ] Create `ai_feature_flags` table in Prisma schema:
  ```
  id, featureKey (unique), enabled (bool), config (JSON), updatedAt
  ```
- [ ] Seed default flags (all disabled):
  - `ai_master` — global kill switch
  - `ai_chat` — chat assistant
  - `ai_nl_search` — natural language search parsing
  - `ai_property_scoring` — quality/fraud scoring
  - `ai_market_reports` — auto-generated market reports
  - `ai_enrichment` — listing auto-enrichment
  - `ai_duplicate_detection` — cross-source duplicate finding
  - `ai_scraper_diagnosis` — scraper failure analysis
  - `ai_smart_notifications` — AI-prioritized notification digest
  - `ai_investment_analysis` — ROI/yield estimates
  - `ai_neighborhood_profiles` — AI-generated area profiles
  - `ai_telegram_bot` — Telegram integration
- [ ] Backend: `GET /api/settings/ai-features` — returns all flags
- [ ] Backend: `PATCH /api/settings/ai-features/:key` — toggle a feature
- [ ] Frontend: Add "AI Features" section to Settings page with toggle switches
  - Master toggle at the top (disables all when off)
  - Per-feature toggles below (only active when master is on)
  - Each toggle shows: feature name, description, status (on/off/no API key)
- [ ] Frontend: Create `useAIFeatures()` hook that caches flags via React Query
- [ ] Middleware: `requireAIFeature(key)` Express middleware that checks if feature is enabled before processing AI routes

### 0.2 Backend AI Service (Provider Router)
- [ ] Create `backend/src/services/ai.service.ts`:
  - Provider rotation: Groq → Cerebras → SambaNova → Gemini
  - Streaming support (SSE)
  - Rate limit tracking per provider (in-memory counter, reset every minute)
  - Auto-retry with next provider on failure
  - Configurable thinking mode (`/think` vs `/no_think` via Qwen3)
  - Token counting for usage tracking
- [ ] Create `backend/src/services/ai-usage.service.ts`:
  - Track requests per provider per day
  - Track tokens consumed per day
  - Store in `ai_usage_log` table (provider, tokens_in, tokens_out, latency_ms, feature, created_at)
  - Expose via `GET /api/ai/usage` for the status dashboard
- [ ] Update AI health endpoint to include rate limit proximity warnings
- [ ] Add usage stats to the AI Provider Status panel (requests today, tokens used, % of daily limit)

### 0.3 AI Status Panel Enhancement
- [ ] Add rate limit usage bars to each provider card (X/Y requests used today)
- [ ] Add token usage summary (total tokens in/out today across all providers)
- [ ] Add "Last successful request" timestamp per provider
- [ ] Add provider failover log (last 10 failovers with reason)

---

## Phase 1: AI Chat Assistant

### 1.1 Backend Chat API
- [ ] `POST /api/ai/chat` — streaming endpoint (SSE)
  - Accepts: `{ message, conversationId?, context? }`
  - Returns: Server-Sent Events stream (token by token)
  - Injects system prompt with Nigerian property context
  - Respects `ai_chat` feature flag
- [ ] Define chat tools the LLM can call:
  - `search_properties` — queries the DB with filters
  - `get_property_detail` — fetches a specific property
  - `get_market_stats` — area statistics
  - `get_analytics` — dashboard metrics
- [ ] Conversation history: store in `ai_conversations` table (userId, messages JSON, createdAt, updatedAt)
- [ ] Rate limit: max 30 messages/hour per user (configurable via feature flag config JSON)

### 1.2 Frontend Chat UI (AI Elements)
- [ ] Install AI Elements: `npx shadcn@latest add https://elements.ai-sdk.dev/api/registry/all.json`
- [ ] Restyle all AI Elements components to match theme (primary #0001FC, accent #FF6600, Space Grotesk/Outfit)
- [ ] Replace the placeholder chat FAB with real chat powered by `useChat` from `@ai-sdk/react`
- [ ] Components to implement:
  - Conversation wrapper with ConversationContent and ConversationEmptyState
  - Message with MessageContent (user/assistant)
  - PromptInput with textarea, submit, model selector
  - Markdown renderer for responses
  - ToolInvocation for property search results, analytics
  - Reasoning panel (collapsible chain-of-thought)
  - Typing indicator (animated dots during streaming)
- [ ] Suggested action chips: "Find a property", "Market report", "Analyze investment", "Check scraper"
- [ ] Contextual awareness: detect current page and pre-load context
  - On property detail: "Ask about this property" chip
  - On search results: "Refine this search" chip
  - On scraper: "Diagnose last failure" chip
- [ ] Conversation history sidebar (list past conversations)

### 1.3 Nuances & Edge Cases
- [ ] **Empty responses**: If LLM returns empty or gibberish, show "I couldn't process that. Try rephrasing?" — don't show raw error
- [ ] **Tool call failures**: If `search_properties` tool returns 0 results, LLM should say so naturally, not return an empty card grid
- [ ] **Long responses**: Truncate at ~2000 tokens. Add "Show more" if response is very long
- [ ] **Offensive content**: Basic content filter on responses (check for slurs, scams). Nigerian real estate has specific fraud patterns
- [ ] **Concurrent sessions**: User can have multiple conversations. Default to last active
- [ ] **Mobile UX**: Chat panel should be full-screen on mobile, not a small floating panel
- [ ] **Offline/backend down**: Chat FAB shows "Backend unreachable" state, doesn't open a broken panel

---

## Phase 2: Natural Language Search (S1)

### 2.1 Backend NL Parser
- [ ] `POST /api/ai/parse-query` — parses NL to structured filters
  - Input: `{ query: "3 bed flat in Lekki under 5M" }`
  - Output: `{ bedrooms: 3, type: "flat", area: "Lekki", maxPrice: 5000000 }`
  - Uses Groq (fast, `/no_think` mode)
  - Respects `ai_nl_search` feature flag
- [ ] Nigerian slang dictionary in system prompt:
  - "selfcon" / "self-con" → studio/1-bed
  - "boys quarter" / "BQ" → separate guest quarters
  - "face-me-I-face-you" → shared compound
  - "storey building" → multi-floor
  - "bungalow" → single floor detached
  - "VI" → Victoria Island
  - "Phase 1/2" → Lekki Phase 1/2
  - Naira shorthand: "5M" = 5,000,000, "30k" = 30,000
- [ ] Cache common query patterns in Redis (TTL 24h) to avoid repeated LLM calls
- [ ] Fallback: If AI is off or fails, use existing regex parser (already works for basic queries)

### 2.2 Frontend Search Enhancement
- [ ] Show "AI-interpreted" badge when NL parser is used
- [ ] Display parsed interpretation: "Searching for: 3 bedroom flat in Lekki, max ₦5,000,000"
- [ ] Allow user to edit the parsed filters (click to modify)
- [ ] If NL parse fails, silently fall back to keyword search (no error to user)

### 2.3 Nuances
- [ ] **Ambiguous queries**: "something cheap in Lagos" — LLM should return reasonable defaults, not ask 10 clarifying questions
- [ ] **Mixed language**: Some users type Pidgin English. System prompt should handle "I wan buy house for Lekki"
- [ ] **Currency handling**: "5M" could be ₦5M or $5M. Default to Naira. If "$" or "USD" present, convert
- [ ] **Location disambiguation**: "Lekki" could be Lekki Phase 1, Phase 2, Lekki Epe Expressway. Default to all Lekki unless specified

---

## Phase 3: Property Intelligence

### 3.1 Quality & Fraud Scoring (S6, Use Case 2)
- [ ] Background job: score new properties on scrape completion
  - Completeness (0-100): photos, description length, price, location, bedrooms filled?
  - Price plausibility (0-100): within ±2σ of area median for same type/beds?
  - Description quality (0-100): LLM rates for originality, detail, red flags
  - Overall quality score: weighted average
- [ ] Fraud flags (detected by LLM):
  - "Call agent for viewing fee" — known Nigerian scam pattern
  - Price too low for area (e.g., N500K/month for Lekki duplex)
  - Templated/copy-pasted descriptions across multiple listings
  - Multiple listings with same phone number but different agents
- [ ] Store scores in `Property.qualityScore` (already exists) + new `Property.fraudFlags` JSON
- [ ] Feature flag: `ai_property_scoring`
- [ ] Fallback: If AI off, use rule-based completeness scoring (no LLM)

### 3.2 Auto-Enrichment (Use Case 8)
- [ ] After scraping, LLM extracts from description:
  - Nearby amenities mentioned ("close to Shoprite", "5 min from Third Mainland")
  - Property condition hints ("newly built", "just renovated", "needs work")
  - Suggested tags not in structured fields
- [ ] Store in `Property.aiEnrichment` JSON field
- [ ] Feature flag: `ai_enrichment`
- [ ] Fallback: Property displays without enrichment (already works)

### 3.3 "Why This Property" Explainer (S7)
- [ ] On search results: one-line explanation per property
  - "Matches your budget and preferred area, has the parking you mentioned"
- [ ] Single batch LLM call for top 10 results (not 10 separate calls)
- [ ] Feature flag: part of `ai_nl_search`
- [ ] Fallback: No explanation shown (search results work normally)

### 3.4 Frontend Display
- [ ] Quality score badge on property cards (color-coded: green/yellow/red)
- [ ] Fraud warning banner on property detail if flagged
- [ ] "AI Enriched" tag on listings that have been enriched
- [ ] "Why this property" line below each search result (subtle, small text)

### 3.5 Nuances
- [ ] **False positives**: Fraud detection will flag some legitimate listings. Show as "Review suggested" not "Fraud detected". Never hide listings — just warn
- [ ] **Score transparency**: Users should be able to click the score and see breakdown (completeness, price, description)
- [ ] **Re-scoring**: When a property is updated (new version), re-score it. Don't keep stale scores
- [ ] **Batch efficiency**: Score properties in batches of 10-20, not one by one. One LLM call per batch

---

## Phase 4: Market Intelligence

### 4.1 Auto-Generated Area Reports (Use Case 3)
- [ ] Weekly cron job (ZeroClaw scheduler or simple node-cron):
  - For each active area (>10 listings): aggregate stats → LLM generates 3-paragraph market summary
  - Store in `market_reports` table (area, period, content, generatedAt)
- [ ] `GET /api/ai/market-report/:area` — returns cached report
- [ ] Feature flag: `ai_market_reports`
- [ ] Fallback: Market page shows raw stats without AI narrative

### 4.2 Investment Analysis (Use Case 5, S10)
- [ ] `POST /api/ai/analyze-investment` — single property analysis
  - Pulls comparables within 2km
  - Calculates estimated rental yield
  - LLM generates investment verdict
- [ ] Comparative analysis: 2-5 properties → markdown table + recommendation
- [ ] Feature flag: `ai_investment_analysis`
- [ ] Fallback: Property detail shows raw price/stats without AI analysis

### 4.3 Neighborhood Profiles (M2)
- [ ] Generate AI profile per neighborhood:
  - Average prices, typical property types
  - Nearby amenities (from OSM data if available, otherwise from listing descriptions)
  - Transport links, lifestyle description
  - 3-sentence summary
- [ ] Cache heavily (profiles change slowly — refresh weekly)
- [ ] Feature flag: `ai_neighborhood_profiles`
- [ ] Fallback: Map/search shows properties without area narratives

### 4.4 Nuances
- [ ] **Data quality**: Reports are only as good as the data. If only 5 listings in an area, say "Limited data" — don't generate confident-sounding reports from sparse data
- [ ] **Outdated reports**: Show generation date prominently. "Generated Mar 2026 from 234 listings"
- [ ] **User expectations**: Investment analysis is NOT financial advice. Add clear disclaimer: "AI estimate for informational purposes only. Not financial advice."
- [ ] **Area normalization**: "Lekki Phase 1" and "Lekki Ph. 1" and "Lekki Phase One" are the same area. Normalize before generating reports

---

## Phase 5: Scraper Intelligence

### 5.1 Failure Diagnosis (Use Case 6)
- [ ] When a scrape job completes with 0 results or high error rate:
  - Pull last 50 log lines for that job
  - Send to LLM with context (site name, selectors, error messages)
  - LLM returns: { diagnosis, severity, suggestedAction }
  - Store in `scrape_diagnoses` table
- [ ] Show diagnosis card on scraper page when available
- [ ] Feature flag: `ai_scraper_diagnosis`
- [ ] Fallback: Scraper shows raw error logs (already works)

### 5.2 Auto-Heal CSS Selectors (Use Case 11)
- [ ] When CSS extraction fails for a site:
  - Fetch page HTML sample (first 8K tokens)
  - LLM generates fresh CSS selectors
  - Cache in Redis per domain (TTL 7 days)
  - Use on next scrape attempt
- [ ] Feature flag: part of `ai_scraper_diagnosis`
- [ ] Fallback: Scraper uses existing configured selectors or LLM full-page extraction

### 5.3 Nuances
- [ ] **Cost awareness**: Each selector generation is 1 LLM call (~500 tokens). Only trigger on failure, not every scrape
- [ ] **Selector validation**: After LLM generates selectors, validate them against the HTML before caching. If they return 0 results on the sample, discard
- [ ] **Admin visibility**: Show in scraper page: "AI auto-healed selectors for propertypro.ng (2 days ago)"

---

## Phase 6: Smart Notifications

### 6.1 AI Notification Digest (Use Case 9)
- [ ] Instead of 20 individual "new match" alerts, generate a weekly digest:
  - "12 new properties matching your searches. Best value: [X] at ₦27M. Prices trending down 3% in Lekki."
- [ ] Feature flag: `ai_smart_notifications`
- [ ] Fallback: Individual notification cards (already works)

### 6.2 Semantic Saved Search Alerts (S9)
- [ ] When user saves "family home in safe Lekki estate":
  - Store both structured filters AND embedding of original query
  - New listings: embed → similarity check against saved searches
  - Alert on semantic match even without keyword overlap
- [ ] Feature flag: part of `ai_smart_notifications`
- [ ] Fallback: Saved searches use exact filter matching (already works)

### 6.3 Nuances
- [ ] **Notification fatigue**: AI digest should reduce notifications, not add more. Default to weekly digest, not daily
- [ ] **Unsubscribe**: Each AI-generated alert has clear "Stop these" option
- [ ] **Preview before send**: In Settings, let user preview what the digest would look like before enabling

---

## Phase 7: Telegram Bot

### 7.1 Bot Setup
- [ ] Create Telegram bot via @BotFather
- [ ] Set up webhook to ZeroClaw on Oracle VM
- [ ] Whitelist-based access control (store authorized Telegram user IDs in DB)
- [ ] Feature flag: `ai_telegram_bot`

### 7.2 Bot Commands
- [ ] `/search 3 bed Lekki under 5M` — property search with formatted results
- [ ] `/market Lekki` — area market summary
- [ ] `/alert 2bed Ikoyi under 20M` — create saved search alert
- [ ] `/status` — scraper and system health

### 7.3 Nuances
- [ ] **Rate limit per user**: 30 messages/hour to protect API quota
- [ ] **Rich formatting**: Use Telegram Markdown for property cards (bold title, italic area, price)
- [ ] **Photo support**: Send first property image as inline photo, not just text
- [ ] **Authorization flow**: Unknown users get "Contact admin for access" — not silence

---

## Phase 8: Embeddings & Semantic Search (S2)

### 8.1 Embedding Pipeline
- [ ] Embed all existing properties using `nomic-embed-text` or provider embedding API
- [ ] Store vectors in pgvector column on Property table (or separate `property_embeddings` table)
- [ ] Embed new properties on scrape completion (background job)
- [ ] Embed text: `{title} {description} {area} {category} {features}`

### 8.2 Semantic Search
- [ ] `POST /api/search/semantic` — embedding-based similarity search
- [ ] Blend: 60% semantic score + 40% filter score
- [ ] Feature flag: part of `ai_nl_search`
- [ ] Fallback: Meilisearch keyword search (already works)

### 8.3 Nuances
- [ ] **Embedding cost**: One-time batch for existing properties. Per-property for new ones. Track token usage
- [ ] **Stale embeddings**: When property is updated, re-embed. Don't serve stale similarity results
- [ ] **Cold start**: If embeddings aren't generated yet, fall back to keyword search silently

---

## Phase 9: mem0 Memory Layer

### 9.1 Setup on Oracle VM
- [ ] Docker Compose: mem0 FastAPI + PostgreSQL/pgvector + FalkorDB (or vector-only mode)
- [ ] Configure mem0 to use Groq API for memory extraction
- [ ] Internal API access from backend

### 9.2 Integration
- [ ] Chat assistant stores user preferences: "I prefer Lekki", "budget is 30M"
- [ ] Next session: mem0 retrieves relevant memories and injects into system prompt
- [ ] Per-user memory isolation

### 9.3 Nuances
- [ ] **Memory cleanup**: Let users view and delete their AI memories in Settings
- [ ] **Memory drift**: If user says "I changed my budget to 50M", old memory should be updated, not duplicated
- [ ] **Privacy**: Make it clear in Settings what the AI remembers. "The AI assistant remembers: your preferred areas, budget range, property preferences"
- [ ] **Optional**: mem0 is a nice-to-have. Chat works without it (just no memory between sessions). Don't block other features on mem0 setup

---

## Implementation Order

| Priority | Phase | Dependency | Effort |
|----------|-------|------------|--------|
| 1 | 0.1 Feature Toggle System | None | 1 day |
| 2 | 0.2 Backend AI Service | 0.1 | 1 day |
| 3 | 0.3 Status Panel Enhancement | 0.2 | 0.5 day |
| 4 | 2 NL Search | 0.2 | 1 day |
| 5 | 1 Chat Assistant | 0.2, AI Elements | 2-3 days |
| 6 | 3.1 Property Scoring | 0.2 | 1 day |
| 7 | 4.1 Market Reports | 0.2 | 1 day |
| 8 | 5 Scraper Intelligence | 0.2 | 1 day |
| 9 | 3.2 Auto-Enrichment | 0.2 | 0.5 day |
| 10 | 6 Smart Notifications | 0.2, 8 | 1 day |
| 11 | 4.2-4.3 Investment + Neighborhoods | 0.2 | 1 day |
| 12 | 8 Embeddings/Semantic Search | 0.2 | 1-2 days |
| 13 | 7 Telegram Bot | 0.2, ZeroClaw | 1-2 days |
| 14 | 9 mem0 Memory | Oracle VM access | 1 day |

**Total estimated: ~14-17 days of work**

---

## Cross-Cutting Concerns

### Error Handling
- [ ] Every AI call has a 10s timeout (8s for health checks)
- [ ] Every AI feature has an explicit non-AI fallback path
- [ ] Failed AI calls are logged but never shown as errors to users
- [ ] Provider failover is invisible to users

### Cost Tracking
- [ ] `ai_usage_log` table tracks every LLM call
- [ ] Dashboard widget shows daily/weekly usage across providers
- [ ] Alert when approaching 80% of any provider's daily limit

### Testing
- [ ] Mock AI provider responses for unit tests
- [ ] Integration tests with real APIs for critical paths (NL parse, chat)
- [ ] Feature flag tests: verify every feature degrades gracefully when toggled off

### Security
- [ ] AI API keys never exposed to frontend (all calls go through backend)
- [ ] Chat input sanitized before sending to LLM (strip HTML, limit length to 2000 chars)
- [ ] LLM output sanitized before rendering (prevent XSS via markdown injection)
- [ ] Telegram bot validates webhook signatures
- [ ] Rate limit all AI endpoints per user (prevent quota abuse)

---

*Created 2026-03-20. Based on plans/AI_INTELLIGENCE.md.*
