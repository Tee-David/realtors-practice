# Backend (API & Core Services)

This is the core backend API for Realtors' Practice. It handles property data, search indexing via Meilisearch, background tasks, and webhook integrations.

## 🛠️ Tech Stack

- **Framework**: Node.js + Express
- **Language**: TypeScript
- **Database ORM**: Prisma
- **Database Engine**: PostgreSQL (CockroachDB in Production)
- **Search Engine**: Meilisearch
- **Task Queue**: Celery / Redis (Upstash)
- **Auth**: Supabase (Backend verification)

## 📁 Key Directories

- `src/controllers/`: Route handlers (e.g., `search.controller.ts`, `auth.controller.ts`).
- `src/routes/`: Express router definitions mapping paths to controllers.
- `src/services/`: Core business logic (Meilisearch integrations, database calls).
- `src/utils/`: Helpers for API responses, logging, and validations.
- `prisma/`: Prisma schema (`schema.prisma`) and migrations.

## ⚙️ Environment Variables

Create a `.env` file in this directory with the following configuration:

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/realtors_practice
SUPABASE_URL=https://<YOUR_PROJECT>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<SECRET>
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Search
MEILISEARCH_URL=http://localhost:7700
MEILISEARCH_MASTER_KEY=<KEY>

# Queue
REDIS_URL=rediss://default:<PAT>@<HOST>.upstash.io:6379 
```

## 🔍 Search & Meilisearch
This backend stays in sync with a Meilisearch instance to provide ultra-fast, faceted search capabilities on the `/api/v1/search` endpoint. It uses faceted categories for dynamic UI filtering.

## 🤖 Jotform User Hashing Route
To keep AI interactions secure, the backend implements a route (e.g., `/api/auth/jotform-hash`) that accepts a logged-in user's UUID and returns an authenticated HMAC hash using the agent's secret key (`MDE5Y2QxY...`). This hash is consumed by the frontend to authenticate the chat session.

## 🏃‍♂️ Development

```bash
npm install
npm run dev
```
The API is available at [http://localhost:5000](http://localhost:5000).
