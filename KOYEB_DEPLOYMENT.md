# Deploying Background Jobs on Koyeb

> Guide for deploying the Python scraper microservice (Celery + Redis) on Koyeb as a cost-effective alternative to Render.

---

## What is Koyeb?

Koyeb is a serverless cloud platform that supports deploying **web services**, **workers**, and **cron jobs** with minimal configuration. It offers:

- **Native worker support** — run background processes (like Celery workers) without needing to fake a web server
- **Git-based deployments** — deploy directly from GitHub repos
- **Docker support** — deploy any Docker image
- **Auto-scaling** — scale to zero when idle (on certain plans)
- **Global edge network** — deploy close to your users
- **Free tier** — includes nano instances suitable for dev/staging

### Why Koyeb for Background Jobs?

- Render charges for background workers even when idle ($7/mo minimum for starter)
- Koyeb's nano instances start at **$0** (free tier) or **$2.70/mo** for eco instances
- Native worker type means no need for a dummy HTTP server
- Better suited for queue-based workloads like Celery

---

## Prerequisites

1. **Koyeb account** — Sign up at [app.koyeb.com](https://app.koyeb.com)
2. **Koyeb CLI** (optional but recommended):
   ```bash
   curl -fsSL https://raw.githubusercontent.com/koyeb/koyeb-cli/master/install.sh | sh
   koyeb login
   ```
3. **GitHub repo** connected to Koyeb (or a Docker registry)
4. **Redis instance** — either Koyeb-managed or external (Upstash recommended)
5. **Docker image** for the scraper service (already defined in `scraper/Dockerfile`)

---

## Step 1: Set Up Redis

### Option A: Upstash Redis (Recommended)

Upstash is the best option for this use case — it offers a generous free tier and is serverless (pay-per-request).

1. Go to [console.upstash.com](https://console.upstash.com)
2. Create a new Redis database
3. Select the region closest to your Koyeb deployment (e.g., `eu-west-1` or `us-east-1`)
4. Copy the **Redis URL** — it looks like:
   ```
   rediss://default:YOUR_PASSWORD@your-instance.upstash.io:6379
   ```
5. Note: Upstash free tier includes **10,000 commands/day** — sufficient for development. Production may need the Pay-As-You-Go plan ($0.2 per 100K commands).

### Option B: Koyeb-Managed Redis (if available)

Koyeb periodically adds managed database offerings. Check the Koyeb dashboard under **Databases** for Redis availability. If available:

1. Create a Redis instance from the Koyeb dashboard
2. Use the internal connection string provided (faster, no egress costs)

### Option C: Railway or Render Redis

If you already have Redis on another platform, you can use its external URL. Just be aware of added latency from cross-provider network hops.

---

## Step 2: Prepare the Scraper for Deployment

Ensure your `scraper/Dockerfile` is production-ready:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for Playwright
RUN apt-get update && apt-get install -y \
    wget \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers
RUN playwright install chromium --with-deps

COPY . .

# Default command runs the Celery worker
CMD ["celery", "-A", "tasks", "worker", "--loglevel=info", "--concurrency=2"]
```

Make sure `requirements.txt` includes:
```
celery[redis]
redis
playwright
beautifulsoup4
requests
flask  # or fastapi + uvicorn for the API endpoint
```

---

## Step 3: Deploy the Scraper Worker on Koyeb

### Via Web Dashboard

1. Go to **app.koyeb.com** > **Create Service**
2. Select **GitHub** as the deployment source
3. Choose your repository and branch (e.g., `main`)
4. Set the **Build** settings:
   - **Builder:** Docker
   - **Dockerfile path:** `scraper/Dockerfile`
   - **Build context:** `scraper/`
5. Set the **Service type** to **Worker** (not Web)
   - This is critical — workers don't need an HTTP port
6. Choose instance size:
   - **Development:** Nano ($0/mo free tier) or Eco ($2.70/mo)
   - **Production:** Small ($5.40/mo) or Medium ($10.70/mo)
7. Set environment variables (see Step 4)
8. Deploy

### Via Koyeb CLI

```bash
koyeb service create scraper-worker \
  --app realtors-practice \
  --git github.com/YOUR_USERNAME/Realtors-Practice \
  --git-branch main \
  --git-docker-dockerfile scraper/Dockerfile \
  --git-docker-context scraper/ \
  --type worker \
  --instance-type nano \
  --env REDIS_URL=rediss://default:YOUR_PASSWORD@your-instance.upstash.io:6379 \
  --env CELERY_BROKER_URL=rediss://default:YOUR_PASSWORD@your-instance.upstash.io:6379 \
  --env CELERY_RESULT_BACKEND=rediss://default:YOUR_PASSWORD@your-instance.upstash.io:6379 \
  --env NODE_API_URL=https://realtors-practice-new-api.onrender.com/api \
  --env INTERNAL_API_KEY=your-internal-key \
  --env SCRAPER_ENV=production \
  --env PROXY_URL=your-proxy-url-if-any
```

---

## Step 4: Environment Variables

Set these environment variables in the Koyeb dashboard or CLI:

| Variable | Description | Example |
|---|---|---|
| `REDIS_URL` | Redis connection string | `rediss://default:xxx@host:6379` |
| `CELERY_BROKER_URL` | Celery broker (same as REDIS_URL) | `rediss://default:xxx@host:6379` |
| `CELERY_RESULT_BACKEND` | Celery result store (same as REDIS_URL) | `rediss://default:xxx@host:6379` |
| `NODE_API_URL` | Node.js backend API base URL | `https://realtors-practice-new-api.onrender.com/api` |
| `INTERNAL_API_KEY` | Shared secret for service-to-service auth | (match backend `INTERNAL_API_KEY`) |
| `SCRAPER_ENV` | Environment name | `production` |
| `PROXY_URL` | Rotating proxy URL (optional) | `http://user:pass@proxy.example.com:8080` |
| `LOG_LEVEL` | Logging verbosity | `info` |

---

## Step 5: Connect Node.js Backend to the Koyeb Scraper

The Node.js backend does **not** call the Koyeb worker directly. Instead, it pushes tasks to Redis, and the Koyeb-hosted Celery worker picks them up. The flow is:

```
[Node.js Backend] ---> [Redis (Upstash)] <--- [Celery Worker (Koyeb)]
                                                      |
                                                      v
                                              [Scrapes websites]
                                                      |
                                                      v
                                          [POST results back to Node.js API]
```

### Backend Changes

1. **Install a Redis/Celery client** in the Node.js backend:
   ```bash
   cd backend
   npm install ioredis
   ```

2. **Dispatch scrape jobs** by pushing to the Redis queue that Celery monitors:
   ```typescript
   // backend/src/services/scrape.service.ts
   import Redis from 'ioredis';

   const redis = new Redis(process.env.REDIS_URL!);

   export async function dispatchScrapeJob(siteId: string, params: object) {
     const task = {
       id: `scrape-${siteId}-${Date.now()}`,
       task: 'tasks.scrape_site',
       args: [siteId, params],
       kwargs: {},
     };

     await redis.lpush('celery', JSON.stringify({
       body: Buffer.from(JSON.stringify(task)).toString('base64'),
       'content-encoding': 'utf-8',
       'content-type': 'application/json',
       headers: {},
       properties: {
         delivery_tag: task.id,
         delivery_mode: 2,
       },
     }));

     return task.id;
   }
   ```

3. **Receive results** via the existing internal callback routes:
   - `POST /api/internal/scrape-results` — receives scraped properties
   - `POST /api/internal/scrape-progress` — receives progress updates
   - `POST /api/internal/scrape-error` — receives error reports

4. **Add `REDIS_URL` to your backend `.env`:**
   ```
   REDIS_URL=rediss://default:YOUR_PASSWORD@your-instance.upstash.io:6379
   ```

### Alternative: HTTP API Approach

If you prefer not to use Redis for job dispatch, you can also deploy a **web service** (not worker) on Koyeb that exposes a FastAPI/Flask endpoint:

```bash
koyeb service create scraper-api \
  --type web \
  --port 8000 \
  --git-docker-command "uvicorn app:app --host 0.0.0.0 --port 8000"
```

Then the Node.js backend calls the scraper HTTP API directly. The scraper API enqueues tasks to its own local Celery worker. This approach is simpler but costs slightly more (two services instead of one).

---

## Step 6: Deploy the Celery Beat Scheduler (Optional)

If you need scheduled/periodic scraping (e.g., scrape all active sites every 6 hours), deploy a second worker for Celery Beat:

```bash
koyeb service create scraper-beat \
  --app realtors-practice \
  --type worker \
  --instance-type nano \
  --git-docker-command "celery -A tasks beat --loglevel=info" \
  # ... same env vars as the worker
```

---

## Cost Comparison: Koyeb vs Render

| Component | Render | Koyeb | Notes |
|---|---|---|---|
| **Background Worker** | $7/mo (Starter) | $0-2.70/mo (Nano/Eco) | Koyeb has a free tier for workers |
| **Redis** | $0 (free 25MB) or $7/mo | N/A (use Upstash) | Upstash free: 10K cmd/day |
| **Upstash Redis** | — | $0 free / ~$1-3/mo | Pay-per-request model |
| **Web Service (if needed)** | $7/mo | $0-2.70/mo | Only if using HTTP API approach |
| **Total (dev/staging)** | $7-14/mo | $0-3/mo | Koyeb is significantly cheaper |
| **Total (production)** | $14-21/mo | $5-11/mo | ~50% savings on Koyeb |

### Summary

- **Development:** Koyeb free tier + Upstash free tier = **$0/mo** (vs $7/mo on Render)
- **Production:** Koyeb Eco + Upstash Pay-As-You-Go = **~$5-8/mo** (vs $14-21/mo on Render)
- **Savings:** 50-100% depending on usage

---

## Monitoring and Logs

- **Koyeb Dashboard:** View real-time logs, deployment status, and resource usage
- **Koyeb CLI:** `koyeb service logs scraper-worker --app realtors-practice`
- **Celery Flower** (optional): Deploy as a separate web service for task monitoring
  ```bash
  koyeb service create scraper-flower \
    --type web \
    --port 5555 \
    --git-docker-command "celery -A tasks flower --port=5555"
  ```

---

## Important Notes

- The **Node.js API server** can stay on Render or move to Koyeb — the architecture is provider-agnostic since communication goes through Redis and HTTP callbacks.
- Koyeb **auto-deploys** on git push (configurable per branch).
- If using Playwright for scraping, ensure the Docker image includes Chromium dependencies (the Dockerfile above handles this).
- Koyeb nano instances have **256MB RAM** — if Playwright + Celery exceeds this, upgrade to Eco (512MB) or Small (1GB).
- For high-volume scraping, consider running **multiple worker replicas** on Koyeb (horizontal scaling).
