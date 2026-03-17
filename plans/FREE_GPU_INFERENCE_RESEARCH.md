# Free GPU Inference Hosting Research (March 2026)

Research into free GPU environments for hosting an AI inference stack:
- **Qwen 3 8B** (Q4_K_M quantized, ~5.2 GB VRAM)
- **ZeroClaw** (Rust binary, ~10 MB RAM, task routing)
- **mem0** (memory layer — 3 Docker containers: FastAPI + PostgreSQL/pgvector + Neo4j)
- **BitNet 1-bit models** (lightweight CPU-only alternative)

Target: accessible via API endpoint from an Oracle ARM VM.

---

## Table of Contents

1. [Tier 1: Free Hosted API Providers (No GPU Needed)](#tier-1-free-hosted-api-providers)
2. [Tier 2: Free GPU Compute (Self-Hosted Inference)](#tier-2-free-gpu-compute)
3. [Tier 3: Free Credits / Trial Tiers](#tier-3-free-credits--trial-tiers)
4. [Tier 4: Not Viable](#tier-4-not-viable)
5. [Qwen 3 8B Performance Benchmarks](#qwen-3-8b-performance-benchmarks)
6. [BitNet Alternative Analysis](#bitnet-alternative-analysis)
7. [mem0 Hosting Requirements](#mem0-hosting-requirements)
8. [Ranked Recommendations](#ranked-recommendations)
9. [Recommended Architecture](#recommended-architecture)

---

## Tier 1: Free Hosted API Providers

These provide **free inference APIs** — no GPU management needed. Your Oracle VM just calls their endpoint.

### 1. Groq (BEST FREE API)

| Attribute | Details |
|-----------|---------|
| **Hardware** | Custom LPU (Language Processing Unit) — not GPU |
| **Free Tier** | Truly free, no credit card required |
| **Rate Limits** | 30 RPM (60 RPM on smaller models), 6,000 tokens/min, 14,400 requests/day |
| **Models** | Llama 3.3 70B, Llama 4 Scout, Qwen3 32B, Kimi K2 |
| **Speed** | 300-500+ tokens/sec (5-10x faster than GPU providers) |
| **API Compat** | OpenAI-compatible API |
| **Qwen 3 8B?** | No — offers Qwen3 32B instead (better model, free) |
| **Persistence** | Always-on API, no session management |
| **Gotchas** | Rate limits can be restrictive for heavy use; free tier may be deprioritized |

**Verdict**: Best option if Qwen3 32B (or Llama 3.3 70B) meets your needs. Absurdly fast. No infrastructure to manage.

### 2. Cerebras (FASTEST FREE API)

| Attribute | Details |
|-----------|---------|
| **Hardware** | Wafer-Scale Engine (WSE) — custom silicon |
| **Free Tier** | Free, no credit card, no waitlist |
| **Rate Limits** | 30 RPM, 1 million tokens/day |
| **Models** | Llama 3.3 70B, Qwen3 32B, Qwen3 235B, GPT-OSS 120B |
| **Speed** | 450-3,000+ tokens/sec depending on model |
| **API Compat** | OpenAI-compatible API |
| **Qwen 3 8B?** | No — offers Qwen3 32B and 235B (both better, free) |
| **Persistence** | Always-on API |
| **Gotchas** | 1M tokens/day cap; models limited to what they host |

**Verdict**: Offers Qwen3 32B and even 235B for free. 20x faster than GPU-based inference. 1M tokens/day is generous for a personal/small-team app.

### 3. SambaNova

| Attribute | Details |
|-----------|---------|
| **Hardware** | Custom RDU (Reconfigurable Dataflow Unit) |
| **Free Tier** | Free API key, no credit card |
| **Rate Limits** | 10-30 RPM depending on model size |
| **Models** | DeepSeek-R1, Llama, Qwen, GPT-OSS 120B (600+ tok/s) |
| **Speed** | 600+ tokens/sec on some models |
| **API Compat** | OpenAI-compatible API |
| **Qwen 3 8B?** | Offers Qwen models (exact variants vary) |
| **Persistence** | Always-on API |
| **Gotchas** | Smaller model selection than Groq/Cerebras |

**Verdict**: Solid free option. Less community buzz than Groq/Cerebras but persistent free tier.

### 4. Mistral (Free "Experiment" Tier)

| Attribute | Details |
|-----------|---------|
| **Free Tier** | Yes — "Experiment" plan |
| **Rate Limits** | ~1 RPS, 500K tokens/min, 1 billion tokens/month |
| **Models** | All Mistral models (Mistral 7B, Mixtral, etc.) |
| **Qwen 3 8B?** | No — Mistral models only |
| **Gotchas** | Requests may be used to train Mistral's models; 2 RPM on some models |

**Verdict**: Good for Mistral-family models. Very generous token limits (1B/month). Not relevant if you need Qwen specifically.

### 5. Google AI Studio

| Attribute | Details |
|-----------|---------|
| **Free Tier** | Yes, generous limits |
| **Models** | Gemini 2.5 Pro and other Google models |
| **Qwen 3 8B?** | No — Google models only |
| **Gotchas** | Google ecosystem lock-in |

**Verdict**: Best free model quality (Gemini 2.5 Pro), but no open-source model support.

### 6. OpenRouter (Free Model Routing)

| Attribute | Details |
|-----------|---------|
| **Free Tier** | 20 RPM on free models, 50 requests/day (1,000/day with $10 balance) |
| **Models** | 300+ models including Qwen3 Coder (free) |
| **Qwen 3?** | Yes — Qwen3 Coder 480B free tier available |
| **API Compat** | OpenAI-compatible |
| **Gotchas** | Low daily request cap without paid balance |

**Verdict**: Good aggregator. Qwen3 Coder available free. Low limits without deposit.

### 7. Qwen Direct / Puter.js / QwenBridge

| Attribute | Details |
|-----------|---------|
| **Puter.js** | All Qwen family models, completely free, no API keys needed |
| **Qwen OAuth** | 1,000 free requests/day via Qwen Code |
| **QwenBridge** | 2,000 free Qwen3 Coder API requests/day |
| **Gotchas** | Puter.js is client-side JS (may not work server-to-server easily); QwenBridge reliability unknown |

**Verdict**: Direct-from-source Qwen access. QwenBridge at 2K requests/day is noteworthy.

---

## Tier 2: Free GPU Compute

These give you actual GPU hardware to run Ollama/llama.cpp yourself.

### 8. Google Colab (Free T4 GPU)

| Attribute | Details |
|-----------|---------|
| **GPU** | NVIDIA T4 (15 GB usable VRAM) |
| **Free Limits** | 15-30 GPU hours/week; 12-hour max session |
| **RAM** | ~12 GB system RAM |
| **Storage** | Ephemeral (lost on disconnect) |
| **Persistent Service?** | NO — notebooks disconnect after 12h or 90min idle |
| **API Endpoint?** | Yes, via ngrok tunnel (fragile) |
| **Ollama?** | Yes — "Ollama Colab Free Server" notebook exists |
| **Qwen 3 8B Speed** | ~3.8-20 tok/s on T4 (see benchmarks section) |
| **Gotchas** | Anti-abuse policies prohibit "persistent server" use; ngrok URLs change on reconnect; 90-min idle timeout |

**Verdict**: Works for testing but NOT for production. Session instability, idle timeouts, and ToS concerns make it unreliable as a 24/7 API backend.

### 9. Kaggle (Free 2x T4 GPUs)

| Attribute | Details |
|-----------|---------|
| **GPU** | 2x NVIDIA T4 (16 GB each) or 1x P100 |
| **Free Limits** | 30 GPU hours/week |
| **RAM** | ~29-30 GB system RAM |
| **Storage** | Limited persistent storage |
| **Persistent Service?** | NO — notebook environment only |
| **API Endpoint?** | Possible via ngrok (same fragility as Colab) |
| **Ollama?** | Yes — community notebooks exist (OllamaKaggle) |
| **Qwen 3 8B Speed** | ~3.8-20 tok/s on T4 |
| **Gotchas** | 30h/week cap; sessions expire; ToS prohibits production serving |

**Verdict**: More GPU hours than Colab (30h/week) and 2x T4s, but same fundamental limitations. Not a production solution.

### 10. Lightning.ai (Free GPU Studio)

| Attribute | Details |
|-----------|---------|
| **GPU** | T4, L4, A10G, or L40S (single GPU on free tier) |
| **Free Limits** | 15 credits/month (~22 GPU hours); 4-hour session restarts |
| **RAM** | Varies by instance |
| **Storage** | 100 GB persistent storage |
| **Persistent Service?** | PARTIAL — auto-restarts every 4 hours on free tier (24/7 on $50/mo Pro) |
| **API Endpoint?** | Yes, SSH access + can expose ports |
| **Ollama?** | Yes — full Linux environment via Studio |
| **Qwen 3 8B Speed** | ~40 tok/s on L4; ~3.8 tok/s on T4 |
| **Gotchas** | 4-hour restart cycle on free tier; 22 GPU hours/month is limiting |

**Verdict**: Best free GPU platform for actual development. Persistent storage, SSH access, multiple GPU options. The 4-hour restart is annoying but workable with auto-restart scripts. 22 GPU hours/month limits heavy use.

### 11. Hugging Face ZeroGPU

| Attribute | Details |
|-----------|---------|
| **GPU** | NVIDIA H200 (70 GB VRAM!) — dynamically allocated |
| **Free Tier** | Requires HF PRO subscription ($9/mo) to create ZeroGPU Spaces |
| **API Endpoint?** | Via Gradio SDK only (not arbitrary services) |
| **Ollama?** | NO — only works with Gradio-based Python apps |
| **Gotchas** | GPU allocated on-demand per request, not persistent; Gradio-only |

**Verdict**: Powerful hardware (H200!) but restricted to Gradio apps. Cannot run Ollama. Not truly free (requires PRO). Not suitable for this stack.

### 12. Paperspace Gradient (Free P5000)

| Attribute | Details |
|-----------|---------|
| **GPU** | NVIDIA P5000 (16 GB VRAM) — when available |
| **Free Limits** | 6-hour sessions, unlimited restarts |
| **RAM** | 30 GB system RAM, 8 vCPUs |
| **Storage** | Persistent (survives sessions) |
| **Persistent Service?** | NO — 6-hour sessions, public notebooks only |
| **Ollama?** | Potentially, within notebook environment |
| **Gotchas** | Free GPU availability varies; all notebooks public; now part of DigitalOcean |

**Verdict**: Decent free GPU with persistent storage. 6-hour sessions are better than Colab's instability. GPU availability can be spotty.

### 13. Saturn Cloud

| Attribute | Details |
|-----------|---------|
| **GPU** | Available (type varies) |
| **Free Limits** | 10-30 GPU hours/month; 8 cores, 64 GB RAM |
| **Persistent Service?** | NO — notebook/session based |
| **Gotchas** | May require credit card; limited free tier |

**Verdict**: Generous RAM but not suitable for persistent API serving.

---

## Tier 3: Free Credits / Trial Tiers

One-time credits that will eventually run out.

### 14. Modal ($30/month free credits)

| Attribute | Details |
|-----------|---------|
| **GPU** | A10G, A100, H100 (serverless) |
| **Free Credits** | $30/month compute credit (recurring) |
| **Pricing** | A10G at ~$0.000306/sec ($1.10/hr) |
| **Persistence** | Serverless — scales to zero, cold starts on request |
| **API Endpoint?** | Yes — native web endpoint support |
| **Ollama?** | Can run custom containers with Ollama |
| **Effective Free Hours** | ~27 hours/month of A10G |
| **Gotchas** | Regional multipliers can 3.75x actual cost; cold start latency |

**Verdict**: Excellent for serverless inference. $30/month recurring credit is generous. Cold starts add latency but the API endpoint story is clean. ~27h/month of A10G gives ~40 tok/s for Qwen 3 8B.

### 15. Together AI ($100 sign-up credits)

| Attribute | Details |
|-----------|---------|
| **Free Credits** | Up to $100 one-time at sign-up |
| **Models** | 200+ including Qwen3, Llama, DeepSeek |
| **Speed** | Fastest GPU-based provider for Qwen3 models |
| **API Compat** | OpenAI-compatible |
| **Gotchas** | Credits are one-time; then requires $5+ purchases |

**Verdict**: Great for initial testing. $100 goes a long way for 8B model inference. Not a permanent free solution.

### 16. RunPod (No true free tier)

| Attribute | Details |
|-----------|---------|
| **Free Credits** | $5-$500 random bonus after first $10 spend |
| **GPU Pricing** | From $0.20/hr (community) for older GPUs |
| **Gotchas** | Requires initial $10 spend; not truly free |

**Verdict**: Not free. Skip unless you want cheap GPU rental.

---

## Tier 4: Not Viable

| Platform | Reason |
|----------|--------|
| **Oracle Cloud Free Tier** | No free GPU instances. Free tier has ARM A1 CPUs only (up to 4 OCPU, 24 GB RAM). Good for hosting ZeroClaw and mem0, NOT for GPU inference. |
| **Fly.io** | GPUs deprecated as of July 31, 2026. Do not use. |
| **Render.com** | No GPU support found. |
| **Lambda Labs** | No free tier. Enterprise/research focused. |
| **Vast.ai** | No free tier. Marketplace for cheap GPU rental ($0.15-0.50/hr). |
| **Lepton AI** | Acquired by NVIDIA, rebranded as DGX Cloud Lepton. No free tier found. |
| **Replicate** | No real free tier. Pay-per-second after brief trial. |

---

## Qwen 3 8B Performance Benchmarks

### By GPU Type

| GPU | VRAM | Qwen 3 8B Q4_K_M Speed | Notes |
|-----|------|------------------------|-------|
| **T4** | 16 GB (15 usable) | **~3.8-20 tok/s** | Fits easily; speed varies by framework. T4 is old architecture (Turing). Benchmark shows 3.8 tok/s for Qwen2.5 7B on T4 — Qwen3 8B similar. |
| **L4** | 24 GB | **~40-53 tok/s** | Sweet spot. 8x faster than T4. Supports FlashAttention 2. |
| **A10G** | 24 GB | **~40-60 tok/s** | Similar to L4, slightly faster in some workloads. |
| **H100** | 80 GB | **~100-200+ tok/s** | Overkill for 8B model, but blazing fast. |
| **H200** | 141 GB | **~200+ tok/s** | Extreme overkill for 8B. |

### By Inference Engine

| Engine | Notes |
|--------|-------|
| **Ollama** | Easiest setup. ~40 tok/s on 8GB+ VRAM GPUs with Q4_K_M. |
| **llama.cpp** | Slightly more configurable. 70-80 tok/s on good hardware. |
| **vLLM** | Best for batched/concurrent requests. ~120 tok/s on capable GPUs. |
| **TensorRT-LLM** | NVIDIA-optimized. Fastest but complex setup. |

### Key Insight

**T4 GPUs produce ~3.8-20 tok/s for Qwen-class 8B models** — this is SLOW for interactive use (ChatGPT-like experiences need 30+ tok/s). The free GPU platforms (Colab, Kaggle) all use T4s, making them mediocre for this use case.

**L4/A10G GPUs produce ~40-53 tok/s** — good for interactive use. Available on Lightning.ai free tier and Modal's $30 credit.

---

## BitNet Alternative Analysis

### Current State (March 2026)

| Attribute | Details |
|-----------|---------|
| **Concept** | 1-bit (ternary) quantized models that run on CPU only |
| **Framework** | Microsoft's BitNet (open source) |
| **Speed on ARM** | 1.37-5.07x speedup vs FP16; Raspberry Pi 5 gets 11 tok/s for 3B model |
| **Speed on x86** | 2.37-6.17x speedup vs FP16 |
| **Energy** | 55-82% reduction vs standard inference |
| **Largest Real Model** | Only 2-3B parameter models actually exist as trained ternary models |
| **100B Claim** | Theoretical — no 100B ternary model has been publicly released |

### Verdict on BitNet

**Not viable for Qwen 3 8B replacement** because:
1. No one has trained a ternary Qwen 3 model
2. Largest available ternary models are only 2-3B parameters
3. Quality at 2-3B is significantly worse than Qwen 3 8B Q4_K_M
4. On Oracle ARM (4 OCPU), expect ~3-6 tok/s for a 3B BitNet model — similar speed to T4 GPU with a much worse model

**Future potential**: If someone trains a BitNet Qwen 3 8B, it could run at 20-40 tok/s on CPU, eliminating the need for GPU entirely. Watch this space, but do not plan around it today.

---

## mem0 Hosting Requirements

| Component | Resource Need |
|-----------|--------------|
| **FastAPI server** | Minimal CPU/RAM |
| **PostgreSQL + pgvector** | 1-2 GB RAM, persistent storage |
| **Neo4j** | 1-2 GB RAM, persistent storage |
| **LLM dependency** | Needs an LLM for memory extraction (can use any of the free APIs above) |
| **Total** | ~4-6 GB RAM, ~10 GB storage |

**Best hosting**: Oracle Cloud free tier ARM VM (4 OCPU, 24 GB RAM, 200 GB storage) — perfect fit. Run mem0 + ZeroClaw on Oracle, call external free API for LLM inference.

---

## Ranked Recommendations

### Overall Ranking by Weighted Score

| Rank | Platform | Reliability | Performance | Ease of Setup | Persistence | API Access | Score |
|------|----------|-------------|-------------|---------------|-------------|------------|-------|
| **1** | **Groq Free API** | 9/10 | 10/10 | 10/10 | 10/10 | 10/10 | **49/50** |
| **2** | **Cerebras Free API** | 8/10 | 10/10 | 10/10 | 10/10 | 10/10 | **48/50** |
| **3** | **SambaNova Free API** | 7/10 | 9/10 | 10/10 | 10/10 | 10/10 | **46/50** |
| **4** | **Modal ($30 credit)** | 8/10 | 8/10 | 7/10 | 8/10 | 9/10 | **40/50** |
| **5** | **Lightning.ai Free** | 7/10 | 7/10 | 7/10 | 5/10 | 7/10 | **33/50** |
| **6** | **OpenRouter Free** | 6/10 | 7/10 | 9/10 | 10/10 | 9/10 | **41/50** |
| **7** | **QwenBridge** | 5/10 | 7/10 | 8/10 | 10/10 | 8/10 | **38/50** |
| **8** | **Kaggle (2x T4)** | 5/10 | 3/10 | 5/10 | 2/10 | 3/10 | **18/50** |
| **9** | **Google Colab (T4)** | 4/10 | 3/10 | 6/10 | 2/10 | 3/10 | **18/50** |
| **10** | **Paperspace Gradient** | 4/10 | 4/10 | 5/10 | 3/10 | 3/10 | **19/50** |

---

## Recommended Architecture

### Primary Recommendation: Free API Provider Stack

```
Oracle ARM VM (free tier)
  |-- ZeroClaw (Rust binary, task routing)
  |-- mem0 (FastAPI + PostgreSQL + Neo4j in Docker)
  |-- API Gateway / Reverse Proxy
  |
  |----> Groq API (primary) ---- Qwen3 32B @ 300+ tok/s
  |----> Cerebras API (fallback) - Qwen3 32B @ 450+ tok/s
  |----> SambaNova API (backup) -- Qwen models @ 600+ tok/s
```

**Why this is the best approach**:
- Zero GPU cost — all inference is free via API
- You get Qwen3 **32B** instead of 8B (4x larger, better quality, FREE)
- 300-3000 tokens/sec instead of 3.8-20 tok/s on a T4
- No session management, no ngrok tunnels, no idle timeouts
- Oracle VM handles ZeroClaw + mem0 easily within 24 GB RAM
- Multi-provider failover for reliability

**Rate limit budget** (combined across providers):
- Groq: 14,400 requests/day + 6K tokens/min
- Cerebras: 1M tokens/day
- SambaNova: 30 RPM continuous
- Total: roughly 20,000-30,000 requests/day, millions of tokens

### Fallback: Self-Hosted GPU (if you need custom models)

```
Oracle ARM VM (free tier)
  |-- ZeroClaw + mem0 (always running)
  |
  |----> Modal Serverless (A10G) -- Qwen 3 8B custom @ ~40 tok/s
         $30/month free credit = ~27 hours/month
         Scales to zero when idle
```

Use this only if you need:
- Fine-tuned Qwen 3 8B that hosted APIs don't offer
- Full control over model parameters
- Privacy (no data sent to third parties)

### Do NOT Bother With

- **Google Colab / Kaggle for production** — session instability, ToS violations, ngrok fragility
- **BitNet models** — not mature enough, no Qwen variants exist
- **Fly.io GPUs** — being deprecated July 2026
- **Paying for GPU hosting** — free API providers offer better models at higher speed

---

## Key Takeaway

**You do not need a GPU at all.** The free API providers (Groq, Cerebras, SambaNova) offer:
- Qwen3 32B for free (better than your planned 8B)
- 300-3000 tok/s (vs 3.8-20 tok/s on free T4 GPUs)
- Persistent, always-on APIs (vs fragile notebook sessions)
- OpenAI-compatible endpoints (drop-in replacement)

Run ZeroClaw + mem0 on Oracle ARM free tier. Point inference at Groq/Cerebras. Save the GPU headache entirely.

---

## Sources

- [Groq Rate Limits](https://console.groq.com/docs/rate-limits)
- [Cerebras Free Tier (1M tokens/day)](https://adam.holter.com/cerebras-opens-a-free-1m-tokens-per-day-inference-tier-and-claims-20x-faster-than-nvidia-real-benchmarks-model-limits-and-why-ui2-matters/)
- [Cerebras Inference](https://www.cerebras.ai/inference)
- [SambaNova Cloud](https://cloud.sambanova.ai/)
- [Every Free AI API in 2026](https://awesomeagents.ai/tools/free-ai-inference-providers-2026/)
- [Free AI API Credits 2026 Compared](https://www.getaiperks.com/en/blogs/27-ai-api-free-tier-credits-2026)
- [Ollama Colab Free Server](https://hkdocs.com/en/blog/2026/03/01/release-colab-ollama-server/)
- [Kaggle OllamaKaggle](https://github.com/cyberytti/OllamaKaggle)
- [Lightning AI Pricing](https://www.saasworthy.com/product/lightning-ai/pricing)
- [HuggingFace ZeroGPU](https://huggingface.co/docs/hub/spaces-zerogpu)
- [Modal Pricing](https://modal.com/pricing)
- [Together AI Qwen](https://www.together.ai/qwen)
- [Mistral Free Tier](https://help.mistral.ai/en/articles/455206-how-can-i-try-the-api-for-free-with-the-experiment-plan)
- [OpenRouter Qwen3 Coder Free](https://openrouter.ai/qwen/qwen3-coder:free)
- [Puter.js Free Qwen API](https://developer.puter.com/tutorials/free-unlimited-qwen-api/)
- [QwenBridge 2000 Free Requests/Day](https://blog.balakumar.dev/2025/08/26/get-2000-free-qwen3-coder-api-requests-daily-use-with-claude-code-roo-cline-more/)
- [Qwen Speed Benchmarks](https://qwen.readthedocs.io/en/latest/getting_started/speed_benchmark.html)
- [Benchmarking Qwen on T4, L4, H100](https://medium.com/@wltsankalpa/benchmarking-qwen-models-across-nvidia-gpus-t4-l4-h100-architectures-finding-your-sweet-spot-a59a0adf9043)
- [Ollama Performance Tuning 8GB GPUs](https://aimuse.blog/article/2025/06/08/ollama-performance-tuning-on-8gb-gpus-a-practical-case-study-with-qwen3-models)
- [BitNet GitHub](https://github.com/microsoft/BitNet)
- [BitNet Explained 2026](https://www.junia.ai/blog/bitnet-1-bit-model-local-ai-workflows)
- [mem0 Self-Hosting Docker Guide](https://mem0.ai/blog/self-host-mem0-docker)
- [mem0 GitHub](https://github.com/mem0ai/mem0)
- [Best Free Cloud GPU Platforms 2026](https://iotbyhvm.ooo/best-free-cloud-gpu-platforms-in-2026-google-colab-kaggle-and-more/)
- [Free GPU Cloud Trials 2026](https://www.gmicloud.ai/blog/where-can-i-get-free-gpu-cloud-trials-in-2026-a-complete-guide)
- [Paperspace Gradient Free GPU](https://www.paperspace.com/gradient/free-gpu)
- [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/)
- [Fly.io GPU Deprecation](https://community.fly.io/t/gpu-migration-fly-io-gpus-will-be-deprecated-as-of-july-31-2026/27110)
- [Northflank GPU Hosting Guide](https://northflank.com/blog/top-gpu-hosting-platforms-for-ai)
