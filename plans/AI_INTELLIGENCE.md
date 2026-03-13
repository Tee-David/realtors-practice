# AI Intelligence Integration: Ollama + BitNet + ZeroClaw + Oracle Free Tier

> How to build a zero-cost, production-grade property intelligence layer for the Realtors' Practice platform using a **dual-model approach** — Microsoft BitNet b1.58 for speed + Ollama (Llama 3 8B) for brains — orchestrated by the ZeroClaw agent runtime on Oracle's Always Free compute infrastructure.

---

## What Are These Technologies?

### Microsoft BitNet b1.58 2B4T
The first open-source, native 1-bit large language model at the 2B parameter scale. "4T" = trained on 4 trillion tokens.

| Property | Value |
|---|---|
| Model size on disk | **~400MB** (vs 4.8GB for comparable models) |
| Parameters | 2 billion |
| Quantization | 1.58-bit ternary weights (-1, 0, +1) |
| Max context | 4,096 tokens |
| Inference speed on ARM CPU | **5–7 tokens/second** via bitnet.cpp |
| Energy reduction vs full precision | 71–82% |

The key insight: **this model runs efficiently on CPU, with no GPU required.** It's designed specifically for edge/low-resource deployment — making Oracle's free ARM tier ideal.

**Official repo:** [github.com/microsoft/BitNet](https://github.com/microsoft/BitNet)
**Model weights:** [huggingface.co/microsoft/bitnet-b1.58-2B-4T](https://huggingface.co/microsoft/bitnet-b1.58-2B-4T)

---

### Ollama (Running Llama 3 8B / Mistral 7B)
Ollama is a tool that lets you **run large AI models locally** with one command. While BitNet is fast, it's only 2B parameters — not smart enough for complex reasoning. Ollama bridges this gap by running much smarter models on the same free Oracle VM.

| Property | Value |
|---|---|
| Model size on disk | **~4.5GB** (Q4 quantized) |
| Parameters | 8 billion (Llama 3) or 7 billion (Mistral) |
| Max context | 8,192 tokens (2x BitNet) |
| Inference speed on ARM CPU | **2–4 tokens/second** |
| RAM usage | **~5GB** (fits easily in 24GB alongside BitNet) |
| API format | OpenAI-compatible (`/api/chat`) |

**Why both?** BitNet is 3x faster but dumber. Ollama is slower but *actually reasons well*. The AI router picks the right one for each task — speed when it matters, brains when it matters.

**Official site:** [ollama.com](https://ollama.com)

---

### ZeroClaw
An ultra-lightweight AI **agent runtime** written in Rust. It is NOT a scraper — it is infrastructure for building autonomous AI agents that can:
- Connect to any LLM provider (OpenAI, Anthropic, Ollama, local models)
- Use tools (shell commands, file I/O, browser, memory, search)
- Run on multiple channels (Telegram, Discord, Slack, WhatsApp, CLI)
- Operate in <5MB RAM with <10ms startup

Think of ZeroClaw as a "deploy once, run anywhere" agent skeleton that wraps your LLM and gives it tools, memory, and communication channels.

**Repo:** [github.com/zeroclaw-labs/zeroclaw](https://github.com/zeroclaw-labs/zeroclaw)

---

### Oracle Always Free Tier
**This is permanently free, not a trial:**
- 4 ARM Ampere A1 cores (flexible: 1 VM with 4 cores / 24GB RAM is the best config)
- 24GB RAM total
- 200GB block storage
- 10TB outbound data transfer/month

Running both models on this hardware:
- BitNet: ~400MB RAM | Ollama (Llama 3 8B Q4): ~5GB RAM | **Total: ~5.5GB of 24GB**
- bitnet.cpp gives **1.37x–5.07x speedup** on ARM vs standard llama.cpp
- Ollama natively supports ARM — runs well on Ampere A1
- 18GB+ headroom for OS, ZeroClaw, SQLite, and multiple inference workers

---

## Vision: What This Means for Realtors' Practice

The platform already collects, validates, and indexes Nigerian property data at scale. The missing layer is **intelligence** — the ability to reason over that data, generate insights, detect anomalies, and answer complex questions. That's what the **BitNet + Ollama dual-model setup** unlocks, orchestrated by ZeroClaw, at zero infrastructure cost.

---

## The Best Integration Architecture

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                          │
│   AI Chat Panel │ Insight Cards │ Smart Search │ Report View    │
└──────────────────────────┬──────────────────────────────────────┘
                           │  REST/WebSocket
┌──────────────────────────▼──────────────────────────────────────┐
│                    Backend (Node.js)                             │
│   AI Service ──────► AI Router ──────► Intelligence API         │
│   (/api/ai/*,        (decides:       │                          │
│    /api/insights)     BitNet vs      │                          │
│                       Ollama)        │                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │  HTTP (internal)
┌──────────────────────────▼──────────────────────────────────────┐
│              Oracle Free Tier (ARM VM — always on)              │
│                                                                  │
│   ┌─────────────────────┐    ┌──────────────────────────────┐  │
│   │   ZeroClaw Agent    │    │   BitNet b1.58 HTTP Server   │  │
│   │   (Rust runtime)    │◄──►│   (bitnet.cpp + REST wrapper) │  │
│   │   - Tools           │    │   Port: 8080                  │  │
│   │   - Memory (SQLite) │    │   ⚡ FAST: parsing, tagging   │  │
│   │   - Scheduler       │    └──────────────────────────────┘  │
│   │                     │                                       │
│   │                     │    ┌──────────────────────────────┐  │
│   │                     │◄──►│   Ollama (Llama 3 8B)        │  │
│   │                     │    │   Port: 11434                 │  │
│   │                     │    │   🧠 SMART: reports, chat,    │  │
│   │                     │    │   analysis, fraud detection   │  │
│   └─────────────────────┘    └──────────────────────────────┘  │
│                                                                  │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │          SQLite (vector + keyword hybrid search)         │  │
│   │          Property embeddings, agent memory               │  │
│   └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Dual-Model Routing Logic

| Task Type | Model | Why |
|---|---|---|
| Query parsing (NL → JSON) | **BitNet** | Fast, structured output, no reasoning needed |
| Classification/tagging | **BitNet** | Simple pattern matching |
| Quality scoring | **BitNet** | Numeric scoring, fast per-listing |
| Chat assistant | **Ollama** | Needs conversational reasoning |
| Market reports | **Ollama** | Needs coherent multi-paragraph writing |
| Investment analysis | **Ollama** | Needs math + reasoning |
| Fraud detection | **Ollama** | Needs semantic understanding |
| Scrape failure diagnosis | **Ollama** | Needs multi-step reasoning |
| Optional cloud fallback | **Gemini Flash (free tier)** | Only if local models fail — you already have a key |

### Key Design Decisions

1. **Dual-model routing**: BitNet handles fast, repetitive tasks (parsing, scoring, tagging) where speed matters. Ollama (Llama 3 8B) handles tasks that need actual intelligence (reports, chat, analysis, fraud detection). Both run locally on the free Oracle VM — no paid API needed. Gemini Flash (free tier) is available as an optional cloud fallback since you already have a `GEMINI_API_KEY`.
2. **ZeroClaw as the agent brain**: It orchestrates tasks, maintains memory between sessions, and acts on tools. BitNet and Ollama are the inference engines it calls.
3. **OpenAI-compatible APIs**: Both BitNet (port 8080) and Ollama (port 11434) expose OpenAI-compatible endpoints — so the backend treats them identically, swappable via env var.
4. **Async intelligence pipeline**: Heavy analytics run in background jobs (Celery-style), not blocking user requests.

---

## 10 Specific Use Cases for Nigerian Property Intelligence

### 1. Natural Language Query Enhancement (Replace Regex Parser)
**Current state:** Regex-based NL parser — works for "3 bedroom flat in Lekki under 30M" but fails on complex queries.

**With BitNet:** Feed raw query → get structured JSON `{ bedrooms: 3, type: "flat", location: "Lekki", maxPrice: 30000000 }`. Handles ambiguous Nigerian phrasing:
- "Self-con in VI" → studio in Victoria Island
- "Boys quarters Ikoyi" → BQ/separate guest quarters
- "Face-me-I-face-you Surulere" → shared compound building

**Implementation:**
```typescript
// backend/src/services/ai-query.service.ts
const prompt = `Extract property search filters from this Nigerian real estate query.
Query: "${userQuery}"
Return JSON only: { bedrooms, type, location, minPrice, maxPrice, features[] }`;

const result = await bitnetClient.chat(prompt);
return JSON.parse(result);
```

---

### 2. Property Description Quality & Fraud Scoring
**Use case:** When a property is scraped, the current quality scorer uses field completeness. BitNet adds semantic analysis.

It can detect:
- "Too good to be true" pricing (₦500K/month Lekki duplex)
- Templated/copy-pasted descriptions from other listings
- Missing critical context (no mention of service charge in a Lagos Island listing)
- Nigerian fraud patterns ("call agent for viewing fee")

**Output:** Enriched quality score + `fraud_flags[]` array stored on the property record.

---

### 3. Auto-Generated Area Market Reports
**Use case:** Instead of raw data tables, generate a plain-English weekly market summary.

Example prompt:
```
Based on this data for Lekki Phase 1 (last 30 days):
- 127 new listings
- Avg sale price: ₦45M (↑8% vs previous month)
- Avg rent: ₦4.2M/year (↑2%)
- Most common: 3-bed flats (42%)
- Fastest moving: Land (avg 4 days listed)

Generate a 3-paragraph market report in the style of a professional Nigerian estate analyst.
```

This powers a "Market Briefing" feature in the analytics page — auto-refreshed weekly via cron.

---

### 4. Comparable Property Matching (Beyond Simple Filters)
**Use case:** For a given property, find the 5 most comparable listings — not just same bedroom count, but contextual similarity.

BitNet generates embeddings from property descriptions. ZeroClaw stores them in its built-in SQLite vector store. Semantic search finds comparables that match:
- Describing similar quality levels ("newly renovated", "serviced")
- Similar amenities even if labelled differently
- Price normalization by property size

---

### 5. Investment Return Estimator
**Use case:** User asks "Is this ₦80M 4-bed duplex in Magodo a good investment?"

ZeroClaw agent:
1. Pulls current listing from DB
2. Queries rental rates for similar properties in same area
3. Pulls historical price data from property versions
4. Feeds all context to BitNet
5. Generates: `{ rentalYield: "6.2%", priceAppreciation1yr: "12%", verdict: "Above-market yield for area. Consider negotiating..." }`

---

### 6. Scrape Failure Diagnosis
**Use case:** When a site scrape returns 0 results or errors, instead of just logging a failure, an agent diagnoses it.

ZeroClaw agent reads the error log, compares against last successful scrape selectors, identifies if:
- Selector changed (site update)
- Anti-bot block
- Page structure change
- Rate limiting

Posts diagnosis to the scrape log with a `suggested_fix` field. Reduces manual debugging time.

---

### 7. AI Chat Assistant (Ubiquitous Across Pages)
**Use case:** The checklist mentions "Make AI ubiquitous — available across all app pages for inquiries."

With ZeroClaw + BitNet, this becomes feasible at zero API cost:
- Floating chat button on every page
- Routes to ZeroClaw agent
- Agent has tools: `query_database`, `search_properties`, `get_analytics`
- Answers: "How many properties were added this week?", "Show me all commercial properties above ₦200M", "What's the average price in Ikeja right now?"

---

### 8. Auto-Enrichment of Scraped Listings
**Use case:** Scraped description says "3 bedroom flat in a serene part of GRA, close to amenities." BitNet extracts:
- `nearby_amenities: ["GRA location", "quiet neighborhood"]`
- `property_condition_hint: "likely well-maintained"`
- `suggested_tags: ["GRA", "quiet", "residential estate"]`

Combined with Nominatim geocoding, each listing gets a richer profile automatically.

---

### 9. Notification Smart Digest
**Use case:** Instead of sending individual property match notifications, weekly digest emails can be generated as intelligent summaries.

"This week, 12 properties matching your 'Lekki 3-bed under ₦35M' search were found. Prices ranged from ₦22M–₦34M. The best value appears to be [property X] at ₦27M in an estate with a gym. The average is trending down 3% from last week."

---

### 10. Data Explorer Anomaly Detection
**Use case:** Nightly ZeroClaw agent job that scans new listings for:
- Price outliers (statistical + semantic)
- Duplicate detection beyond exact SHA256 (near-duplicates with rephrased descriptions)
- Properties with coordinates in the ocean (bad geocoding)
- Listings with Nigerian phone numbers in the description (policy violation)

Flags records in the Data Explorer with `flag_reason: "AI detected: price anomaly"`.

---

## Implementation Plan

### Phase 1: Oracle Setup & BitNet Deployment (Week 1)

```bash
# On Oracle ARM VM (Ubuntu 22.04)
# 1. Clone and build bitnet.cpp
git clone --recursive https://github.com/microsoft/BitNet.git
cd BitNet
pip install -r requirements.txt
python setup_env.py -md microsoft/bitnet-b1.58-2B-4T -q i2_s

# 2. Test inference
python run_inference.py -m models/bitnet.gguf -p "Analyze this property listing..."

# 3. Build REST API wrapper (Python FastAPI)
# Exposes POST /v1/chat/completions in OpenAI format
```

**REST wrapper (simple FastAPI):**
```python
# ai_server.py
from fastapi import FastAPI
from bitnet import BitNetModel
import subprocess, json

app = FastAPI()
model = BitNetModel("models/bitnet.gguf")

@app.post("/v1/chat/completions")
async def chat(req: ChatRequest):
    result = model.generate(req.messages[-1].content, max_tokens=512)
    return {"choices": [{"message": {"content": result}}]}
```

---

### Phase 2: Backend AI Service (Week 2)

```typescript
// backend/src/services/ai.service.ts
export class AIService {
  private static readonly BITNET_URL = process.env.BITNET_URL || "http://oracle-vm:8080";
  private static readonly OLLAMA_URL = process.env.OLLAMA_URL || "http://oracle-vm:11434";

  // Route to BitNet (fast tasks) or Ollama (complex reasoning)
  static async complete(prompt: string, useSmartModel = false): Promise<string> {
    const url = useSmartModel ? this.OLLAMA_URL : this.BITNET_URL;
    // ... OpenAI-compatible chat completion call
  }

  // High-level use cases
  static async parseNaturalQuery(query: string): Promise<SearchFilters> { ... }
  static async scoreListingQuality(listing: Property): Promise<QualityScore> { ... }
  static async generateAreaReport(areaData: AreaStats): Promise<string> { ... }
  static async detectFraud(listing: Property): Promise<FraudFlags> { ... }
}
```

New backend routes:
```
POST /api/ai/query-parse        → NL query → structured filters
POST /api/ai/listing-analysis   → single property → quality + fraud flags
GET  /api/ai/market-report/:area → cached weekly report
POST /api/ai/chat               → general assistant (ZeroClaw backed)
```

---

### Phase 3: ZeroClaw Agent Setup (Week 3)

```bash
# Install ZeroClaw
curl -fsSL https://zeroclaw.org/install.sh | sh

# Configure agent
cat > agent.toml << EOF
[llm]
provider = "ollama"  # points to local BitNet server
model = "bitnet-b1.58"
base_url = "http://localhost:8080/v1"

[tools]
shell = true
file = true
memory = true

[memory]
backend = "sqlite"
path = "./agent_memory.db"
EOF

# Start agent
zeroclaw agent start --config agent.toml
```

The ZeroClaw agent exposes a WebSocket endpoint. The Node.js backend connects to it for complex multi-step tasks (market reports, investment analysis).

---

### Phase 4: Frontend AI Components (Week 4)

1. **Floating AI Chat Button** — available on all pages, connects via WebSocket to ZeroClaw
2. **Insight Cards** on dashboard — auto-populated from BitNet market summaries
3. **"AI Analyze" button** on property detail page — triggers investment analysis
4. **Smart Search Enhancement** — BitNet-parsed query shown as "interpreted as: 3-bed flat in Lekki under ₦30M"

---

## Cost Analysis

| Component | Monthly Cost |
|---|---|
| Oracle ARM VM (4 cores, 24GB) | **$0** (Always Free) |
| BitNet model weights | **$0** (open-source) |
| Ollama + Llama 3 8B | **$0** (open-source) |
| ZeroClaw runtime | **$0** (open-source) |
| SQLite vector store | **$0** (embedded) |
| Gemini Flash (optional fallback) | **$0** (free tier — you already have a key) |
| **Total** | **$0/month** |

Compare to: OpenAI GPT-4o at $15/1M tokens would cost $50–200/month for equivalent usage.

---

## Recommended Priority Order

1. **Start here:** Deploy BitNet on Oracle + expose REST API (2–3 hours)
2. **Highest ROI first:** NL query parser (replaces fragile regex, immediate user benefit)
3. **Then:** Fraud/quality detection (runs on every scrape automatically)
4. **Then:** ZeroClaw agent + chat interface (ubiquitous AI presence in app)
5. **Later:** Market reports, investment analysis (require more data accumulation first)

---

## Notes on ZeroClaw vs Direct BitNet

ZeroClaw is valuable specifically when you need:
- **Multi-step reasoning** (agent chains multiple tool calls)
- **Persistent memory** across sessions (remembers user preferences, past queries)
- **Scheduled tasks** (nightly anomaly detection, weekly report generation)
- **Multi-channel** (Telegram bot version of the assistant)

For simple single-turn tasks (parse a query, score a listing), calling BitNet directly is simpler and faster. Use ZeroClaw for the orchestration layer, BitNet as the inference engine it calls.

---

## Key Links

- BitNet weights: https://huggingface.co/microsoft/bitnet-b1.58-2B-4T
- bitnet.cpp: https://github.com/microsoft/BitNet
- ZeroClaw: https://github.com/zeroclaw-labs/zeroclaw
- Oracle Free: https://oracle.com/cloud/free
- REST API wrapper guide: https://medium.com/@pingkunga/create-a-rest-api-for-the-microsoft-bitnet-b1-58-model

---

*This document was written based on the platform vision in docs/instructions.md and current (2026) availability of the technologies.*
