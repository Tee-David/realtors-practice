# Starting Services

## Quick Start

```bash
# Linux/Mac
./start-services.sh

# Windows
start-services.bat
```

This starts all 3 services: Backend (:5000), Scraper (:8000), Frontend (:3000).

## Secrets

Scripts auto-detect [Doppler](https://doppler.com) and use it if available. Falls back to local `.env` files otherwise.

### First-time Doppler setup

```bash
# Install (Linux)
curl -sLf https://cli.doppler.com/install.sh | sh

# Login
doppler login

# Verify
doppler me
```

### Manual start (per-service)

```bash
# With Doppler
doppler run -p realtors-practice -c prd_backend -- npm run dev         # backend/
doppler run -p realtors-practice -c prd_frontend_local -- npm run dev  # frontend/
doppler run -p realtors-practice -c prd_scraper -- python3 -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload  # scraper/

# Without Doppler (uses .env files)
cd backend && npm run dev
cd frontend && npm run dev
cd scraper && python3 -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

### Doppler configs

| Service | Config | Keys |
|---------|--------|------|
| Backend | `prd_backend` | 21 |
| Frontend | `prd_frontend_local` | 7 |
| Scraper | `prd_scraper` | 8 |
