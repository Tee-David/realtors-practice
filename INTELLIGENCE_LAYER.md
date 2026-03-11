# Intelligence Layer: ZeroClaw + Ollama for Nigerian Property Intelligence

> **Status**: Proposal — for review before any implementation begins.
> **Scope**: Separate feature wrapper on top of the existing Realtors' Practice platform.
> **TL;DR**: Yes, ZeroClaw + Ollama can give you a genuine competitive moat. But only if scoped to the right problems. This document breaks down exactly where it fits, where it doesn't, and what the architecture looks like at 1M properties / 10K users.

---

## 1. What is ZeroClaw, Actually?

ZeroClaw is **not** an AI model. It's an **AI agent runtime** — infrastructure that lets you deploy autonomous AI agents that can:
- **Reason** with any LLM (Ollama, OpenAI, Anthropic, etc.)
- **Remember** across sessions (built-in SQLite + vector search, zero external deps)
- **Act** via tools (custom Python/shell functions you define)
- **Schedule** recurring analysis jobs (built-in cron)
- **Scale** to 1,000 concurrent agents per node with <5MB RAM each

### Key specs:
| Metric | ZeroClaw | OpenClaw (Node.js) |
|---|---|---|
| RAM per agent | ~3-5 MB | ~200MB-1GB+ |
| Cold start | <10ms | ~2-5s |
| Binary size | ~8.8 MB | ~200MB+ (with node_modules) |
| Language | Rust (memory-safe, zero GC pauses) | TypeScript/Node.js |
| Ollama support | First-class, native config | Via plugins |
| Memory backend | SQLite (built-in), Postgres, Markdown | External vector DB required |

### What Ollama brings:
- Run LLMs **locally** — no API costs, no data leaving your servers
- Models: Llama 3.2, Qwen 3, Mistral, Phi-3, DeepSeek, etc.
- Fine-tunable on your own property data (Modelfiles)
- GPU acceleration or CPU-only mode

---

## 2. Do You Actually Need This?

### Honest assessment:

| Need | Without AI agents | With ZeroClaw + Ollama |
|---|---|---|
| Price trends | SQL aggregations + Recharts | AI interprets trends, detects anomalies, generates natural language insights |
| Investment heatmap | Manual analysis, hardcoded zones | Agent auto-classifies neighborhoods based on price velocity, development permits, infrastructure |
| Rental yield atlas | Basic formula (rent × 12 / price) | Agent factors in vacancy rates, seasonal patterns, neighborhood growth, comparable yields |
| Property risk scoring | Quality score from scraper (0-100) | Multi-factor risk model: price anomaly detection, agent/listing fraud signals, market timing risk |
| Developer reputation | Not possible without AI | Agent aggregates: delivery track record, price vs. actual, review sentiment, project completion rates |
| Demand cycles | Not possible at this scale | Agent detects search demand patterns, seasonal pricing, correlates with economic indicators |

### **Verdict: YES, but only for the intelligence/analytics layer.**

Your scraper, API, search, and UI should **not** touch ZeroClaw. It's a wrapper that **interprets** the data your existing platform collects.

---

## 3. Architecture: How It Fits

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXISTING PLATFORM (unchanged)                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Frontend  │  │ Backend  │  │ Scraper  │  │  Meilisearch  │  │
│  │ (Next.js) │  │ (Express)│  │ (Python) │  │  (Search)     │  │
│  └─────┬─────┘  └─────┬────┘  └────┬─────┘  └───────────────┘  │
│        │              │             │                            │
│        │     ┌────────┴────────┐    │                            │
│        │     │   PostgreSQL    │    │                            │
│        │     │   (CockroachDB) │    │                            │
│        │     └────────┬────────┘    │                            │
└────────┼──────────────┼─────────────┼────────────────────────────┘
         │              │             │
    ─────┼──────────────┼─────────────┼─────── INTELLIGENCE BOUNDARY
         │              │             │
┌────────┼──────────────┼─────────────┼────────────────────────────┐
│        ▼              ▼             ▼                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              INTELLIGENCE GATEWAY (REST API)             │    │
│  │          /api/intelligence/* endpoints                    │    │
│  │     Thin Express or FastAPI service that dispatches       │    │
│  │     requests to ZeroClaw agents                          │    │
│  └──────────────────────┬──────────────────────────────────┘    │
│                         │                                       │
│  ┌──────────────────────▼──────────────────────────────────┐    │
│  │              ZEROCLAW AGENT RUNTIME                      │    │
│  │                                                          │    │
│  │  ┌────────────────┐  ┌────────────────┐                 │    │
│  │  │ Price Analyst  │  │ Risk Scorer    │                 │    │
│  │  │ Agent          │  │ Agent          │                 │    │
│  │  └────────────────┘  └────────────────┘                 │    │
│  │  ┌────────────────┐  ┌────────────────┐                 │    │
│  │  │ Market Intel   │  │ Demand Cycle   │                 │    │
│  │  │ Agent          │  │ Agent          │                 │    │
│  │  └────────────────┘  └────────────────┘                 │    │
│  │  ┌────────────────┐  ┌────────────────┐                 │    │
│  │  │ Developer Rep  │  │ Neighborhood   │                 │    │
│  │  │ Agent          │  │ Growth Agent   │                 │    │
│  │  └────────────────┘  └────────────────┘                 │    │
│  └──────────────────────┬──────────────────────────────────┘    │
│                         │                                       │
│  ┌──────────────────────▼──────────────────────────────────┐    │
│  │              OLLAMA (Local LLM Server)                   │    │
│  │     Model: llama3.2:8b or qwen3:8b (quantized)          │    │
│  │     Fine-tuned on Nigerian property terminology          │    │
│  │     GPU: Optional (works on CPU with quantized models)   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│                  INTELLIGENCE LAYER (new microservice)          │
└─────────────────────────────────────────────────────────────────┘
```

### Key principle: **The intelligence layer reads from your DB. It never writes to it directly.** It produces analytics, scores, and insights that your existing backend exposes via new API endpoints.

---

## 4. The 7 Intelligence Agents

### Agent 1: Nigerian House Price Index Agent
**What it does**: Generates a rolling house price index by area, property type, and listing type.
**How**: Queries PriceHistory + Property tables → computes weighted median prices → uses LLM to generate trend narratives ("Lekki Phase 1 sale prices increased 12% QoQ, driven by new estate completions").
**Schedule**: Weekly cron via ZeroClaw.
**Scale**: At 1M properties ×  avg 3 price history records = 3M rows. A PostgreSQL aggregation query runs in <2s. The LLM generates 50-100 area summaries = ~50 Ollama calls. At ~2s per call = 100s total. **Easily handles scale.**

### Agent 2: Lagos Investment Heatmap Agent
**What it does**: Scores every area/LGA on investment potential (0-100) based on:
- Price appreciation velocity (last 6/12 months)
- Listing volume trends (growing = demand signal)
- Average days on market (lower = hotter)
- Infrastructure proximity scores (from enrichment data)
- Quality score averages (higher quality listings = more mature market)

**How**: SQL aggregations → LLM ranks and classifies zones → outputs GeoJSON-ready heatmap data.
**Schedule**: Weekly.
**Scale**: ~50-100 distinct areas in Lagos. 100 LLM calls/week. **Trivial.**

### Agent 3: Rental Yield Atlas Agent
**What it does**: For every area, computes rental yield = (annual rent / sale price) × 100 for comparable properties.
**How**: Joins RENT and SALE listings in same area/bedrooms → computes yields → LLM annotates with context ("Yaba yields 8.2% — highest in mainland Lagos, driven by tech worker demand").
**Scale**: Same as heatmap. **Trivial.**

### Agent 4: Property Risk Scoring Agent
**What it does**: Assigns a 0-100 risk score to individual properties:
- Price anomaly detection (>2σ below area median → suspicious)
- Listing duplication signals (same images across different agents)
- Agent verification status
- Market timing risk (buying at peak vs. trough)
- Legal document completeness (C of O mentioned vs. not)

**How**: Feature extraction (SQL) → LLM interprets combined signals → risk score + explanation.
**Schedule**: On-demand (when user views property detail) + batch weekly.
**Scale at 1M properties**: Batch = 1M properties, but only new/changed ones need rescoring. Typically ~5-10K/week. At 2s/call = ~5.5 hours. Can be parallelized across multiple ZeroClaw agents to ~30 minutes. **Manageable.**

### Agent 5: Developer Reputation Agent
**What it does**: Scores real estate developers/agencies based on:
- Number of listings (volume)
- Average quality scores of their listings
- Price consistency (do they inflate?)
- Listing freshness (do they update or leave stale listings?)
- Multi-site presence (listed on multiple platforms = more serious)

**How**: Group by agentName/agencyName → aggregate metrics → LLM generates reputation profile.
**Scale**: ~500-2000 unique agents/agencies. **Trivial.**

### Agent 6: Neighborhood Growth Pattern Agent
**What it does**: Detects emerging neighborhoods before they become mainstream:
- Rapid listing volume increase (early signal)
- Price acceleration (positive second derivative)
- New property type diversification (e.g., commercial entering a previously residential area)
- Search demand correlation (from Meilisearch query logs)

**How**: Time-series analysis (SQL windowed queries) → LLM interprets patterns → generates "emerging neighborhood" reports.
**Scale**: ~50-100 areas. **Trivial.**

### Agent 7: Demand Cycle Agent
**What it does**: Identifies seasonal and cyclical demand patterns:
- When do Lagos rents peak? (hint: typically Q4 before school year)
- When are sale prices lowest? (typically rainy season / mid-year)
- Which property types have counter-cyclical demand?

**How**: Time-series decomposition on listing volumes + prices by month → LLM generates demand calendar.
**Schedule**: Monthly.
**Scale**: Aggregation over time = small dataset. **Trivial.**

---

## 5. Scale Analysis: 1M Properties, 10K Users

### The numbers:

| Component | Load | Bottleneck? |
|---|---|---|
| ZeroClaw runtime | ~5MB RAM per agent × 7 agents = 35MB | ❌ No |
| Ollama (llama3.2:8b Q4) | ~6-8 GB VRAM or ~8GB RAM (CPU) | ⚠️ Only if running many concurrent LLM calls |
| PostgreSQL reads | Aggregation queries on 1M rows | ❌ No — your indexes are already excellent |
| Weekly batch jobs | ~5K-10K LLM calls/week | ❌ No — spread over hours, easily handled |
| On-demand (user requests) | 10K users × maybe 5 AI requests/day = 50K/day | ⚠️ Needs caching strategy |

### How to handle 50K daily on-demand requests:

1. **Cache aggressively**: Price index, heatmap, yields, and neighborhood data change weekly. Cache in Redis for 24h. That eliminates ~90% of LLM calls.
2. **Pre-compute everything possible**: The 7 agents run on schedules (weekly/monthly). Results are stored in a `intelligence_cache` table. Frontend reads from cache, not from live LLM.
3. **On-demand = only property risk scoring**: When a user views a specific property that hasn't been scored yet. Even then, cache the result. Each property only needs scoring once until its data changes.
4. **Result**: Actual LLM calls drop from 50K/day to maybe 500-1000/day. Ollama on a single 8GB GPU handles this easily.

### Hardware: Oracle Cloud Free Tier (our deployment target)

Oracle Cloud offers an **Always Free** ARM A1 instance: **4 OCPUs + 24GB RAM** — this is our deployment target.

| Component | Spec on Oracle Free Tier | Sufficient? |
|---|---|---|
| **CPU** | 4x ARM Ampere A1 OCPUs | ✅ Ollama runs well on ARM |
| **RAM** | 24 GB | ✅ 8b quantized model uses ~6-8GB, plenty left for ZeroClaw + OS |
| **Storage** | 200 GB block volume (free) | ✅ Models + data fit easily |
| **GPU** | None (CPU-only) | ⚠️ Slower inference, but fine for batch/scheduled jobs |
| **Network** | 10 TB/month outbound (free) | ✅ More than enough |
| **Cost** | **$0/month forever** | 🎉 |

**Recommended Ollama models for CPU-only ARM:**

| Model | Size (Q4) | RAM Usage | Inference Speed (ARM) | Best For |
|---|---|---|---|---|
| llama3.2:3b | ~2 GB | ~3-4 GB | ~15-20 tok/s | Dev/testing, quick analysis |
| llama3.2:8b Q4_K_M | ~4.7 GB | ~6-8 GB | ~8-12 tok/s | **Production (recommended)** |
| qwen3:8b Q4_K_M | ~4.5 GB | ~6-7 GB | ~8-12 tok/s | Alternative with good multilingual |
| phi-3:3.8b | ~2.3 GB | ~4 GB | ~12-18 tok/s | Lightweight, fast |

> **Key insight**: 8-12 tokens/second on CPU is perfectly fine for batch analytics. A weekly price index report takes ~100 LLM calls × ~5s each = ~8 minutes total. That's nothing for a scheduled job. You only need GPU speed for real-time chat, which we don't do.

**Oracle Free Tier deployment steps:**
```bash
# 1. Provision ARM A1.Flex (4 OCPU, 24GB RAM) on Oracle Cloud
# 2. Install Ollama
curl -fsSL https://ollama.com/install.sh | sh
# 3. Pull model
ollama pull llama3.2:8b
# 4. Install ZeroClaw
curl -fsSL https://raw.githubusercontent.com/zeroclaw-labs/zeroclaw/master/install.sh | bash
# 5. Configure zeroclaw.toml with ollama provider
# 6. Run as systemd service
```

> **Scaling path**: If you outgrow Oracle free tier (unlikely for batch analytics), Oracle also offers A10G GPU instances at ~$1.28/hr on-demand. But with pre-compute + caching, the free ARM instance should handle 1M properties easily.

---

## 6. Competitive Moat Assessment

### What makes this data hard to replicate:

| Data Asset | Time to Build | Replicability |
|---|---|---|
| 1M scraped properties | 6-12 months | Medium — anyone can scrape |
| Historical price data (PriceHistory) | Ongoing, cumulative | **Hard** — you need to have been collecting for months/years |
| Nigerian house price index | Derived from above | **Very hard** — requires sustained data collection + methodology |
| Investment heatmap | Derived from above | **Very hard** — same reason |
| Demand cycle analysis | Requires search logs + time | **Extremely hard** — proprietary behavioral data |
| Developer reputation scores | Requires cross-platform crawling | **Hard** — domain expertise needed |

### The compound effect:
Every week you run these agents, your intelligence dataset gets **more valuable**. Historical trend data is impossible to backfill. A competitor starting today cannot replicate 12 months of your price history, demand cycles, or neighborhood growth patterns. **This is the real moat.**

---

## 7. What ZeroClaw Specifically Gives You (vs. just calling Ollama directly)

You might ask: "Why not just write a Python script that calls Ollama?"

| Feature | Raw Ollama API | ZeroClaw + Ollama |
|---|---|---|
| Agent memory (remembers past analysis) | ❌ You build it | ✅ Built-in SQLite vector memory |
| Tool calling (query DB, fetch data) | ❌ You build it | ✅ Native tool framework |
| Scheduled jobs | ❌ Use external cron | ✅ Built-in cron system |
| Multi-agent orchestration | ❌ You build it | ✅ Hierarchical agent support |
| Provider swapping (Ollama → OpenAI) | ❌ Code changes | ✅ Config change only |
| Concurrent agent scaling | ❌ You build it | ✅ 1K agents/node, <5MB each |
| Secure sandbox execution | ❌ You build it | ✅ Workspace isolation + allowlists |
| Gateway API for frontend | ❌ You build it | ✅ Built-in REST gateway |

**Bottom line**: ZeroClaw saves you ~2-3 months of building agent infrastructure. You focus on the **property intelligence logic**, not the plumbing.

---

## 8. Practical Implementation Path

### Phase A: Foundation (1-2 weeks)
- Install Ollama + pull llama3.2:8b
- Install ZeroClaw binary
- Create `intelligence/` directory in project root
- Configure ZeroClaw to use Ollama provider
- Define 2 custom tools:
  - `query_properties` — runs SQL against your PostgreSQL
  - `write_report` — saves analysis results to a JSON/Redis cache

### Phase B: First Agents (2-3 weeks)
- Build Price Index Agent (most valuable, quickest to validate)
- Build Rental Yield Agent (complements price index)
- Add `/api/intelligence/price-index` and `/api/intelligence/yields` endpoints to backend
- Frontend: New "Market Intelligence" page with charts + AI-generated narratives

### Phase C: Full Suite (3-4 weeks)
- Investment Heatmap Agent
- Property Risk Scoring Agent
- Developer Reputation Agent
- Neighborhood Growth Agent
- Demand Cycle Agent
- Frontend: Intelligence dashboard with interactive maps + drill-downs

### Phase D: Fine-tuning & API (2-3 weeks)
- Fine-tune Ollama model on Nigerian property terminology
  - "BQ" = boys quarters, "C of O" = Certificate of Occupancy
  - Lagos-specific location hierarchies
  - Nigerian price formats (₦, "per annum", "million")
- Build external API for intelligence data (monetization path)
- Rate limiting + API key management for third-party access

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| LLM hallucinations in analysis | All insights anchored to SQL data. LLM augments, doesn't generate raw numbers |
| Ollama model quality for Nigerian context | Fine-tune on Nigerian property corpus. Start with larger models (8b+) |
| ZeroClaw is relatively new (early-stage project) | It's open source + Rust = easy to audit. Fallback: raw Ollama API is always available |
| GPU costs at scale | Pre-compute + cache strategy keeps GPU usage minimal |
| Data staleness | Agents run on schedules. Stale cache is better than no cache |
| Overengineering | Start with 2 agents, validate value, then expand |

---

## 10. Recommendation

### ✅ YES — Integrate ZeroClaw + Ollama, but with discipline:

1. **Start small**: Price Index + Rental Yield agents only. Prove the value.
2. **Keep it separate**: Intelligence layer is a standalone microservice. Your existing platform doesn't change.
3. **Pre-compute everything**: Don't put LLM inference in the user request path. Schedule batch jobs, cache results.
4. **Fine-tune for Nigeria**: Generic LLMs don't understand ₦, BQ, C of O, or Lagos geography. A fine-tuned 8b model will outperform a generic 70b model for your domain.
5. **The moat is the data, not the model**: The intelligence layer makes your historical data exponentially more valuable. Every week of operation widens the gap.

### What NOT to use it for:
- ❌ Don't use it to run your scraper (you already have a great Python scraper)
- ❌ Don't use it for search (Meilisearch is better for that)
- ❌ Don't use it for CRUD operations (your Express API handles that)
- ❌ Don't use it for real-time user interactions (latency too high for chat-like UX)

### The intelligence layer should be an **oracle** — it runs in the background, produces insights, and your existing platform surfaces those insights to users through beautiful dashboards.

---

## 11. File Structure (if approved)

```
realtors-practice/
├── intelligence/               # NEW — separate microservice
│   ├── Dockerfile
│   ├── zeroclaw.toml            # ZeroClaw configuration
│   ├── agents/
│   │   ├── price_index.md       # Agent skill files
│   │   ├── rental_yield.md
│   │   ├── investment_heatmap.md
│   │   ├── risk_scorer.md
│   │   ├── developer_rep.md
│   │   ├── neighborhood_growth.md
│   │   └── demand_cycles.md
│   ├── tools/                   # Custom Python tools for agents
│   │   ├── query_db.py
│   │   ├── write_cache.py
│   │   └── geocode.py
│   ├── gateway/                 # REST API gateway
│   │   ├── app.py               # FastAPI endpoints
│   │   └── routes/
│   ├── cache/                   # Intelligence results cache
│   └── models/                  # Custom Ollama Modelfiles
│       └── nigerian-property.Modelfile
├── backend/                     # EXISTING — add intelligence routes
│   └── src/routes/
│       └── intelligence.routes.ts  # Proxy to intelligence gateway
├── frontend/                    # EXISTING — add intelligence pages
│   └── app/(dashboard)/
│       └── intelligence/
│           ├── page.tsx         # Market Intelligence dashboard
│           ├── heatmap/page.tsx
│           └── yields/page.tsx
└── ...
```

---

*This document is a proposal. No code has been written. Awaiting your decision on scope and priority.*
