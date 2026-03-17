# Adaptive Web Scraping Technology Research (March 2026)

> Comprehensive analysis of tools and technologies for self-healing property data extraction from Nigerian real estate sites.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Tool-by-Tool Analysis](#tool-by-tool-analysis)
3. [Pricing & Free Tier Comparison](#pricing--free-tier-comparison)
4. [Feature Matrix](#feature-matrix)
5. [Anti-Bot Solutions](#anti-bot-solutions)
6. [Architecture Patterns](#architecture-patterns)
7. [Integration with Existing Scraper](#integration-with-existing-scraper)
8. [Recommendations](#recommendations)

---

## Executive Summary

The web scraping landscape in 2025-2026 has undergone a fundamental shift from brittle CSS-selector-based scraping to AI-driven semantic extraction. Three approaches dominate:

1. **LLM-Based Extraction** (ScrapeGraphAI, Crawl4AI + Gemini): Feed HTML/Markdown to an LLM, get structured data. No selectors needed. 95-98% accuracy.
2. **Adaptive Self-Healing Selectors** (Scrapling): Fingerprint DOM elements, use similarity matching when structure changes. Zero LLM cost per page.
3. **Hybrid Approach** (what the existing scraper does): CSS selectors first, LLM fallback, cache discovered selectors for next time.

**Key finding**: The existing Realtors' Practice scraper already implements the most sophisticated architecture pattern (the 4-layer cognitive loop). The improvements needed are tactical, not architectural.

---

## Tool-by-Tool Analysis

### 1. Crawl4AI (Already Integrated)

- **What it does**: Open-source Python crawler that converts web pages to clean Markdown for LLM pipelines. 58,000+ GitHub stars.
- **How it works**: Renders pages with a headless browser, strips ads/scripts/noise, outputs clean Markdown. Supports multiple extraction strategies.
- **Free tier**: Fully open-source, self-hosted. No API costs (you pay only for your own LLM calls).
- **Auto selector discovery**: YES -- `JsonCssExtractionStrategy.generate_schema()` uses an LLM one-time to analyze HTML and produce a reusable CSS extraction schema. Subsequent extractions use the schema with zero LLM cost.
- **Anti-bot**: Basic -- uses a headless browser but no stealth/fingerprint spoofing.
- **Production readiness**: HIGH -- mature, well-documented, actively maintained (v0.8.x).
- **Integration difficulty**: ALREADY INTEGRATED in `scraper/engine/crawl4ai_fetcher.py`.
- **Speed**: Moderate (browser rendering required). ~2-5 seconds per page.
- **Reliability**: HIGH for content extraction. Not designed as an anti-bot tool.

**Key capability not yet used**: `JsonCssExtractionStrategy.generate_schema()` -- this is a one-time LLM call that auto-generates a CSS extraction schema for a site. The generated schema can then extract data from thousands of pages with zero LLM cost. This should replace the current `discover_selectors()` in `llm_schema_extractor.py` as it produces more robust selectors.

### 2. Scrapling (Already Integrated)

- **What it does**: Adaptive Python web scraping framework with self-healing selectors. 25,000+ GitHub stars.
- **How it works**: When you select an element with `auto_save=True`, Scrapling fingerprints it (tag, attributes, text, siblings, parent path) and stores it in SQLite. On subsequent runs with `adaptive=True`, if the original selector fails, Scrapling scores all page elements against the stored fingerprint and returns the best match.
- **Free tier**: Fully open-source. No API costs.
- **Auto selector discovery**: YES -- adaptive mode relocates elements by similarity, not by selector string.
- **Anti-bot**: YES -- `StealthyFetcher` uses `curl_cffi` with browser TLS fingerprinting and real browser headers. Can bypass basic Cloudflare.
- **Production readiness**: HIGH -- actively maintained, well-tested.
- **Integration difficulty**: ALREADY INTEGRATED in `scraper/engine/scrapling_fetcher.py`.
- **Speed**: FAST -- HTTP-level (no browser rendering). Sub-second per page.
- **Reliability**: HIGH for HTTP-accessible pages. Cannot render JavaScript.

**Key capability not yet used**: The `adaptive=True` + `auto_save=True` workflow for automatic element relocation. Currently the scraper uses Scrapling primarily as a StealthyFetcher, not for its adaptive parsing capabilities.

### 3. ScrapeGraphAI

- **What it does**: AI-powered Python scraping library that uses LLMs to understand and extract data from any webpage using natural language prompts. No selectors needed.
- **How it works**: Uses a graph-based pipeline. You describe what data you want in plain English, provide a Pydantic schema, and the LLM extracts matching data. The `SmartScraperGraph` pipeline handles fetching + extraction in one step.
- **Free tier**: Open-source library (free, self-hosted with your own LLM key). Cloud API: 50 credits free (5 pages at 10 credits/page).
- **Auto selector discovery**: N/A -- does not use selectors at all. Purely LLM-based.
- **Anti-bot**: NO -- relies on external fetching or simple HTTP requests.
- **Production readiness**: MEDIUM-HIGH -- 98%+ accuracy claimed, but every page costs LLM tokens.
- **Integration difficulty**: LOW -- pip install, 10-20 lines of code. Compatible with existing Pydantic schemas.
- **Speed**: SLOW -- 2-8 seconds per page (LLM inference time).
- **Reliability**: HIGH accuracy (95-98%) but expensive at scale.
- **Cost concern**: At 500 pages/day, using GPT-4o or Gemini for every page gets expensive. Gemini Flash mitigates this (~$0.125/million input tokens), but it adds up.

### 4. Firecrawl

- **What it does**: Web data API that converts any URL to LLM-ready markdown or structured data. Handles JavaScript rendering, anti-bot, and proxy rotation.
- **How it works**: Cloud-hosted service. Send a URL, get back clean Markdown or structured JSON. Uses proxy infrastructure and browser rendering.
- **Free tier**: 500 LIFETIME credits (500 pages total, ever). Hobby plan: $16/month for 3,000 credits/month.
- **Auto selector discovery**: YES -- zero-shot extraction using VLMs (visual language models) in 2026.
- **Anti-bot**: YES -- cloud-hosted with proxy infrastructure, better than self-hosted solutions.
- **Production readiness**: HIGH -- enterprise-grade API.
- **Integration difficulty**: LOW -- REST API, Python SDK available.
- **Speed**: FAST (1-3 seconds) due to distributed infrastructure.
- **Reliability**: HIGH -- managed service with SLAs.
- **Cost for 500 pages/day**: ~15,000 pages/month = Standard plan at $83/month minimum. NOT VIABLE on free tier.

### 5. Apify

- **What it does**: Cloud platform for running web scraping "Actors" (pre-built or custom scrapers). Marketplace of 3,000+ ready-to-use scrapers.
- **How it works**: Actor-based architecture. You pick an Actor (e.g., "Generic Web Scraper"), configure inputs, and run it on Apify's cloud. Supports Playwright, Puppeteer, Cheerio.
- **Free tier**: $5/month in credits (renewing). Enough for small-scale testing but not 500 pages/day.
- **Auto selector discovery**: PARTIAL -- some Actors use AI for extraction, but most require configuration.
- **Anti-bot**: YES -- built-in proxy rotation, browser fingerprinting, session management.
- **Production readiness**: HIGH -- enterprise platform used by major companies.
- **Integration difficulty**: MEDIUM -- requires learning Apify's Actor SDK, or using REST API.
- **Speed**: Variable depending on Actor and proxy configuration.
- **Reliability**: HIGH -- managed infrastructure.
- **Cost for 500 pages/day**: $29-199/month depending on compute usage. Free tier insufficient.

### 6. Zyte (formerly Scrapy Cloud)

- **What it does**: AI-powered web data extraction API. Auto-extracts structured data from product pages, articles, job listings using ML models.
- **How it works**: ML models trained on millions of pages automatically identify and extract data fields. Per-site pricing based on difficulty (5 tiers).
- **Free tier**: Usage-based pricing, no published free tier. Contact sales for trial.
- **Auto selector discovery**: YES -- ML-based extraction, no selectors needed.
- **Anti-bot**: YES -- automatic proxy management, browser rendering, CAPTCHA handling.
- **Production readiness**: VERY HIGH -- the company behind Scrapy, 15+ years in web scraping.
- **Integration difficulty**: MEDIUM -- REST API, Python SDK (Scrapy integration).
- **Speed**: Fast (distributed infrastructure).
- **Reliability**: VERY HIGH.
- **Limitation**: No built-in data type for "Nigerian property listings." Their auto-extraction is trained on products/articles, not real estate listings specifically.

### 7. Diffbot

- **What it does**: AI-powered web data extraction. Automatically identifies and extracts structured data from any webpage.
- **How it works**: Computer vision + NLP models analyze page layout and content to extract entities (articles, products, discussions, etc.).
- **Free tier**: 10,000 credits/month (10,000 pages). Rate limited to 5 API calls/minute.
- **Auto selector discovery**: YES -- fully automatic, no configuration needed.
- **Anti-bot**: PARTIAL -- cloud-hosted but not specifically designed for anti-bot bypass.
- **Production readiness**: HIGH -- used by major enterprises.
- **Integration difficulty**: LOW -- simple REST API.
- **Speed**: Fast (1-2 seconds per page).
- **Reliability**: HIGH for supported page types.
- **Limitation**: Like Zyte, its auto-extraction models are trained on common page types (articles, products). Nigerian property listings may not extract well without customization. Free tier is generous enough for 500 pages/day at 5 calls/minute.

### 8. AgentQL

- **What it does**: AI-powered query language for web scraping. Describe elements in natural language instead of CSS selectors.
- **How it works**: Uses both HTML structure and accessibility tree. AI builds semantic understanding of page elements, finds them by meaning not position. Integrates with Playwright.
- **Free tier**: Free plan available with limited features. Professional: $99/month.
- **Auto selector discovery**: YES -- natural language selectors that adapt to UI changes.
- **Anti-bot**: NO -- relies on Playwright for rendering, no stealth built in.
- **Production readiness**: MEDIUM -- newer tool, less battle-tested.
- **Integration difficulty**: MEDIUM -- Python SDK + Playwright integration, custom query language to learn.
- **Speed**: Moderate (browser + AI inference).
- **Reliability**: MEDIUM-HIGH.

### 9. Kadoa

- **What it does**: AI-driven platform for extracting, transforming, and integrating unstructured web data at scale.
- **How it works**: AI agents generate and maintain deterministic scraping code. Self-healing scrapers that regenerate code when sites change. Human-like browser patterns to avoid blocking.
- **Free tier**: 500 credits free (no credit card required).
- **Auto selector discovery**: YES -- AI generates scraping code automatically.
- **Anti-bot**: YES -- human-like browser patterns.
- **Production readiness**: HIGH -- enterprise-focused (finance, e-commerce, recruiting).
- **Integration difficulty**: LOW-MEDIUM -- API-based.
- **Speed**: Moderate.
- **Reliability**: HIGH.
- **Limitation**: Enterprise pricing ($300+/month for serious usage) makes it expensive for this project.

### 10. Browser-Use

- **What it does**: Open-source framework for building AI browser agents that navigate and scrape websites using natural language commands.
- **How it works**: AI agent controls a real browser via natural language. Can log in, navigate, click, scroll, and extract data like a human would.
- **Free tier**: Open-source (free with your own LLM key).
- **Auto selector discovery**: YES -- AI navigates visually, no selectors needed.
- **Anti-bot**: PARTIAL -- uses real browser, CAPTCHA solving, 195+ country proxies.
- **Production readiness**: MEDIUM -- good for complex multi-step workflows but slower and more expensive than targeted solutions.
- **Integration difficulty**: MEDIUM -- Python SDK, requires LLM API key.
- **Speed**: SLOW -- 10-30 seconds per page (AI reasoning + browser actions).
- **Reliability**: MEDIUM -- AI agents can be unpredictable.

---

## Pricing & Free Tier Comparison

| Tool | Free Tier | Cost for 500 pages/day (~15k/month) | Self-Hosted? |
|------|-----------|--------------------------------------|-------------|
| **Crawl4AI** | Unlimited (open-source) | $0 (+ LLM costs if using LLMExtractionStrategy) | Yes |
| **Scrapling** | Unlimited (open-source) | $0 | Yes |
| **ScrapeGraphAI** | 50 API credits OR unlimited self-hosted | $0 self-hosted (+ LLM API costs ~$2-10/month with Gemini Flash) | Yes |
| **Firecrawl** | 500 lifetime credits | $83-333/month | No (cloud API) |
| **Apify** | $5/month credits | $29-199/month | No (cloud) |
| **Zyte** | Contact sales | Custom pricing | No (cloud API) |
| **Diffbot** | 10,000 credits/month | $0 on free tier (rate limited) or $299/month | No (cloud API) |
| **AgentQL** | Free plan (limited) | $99/month Professional | No (cloud API) |
| **Kadoa** | 500 credits | $39-300+/month | No (cloud) |
| **Browser-Use** | Unlimited (open-source) | $0 (+ LLM costs) | Yes |
| **Patchright** | Unlimited (open-source) | $0 | Yes |
| **Nodriver** | Unlimited (open-source) | $0 | Yes |

**For 500 pages/day, the only viable free options are self-hosted open-source tools**: Crawl4AI, Scrapling, ScrapeGraphAI (self-hosted), and Patchright/Nodriver for anti-bot.

Diffbot's free tier (10,000 pages/month) is close but rate-limited and may not handle Nigerian property listings well.

---

## Feature Matrix

| Feature | Crawl4AI | Scrapling | ScrapeGraphAI | Firecrawl | Diffbot | AgentQL |
|---------|---------|-----------|--------------|-----------|---------|---------|
| Auto selector discovery | Yes (LLM one-time) | Yes (adaptive fingerprint) | N/A (no selectors) | Yes (VLM) | Yes (ML) | Yes (NL) |
| Self-healing on site changes | Partial (re-gen schema) | Yes (similarity matching) | Yes (LLM semantic) | Yes (VLM) | Yes (ML) | Yes (AI) |
| Anti-bot bypass | No | Yes (StealthyFetcher) | No | Yes (proxy infra) | No | No |
| JavaScript rendering | Yes (browser) | No (HTTP only) | Optional | Yes | Yes | Yes (Playwright) |
| Structured output (Pydantic) | Yes | Manual | Yes | Yes | Yes (predefined) | Custom |
| Nigerian property support | Yes (with prompts) | Yes (with config) | Yes (with prompts) | Generic | Generic | Generic |
| Cost per page | $0 (CSS) / ~$0.001 (LLM) | $0 | ~$0.001-0.01 | $0.001-0.003 | $0 (free tier) | Per-query |
| Speed per page | 0.5-5s | <1s | 2-8s | 1-3s | 1-2s | 2-5s |
| Open source | Yes | Yes | Yes (library) | Partial | No | Partial |

---

## Anti-Bot Solutions

### For Nigerian Real Estate Sites

Nigerian property sites (Jiji.ng, PropertyPro.ng, NigeriaPropertyCentre.com, PrivateProperty.ng, NaijaHouses.com) generally have lighter anti-bot protection than Western sites. Most use:
- Basic rate limiting
- Cloudflare Free/Pro tier (Jiji.ng)
- Simple user-agent checking

### Recommended Anti-Bot Stack (ranked by effectiveness)

1. **curl_cffi** (already integrated) -- Chrome TLS fingerprint at HTTP level. Bypasses basic Cloudflare. Fastest option.

2. **Scrapling StealthyFetcher** (already integrated) -- Uses curl_cffi under the hood with additional evasion. Good for sites that check headers but don't render JS challenges.

3. **Patchright** (recommended addition) -- Undetected Playwright fork. Drop-in replacement for Playwright. Patches CDP leaks, removes automation flags. Currently considered undetectable for most sites. Open-source, Python SDK.
   - Install: `pip install patchright && patchright install`
   - Usage: Same API as Playwright -- swap `from playwright.async_api` with `from patchright.async_api`

4. **Nodriver** (alternative to Patchright) -- Successor to undetected-chromedriver. Async, direct Chrome DevTools Protocol communication. Most effective free anti-bot solution in 2026. Does not use WebDriver at all.
   - Install: `pip install nodriver`
   - Limitation: Different API from Playwright, requires rewriting browser code.

5. **Residential proxies** (if needed) -- For sites with IP-based blocking. Not currently needed for Nigerian sites but should be an option.

### Recommendation

Replace Playwright with **Patchright** in the existing scraper. It is a drop-in replacement (same API) that is significantly harder to detect. This is a 5-minute change:
- Change `from playwright.async_api import async_playwright` to `from patchright.async_api import async_playwright`
- The existing STEALTH_SCRIPT becomes mostly redundant (Patchright handles it internally)

---

## Architecture Patterns

### Current Architecture (Already Excellent)

The existing scraper implements a **4-layer cognitive loop** which is the recommended pattern for self-healing scrapers in 2026:

```
Layer 1: JSON-LD / Structured Data (free, instant, most reliable)
    |
    v (if missing data)
Layer 2: CSS Selectors via UniversalExtractor (fast, no LLM cost)
    |
    v (if selectors fail)
Layer 3: Crawl4AI -> Markdown -> Gemini Flash (LLM extraction)
    |
    v (self-healing feedback)
    Cache discovered CSS selectors for Layer 2
    |
    v (if all else fails)
Layer 4: Playwright + stealth (full browser rendering)
```

### Recommended Enhancements

**Enhancement A: Use Crawl4AI's `generate_schema()` instead of custom `discover_selectors()`**

The current `discover_selectors()` in `llm_schema_extractor.py` sends raw HTML to Gemini and asks it to find CSS selectors. Crawl4AI's built-in `JsonCssExtractionStrategy.generate_schema()` does this better:
- Analyzes full page structure (not just first 5000 chars)
- Produces properly formatted extraction schemas with nested support
- Generated schemas are directly usable with Crawl4AI's CSS extractor (no LLM needed for subsequent pages)

**Enhancement B: Activate Scrapling's adaptive parsing**

Currently Scrapling is used only as a fetcher. Its real power is adaptive element tracking:
```python
from scrapling import Adaptor

# First run: fingerprint elements
page = Adaptor(html, url=url, auto_save=True)
title = page.css('.property-title', auto_save=True)
price = page.css('.price', auto_save=True)

# After site redesign: auto-relocate
page = Adaptor(new_html, url=url, adaptive=True)
title = page.css('.property-title', adaptive=True)  # Finds it even if class changed
```

**Enhancement C: Add Patchright as Layer 4 replacement**

Replace Playwright with Patchright for better anti-bot evasion with zero API changes.

**Enhancement D: One-time schema generation per site**

For each new site added to the scraper:
1. Fetch one listing page
2. Call `JsonCssExtractionStrategy.generate_schema()` (one LLM call)
3. Store the schema in Redis/SQLite
4. Use the schema for all subsequent extractions on that site (zero LLM cost)

This replaces the current model where every failed CSS extraction triggers an LLM call.

---

## Integration with Existing Scraper

### Current Stack Analysis

The existing scraper at `/home/teedavid/Desktop/Projects/Realtors-Practice/scraper/` already has:

| Component | Status | Notes |
|-----------|--------|-------|
| Crawl4AI | Integrated | Used for Markdown conversion only |
| Scrapling | Integrated | Used as fetcher only, not for adaptive parsing |
| Playwright | Integrated | Layer 4 fallback with custom stealth script |
| Gemini Flash | Integrated | LLM extraction + normalization + selector discovery |
| curl_cffi | Integrated | Layer 1 HTTP fetcher |
| CSS extraction | Integrated | UniversalExtractor with configurable selectors |
| JSON-LD | Integrated | First-pass structured data extraction |
| Self-healing | Integrated | LLM discovers selectors, caches in Redis |
| Pagination | Integrated | 3-strategy pagination (next button, numeric, URL param) |
| Incremental scraping | Integrated | Tracks seen URLs, stops on consecutive known |
| Rate limiting | Integrated | Per-domain rate limiting |
| Block detection | Integrated | 15+ patterns for CAPTCHA/block detection |

### What's Missing (Priority Order)

1. **Patchright replacement for Playwright** -- 5-minute change, major anti-bot improvement
2. **Crawl4AI schema generation** -- Replace custom `discover_selectors()` with Crawl4AI's `generate_schema()` for better quality schemas
3. **Scrapling adaptive parsing** -- Activate `auto_save=True` and `adaptive=True` for resilient element tracking
4. **Per-site schema caching** -- Generate extraction schema once per site, reuse forever

### What's NOT Needed

- ScrapeGraphAI -- the existing Gemini Flash integration already does LLM extraction. ScrapeGraphAI would add another dependency for the same capability.
- Firecrawl/Apify/Zyte -- cloud services with per-page costs. The self-hosted stack is already more capable and cheaper.
- AgentQL/Kadoa -- premium services that don't add capabilities beyond what Crawl4AI + Gemini already provide.
- Browser-Use -- too slow for batch scraping (10-30s/page). Only useful for complex multi-step authentication flows.
- Diffbot -- free tier is generous but the ML models aren't trained on Nigerian property listings.

---

## Recommendations

### 1. Best Tool for Auto-Discovering CSS Selectors

**Winner: Crawl4AI's `JsonCssExtractionStrategy.generate_schema()`**

One-time LLM call per site generates a complete CSS extraction schema. The schema is then reused for unlimited pages with zero LLM cost. Already partially integrated in the codebase.

Runner-up: Scrapling's adaptive fingerprinting (zero LLM cost, but requires initial manual selectors).

### 2. Best Tool for Structured Property Extraction

**Winner: The existing Gemini Flash integration (already in place)**

The current `llm_schema_extractor.py` with its `PropertySchema` Pydantic model is well-tuned for Nigerian properties. Gemini 2.0 Flash is extremely cheap (~$0.125/million input tokens) and fast (~2-3 seconds per extraction).

Enhancement: Use Crawl4AI's Markdown conversion to reduce token cost by 80-90% (already partially done via `fetch_as_markdown()`).

### 3. Best Anti-Bot Solution

**Winner: Patchright (drop-in Playwright replacement)**

Currently considered undetectable for most anti-bot systems. Same API as Playwright, so integration is trivial. Open-source and free.

For Nigerian sites specifically, the existing curl_cffi + Scrapling StealthyFetcher layers are sufficient for 90%+ of sites. Patchright would handle the remaining edge cases (Jiji.ng with Cloudflare, etc.).

### 4. Best Overall Stack for Self-Healing Property Scraper

**The existing stack with three enhancements:**

```
Layer 1: JSON-LD (unchanged)
Layer 2: CSS selectors + Scrapling adaptive parsing (ENHANCE: activate adaptive mode)
Layer 3: Crawl4AI Markdown -> Gemini Flash extraction (ENHANCE: use generate_schema())
Layer 4: Patchright stealth browser (REPLACE: swap Playwright for Patchright)
Self-healing: Crawl4AI schema generation + Scrapling fingerprinting (ENHANCE)
```

### 5. What to Integrate into the Existing Scraper

**Immediate (high impact, low effort):**

1. **Replace Playwright with Patchright** -- Change one import line in `adaptive_fetcher.py`. Remove the custom `STEALTH_SCRIPT` (Patchright handles it).
   - Effort: 30 minutes
   - Impact: Significantly better anti-bot bypass

2. **Use Crawl4AI `generate_schema()` for per-site schema generation** -- When a new site is first scraped, generate a CSS extraction schema using one LLM call. Cache it. Use it for all subsequent pages.
   - Effort: 2-4 hours
   - Impact: Eliminates per-page LLM costs, better quality CSS selectors

**Medium-term (moderate effort):**

3. **Activate Scrapling adaptive parsing** -- Use `auto_save=True` when extracting elements, `adaptive=True` on subsequent runs. Elements auto-relocate when HTML changes.
   - Effort: 4-8 hours
   - Impact: True self-healing without any LLM cost

4. **Gemini Flash cost optimization** -- Switch to Gemini 3 Flash when available (~$0.125/million input tokens). Always convert to Markdown before LLM extraction to minimize tokens.
   - Effort: 1 hour
   - Impact: 80-90% reduction in LLM costs

**Not recommended:**

- Adding ScrapeGraphAI, Firecrawl, Apify, or other cloud services -- the existing self-hosted stack is already more capable and cheaper at the target volume (500 pages/day).

---

## Nigerian Real Estate Sites Reference

The primary target sites for the scraper:

| Site | URL | Anti-Bot Level | JS Required |
|------|-----|---------------|-------------|
| Nigeria Property Centre | nigeriapropertycentre.com | Low | No |
| PropertyPro | propertypro.ng | Low | Partial |
| Jiji.ng | jiji.ng | Medium (Cloudflare) | Yes |
| Private Property | privateproperty.ng | Low | No |
| NaijaHouses | naijahouses.com | Low | No |
| PropertyListHub | propertylisthub.com | Low | No |
| NaijaProperty | naijaproperty.com | Low | No |

Most Nigerian real estate sites have low anti-bot protection. The primary challenges are:
- Inconsistent HTML structure across sites
- Prices in various Naira formats (already handled by `price_parser.py`)
- Nigerian location parsing (already handled by `location_parser.py`)
- JavaScript-rendered content on some sites (handled by Playwright/Crawl4AI)

---

## Sources

- [Scrapling GitHub](https://github.com/D4Vinci/Scrapling)
- [Scrapling Adaptive Web Scraping Tutorial - ScrapingBee](https://www.scrapingbee.com/blog/scrapling-adaptive-python-web-scraping/)
- [Creating Self-Healing Spiders with Scrapling - Medium](https://medium.com/@d4vinci/creating-self-healing-spiders-with-scrapling-in-python-without-ai-web-scraping-4042a16ec4a5)
- [Crawl4AI LLM-Free Strategies Documentation](https://docs.crawl4ai.com/extraction/no-llm-strategies/)
- [Crawl4AI LLM Strategies Documentation](https://docs.crawl4ai.com/extraction/llm-strategies/)
- [Crawl4AI Strategies API](https://docs.crawl4ai.com/api/strategies/)
- [ScrapeGraphAI GitHub](https://github.com/ScrapeGraphAI/Scrapegraph-ai)
- [ScrapeGraphAI SmartScraper Documentation](https://docs.scrapegraphai.com/services/smartscraper)
- [ScrapeGraphAI Free vs Paid](https://scrapegraphai.com/blog/scrapegraph-free-vs-paid)
- [ScrapeGraphAI Pricing](https://scrapegraphai.com/pricing)
- [Firecrawl Pricing](https://www.firecrawl.dev/pricing)
- [Firecrawl Review 2026 - Use Apify](https://use-apify.com/blog/firecrawl-review-2026)
- [Apify Pricing](https://apify.com/pricing)
- [Apify Free Tier 2026](https://use-apify.com/docs/what-is-apify/apify-free-plan)
- [Zyte API Pricing](https://docs.zyte.com/zyte-api/pricing.html)
- [Zyte API Automatic Extraction](https://docs.zyte.com/zyte-api/usage/extract/index.html)
- [Diffbot Pricing](https://www.diffbot.com/pricing/)
- [AgentQL Documentation](https://docs.agentql.com/concepts/query-language)
- [AgentQL Under the Hood](https://docs.agentql.com/concepts/under-the-hood)
- [AgentQL Pricing](https://www.agentql.com/pricing)
- [Kadoa Pricing](https://www.kadoa.com/pricing)
- [Kadoa How AI Is Changing Web Scraping 2026](https://www.kadoa.com/blog/how-ai-is-changing-web-scraping-2026)
- [Browser-Use](https://browser-use.com/)
- [Patchright GitHub](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright)
- [Patchright vs Playwright - DEV](https://dev.to/claudeprime/patchright-vs-playwright-when-to-use-the-stealth-browser-fork-382a)
- [Nodriver GitHub](https://github.com/ultrafunkamsterdam/nodriver)
- [Visual Web Scraping with GPT Vision - Bright Data](https://brightdata.com/blog/ai/web-scraping-with-gpt-vision)
- [Web Scraping with Gemini AI - Oxylabs](https://oxylabs.io/blog/gemini-web-scraping)
- [Open-Source Web Scraping Revolution - Medium](https://medium.com/@tuguidragos/the-open-source-web-scraping-revolution-a-deep-dive-into-scrapegraphai-crawl4ai-and-the-future-d3a048cb448f)
- [Best AI Web Scrapers 2026 - Apify Blog](https://blog.apify.com/best-ai-web-scrapers/)
- [Top 7 AI Web Scraping Tools 2026 - ScrapeOps](https://scrapeops.io/web-scraping-playbook/best-ai-web-scraping-tools/)
- [AI Web Scraping 2026 - MorphLLM](https://www.morphllm.com/ai-web-scraping)
- [7 Best Web Scraping Tools 2026 - Index.dev](https://www.index.dev/blog/best-ai-web-scraping-tools)
- [Best Open-Source Web Crawlers 2026 - Firecrawl](https://www.firecrawl.dev/blog/best-open-source-web-crawler)
- [How to Bypass Cloudflare with Playwright 2026 - BrowserStack](https://www.browserstack.com/guide/playwright-cloudflare)
- [Bypass Cloudflare with Playwright 2026 - ZenRows](https://www.zenrows.com/blog/playwright-cloudflare-bypass)
- [How to Scrape with Patchright - ZenRows](https://www.zenrows.com/blog/patchright)
- [Self-Healing Web Scraping 2025 - Botsol](https://www.botsol.com/blog/whats-new-in-web-scraping-2025-ai-driven-self-healing)
- [Scrapling Production Pipelines - Medium](https://htrixe.medium.com/web-scraping-for-data-engineers-architecture-robustness-and-production-pipelines-with-scrapling-c327278222f7)
- [Real Estate Scraping Guide - ScrapeGraphAI](https://scrapegraphai.com/blog/real-estate-scraping-guide)
- [Top Property Listing Websites in Nigeria](https://oparahrealty.com/property-listing-websites-in-nigeria/)
