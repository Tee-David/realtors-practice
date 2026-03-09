# Realtors' Practice

Welcome to the **Realtors' Practice** monorepo workspace. This repository contains the source code for a modern, luxury real estate platform designed for the Nigerian market, featuring AI-powered search, dynamic maps, scraping capabilities, and automated lead capture.

## 🏗️ Repository Architecture

This project is structured as a monorepo containing multiple independent services:

- **`/frontend`**: A Next.js 14 (App Router) application. Handles the client-facing UI, dashboards, search interfaces, and maps.
- **`/backend`**: A Node.js / Express API. Handles core business logic, database interactions, authentication verifications, search indexing, and webhooks.
- **`/scraper`**: A separate service (likely Python/Node) responsible for data collection and populating the property listings database.

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+)
- PostgreSQL (Local or Cloud like CockroachDB)
- Meilisearch (Local or Cloud)
- Redis / Upstash (For caching and background tasks)

### Environment Setup
1. Copy the `.env` references from the root into the respective service directories (`/frontend/.env.local`, `/backend/.env`).
2. Ensure you have the Supabase keys, Database URL, and Meilisearch URLs correctly configured.

### Running Locally

**Terminal 1: Backend**
```bash
cd backend
npm install
npm run dev
```

**Terminal 2: Frontend**
```bash
cd frontend
npm install
npm run dev
```

## 🤖 AI Integrations
This platform utilizes a **Jotform AI Agent** for customer service, lead generation, and natural-language property searching. 

## 🗺️ Mapping
The platform uses MapLibre / OpenStreetMap (via `@mapcn/map`) to render dynamic property clusters and interactive exploration interfaces.

---
*Note: This README serves as a high-level overview. Please refer to the specific `README.md` files inside `/frontend`, `/backend`, and `/scraper` for service-specific documentation.*
