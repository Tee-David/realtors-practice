# Security Audit — Realtors' Practice

**Date:** 2026-03-15
**Auditor:** Claude Code (automated security review)
**Scope:** Full-stack application (Next.js frontend, Express/TypeScript backend, Python/FastAPI scraper, Supabase auth, CockroachDB, Redis/Upstash, Meilisearch)

---

## Executive Summary

**CRITICAL RISK: The root `.env` file contains ALL production secrets (database credentials, Supabase service role key, API keys, Redis URL, GitHub PAT, Render CLI token) and appears to be tracked in git.** This single issue alone could lead to full account takeover of every service used by this project. Immediate rotation of all credentials is required.

Beyond that, the application demonstrates solid security fundamentals: Helmet, CORS, CSRF protection, rate limiting (IP + per-user), Zod input validation, Prisma ORM (preventing SQL injection), audit logging, and role-based access control. The findings below are prioritized by severity.

---

## Findings

### CRITICAL

```
ID: SEC-001
Severity: CRITICAL
Title: All production secrets committed to repository in root .env file
Location: /.env
Description: The root .env file contains plaintext production credentials including:
  - CockroachDB connection string with username/password
  - Supabase service role key (full admin access to auth)
  - Supabase anon key and secret key
  - Resend API key (email sending)
  - Redis/Upstash URL with credentials
  - GitHub Personal Access Token (ghp_...)
  - Koyeb API key
  - Render CLI token
  - Gemini API key
  - Jotform agent secret
  - INTERNAL_API_KEY for scraper auth
  - ExchangeRate API key
  The .gitignore lists ".env" but the file exists at the repository root
  and appears to have been committed at some point. Any clone of this repo
  exposes every production secret.
Impact: Full compromise of all services — database, auth, email, hosting,
  CI/CD, Redis, scraper. An attacker could read/modify/delete all data,
  impersonate any user, deploy malicious code, or pivot to other systems.
Remediation:
  1. IMMEDIATELY rotate ALL credentials listed above.
  2. Remove the .env file from git history (use git filter-repo or BFG).
  3. Verify .gitignore actually prevents re-adding it.
  4. Use a .env.example with placeholder values instead.
  5. Consider GitHub secret scanning alerts.
```

```
ID: SEC-002
Severity: CRITICAL
Title: Env controller allows reading/writing the server .env file via API
Location: backend/src/controllers/env.controller.ts
Description: The EnvController exposes GET /env (read all env vars) and
  PUT /env (overwrite the .env file) endpoints. While protected by
  authenticate + authorize("ADMIN") + a hardcoded super-admin email check,
  this endpoint:
  - Returns ALL secrets (DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY, etc.)
    over the network in a JSON response.
  - Allows arbitrary .env file content to be written to disk, which could
    inject malicious values (e.g., changing DATABASE_URL to an attacker DB,
    or changing INTERNAL_API_KEY to bypass scraper auth).
  - The super-admin check relies on a hardcoded email address
    ("wedigcreativity@gmail.com") — if that Supabase account is compromised,
    all secrets are exposed.
  Note: This route is defined in env.routes.ts but not registered in
  routes/index.ts. If it was previously registered or gets re-added, this
  is an immediate critical risk.
Impact: Remote read/write of all production secrets if an admin account is
  compromised. Even with proper auth, transmitting secrets over HTTP is a
  data exfiltration risk.
Remediation:
  1. Remove this endpoint entirely — manage env vars via hosting platform
     (Render dashboard, Vercel dashboard).
  2. If absolutely needed, never return secret values (mask them).
  3. Never allow writing to the .env file via API.
```

```
ID: SEC-003
Severity: CRITICAL
Title: Default internal API key is a well-known string
Location: backend/src/config/env.ts:36, scraper/config.py:14
Description: Both the backend and scraper default to "dev-internal-key"
  when INTERNAL_API_KEY is not set. In development or if the env var is
  accidentally unset in production, any attacker can call internal endpoints
  (/api/internal/scrape-results, /api/internal/scrape/scheduled, etc.)
  using this known default key.
Impact: Attacker can inject arbitrary property data into the database,
  trigger scrape jobs, or report fake errors/progress — all without
  authentication.
Remediation:
  1. Remove the default value — fail hard if INTERNAL_API_KEY is not set.
  2. Add a startup check: if NODE_ENV === "production" and the key is
     "dev-internal-key" or empty, refuse to start.
  3. Use a cryptographically random key (32+ bytes).
```

### HIGH

```
ID: SEC-004
Severity: High
Title: Hardcoded super admin email grants permanent ADMIN privilege
Location: backend/src/middlewares/auth.middleware.ts:48-71
Description: The authenticate middleware checks if the user's email is
  "wedigcreativity@gmail.com" and auto-promotes them to ADMIN on every
  request (even upgrading if their DB role was changed). This means:
  - If someone registers a Supabase account with this email on a different
    Supabase project, or if the Supabase project is misconfigured, they
    get admin access.
  - There is no way to revoke this user's admin privileges.
  - The same hardcoded email appears in env.controller.ts for the
    super-admin gate.
Impact: Single point of failure — compromise of this one email/Supabase
  account gives irrevocable admin access to the entire system.
Remediation:
  1. Move super-admin designation to a database flag or environment variable.
  2. Use a separate SUPER_ADMIN_EMAILS env var (comma-separated list).
  3. Allow the super-admin list to be managed without code changes.
```

```
ID: SEC-005
Severity: High
Title: Invite code is only 6 hex characters (24 bits of entropy)
Location: backend/src/routes/auth.routes.ts:146
Description: Invite codes are generated with crypto.randomBytes(3) which
  produces only 6 hex characters (e.g., "A3F1B2"). This is only 16.7 million
  possible values. With the auth rate limiter allowing 10 attempts/hour in
  production, a determined attacker could brute-force a valid invite code
  in ~69 days. Since invite codes are valid for 24 hours and the
  /auth/validate-invite endpoint has no specific rate limiting, an attacker
  could test codes much faster via that endpoint.
Impact: Unauthorized account creation with whatever role the invite
  specifies (including ADMIN if an admin invite is pending).
Remediation:
  1. Increase to crypto.randomBytes(16) or more (32 hex chars).
  2. Apply strict rate limiting to /auth/validate-invite.
  3. Consider using UUIDs for invite codes.
```

```
ID: SEC-006
Severity: High
Title: CORS allows all origins in non-production environments
Location: backend/src/app.ts:61
Description: When config.env !== "production", the CORS handler returns
  callback(null, true) for ANY origin. If the backend is accidentally
  deployed with NODE_ENV unset or set to "development" or "staging", any
  website can make authenticated cross-origin requests.
Impact: Cross-origin attacks against any non-production deployment that is
  internet-accessible (e.g., staging environments).
Remediation:
  1. Explicitly list allowed origins for ALL environments.
  2. Only add localhost origins when NODE_ENV === "development".
  3. Add a startup warning if CORS is set to allow all origins.
```

```
ID: SEC-007
Severity: High
Title: No sanitization of scraped data before database insertion (Stored XSS)
Location: backend/src/services/scrape.service.ts:367-379, backend/src/services/property.service.ts
Description: Scraped property data (title, description, location, agent
  names, etc.) from external websites is passed directly to
  PropertyService.create() without sanitization. If a malicious website
  injects HTML/JavaScript into property listings, it will be stored in the
  database and could be rendered unsafely in the frontend.
  The frontend uses dangerouslySetInnerHTML in several places (layout.tsx,
  preloader.tsx, jotform-agent.tsx, tour-provider.tsx, sites/page.tsx),
  though these appear to use hardcoded content rather than scraped data.
Impact: Stored XSS — if scraped data containing malicious scripts is
  displayed in the frontend, it could steal admin session tokens or
  perform actions on behalf of authenticated users.
Remediation:
  1. Sanitize all scraped text fields (strip HTML tags, encode entities)
     before storing in the database.
  2. Use a library like DOMPurify or sanitize-html on the backend.
  3. Audit all frontend rendering of property data to ensure React's
     default escaping is used (no dangerouslySetInnerHTML with dynamic data).
```

```
ID: SEC-008
Severity: High
Title: Swagger/API docs exposed in production without authentication
Location: backend/src/config/swagger.ts, backend/src/app.ts:32
Description: The Swagger UI is mounted at /api/docs and the raw OpenAPI
  spec at /api/docs.json. These are set up before any auth middleware
  and are accessible to anyone. They reveal:
  - Every API endpoint, its parameters, and expected responses
  - Internal endpoint structure (/internal/*)
  - Authentication scheme details
  - Rate limit configuration
Impact: Information disclosure that aids attackers in mapping the attack
  surface. Reveals internal API endpoints that should not be public knowledge.
Remediation:
  1. Disable Swagger in production: if (config.env !== "production") { setupSwagger(app); }
  2. Or protect it behind authentication.
```

### MEDIUM

```
ID: SEC-009
Severity: Medium
Title: SSRF risk via scraper callbackUrl parameter
Location: scraper/app.py:121-128, scraper/utils/callback.py:18-21
Description: The ScrapeJobRequest model accepts a callbackUrl field. The
  scraper will make HTTP POST requests to this URL (appending paths like
  /internal/scrape-results). While the backend controls what callbackUrl
  is sent (scrape.service.ts:57-59), there is no validation in the scraper
  that the callback URL points to the expected backend. If an attacker can
  manipulate the job payload, they could redirect callbacks to an arbitrary
  server.
Impact: SSRF — the scraper could be tricked into sending scraped data
  (including potentially sensitive property information) to an
  attacker-controlled server, along with the internal API key in the
  X-Internal-Key header.
Remediation:
  1. Validate callbackUrl in the scraper against an allowlist of known
     backend URLs.
  2. Or remove the callbackUrl feature entirely and always use the
     configured api_base_url.
```

```
ID: SEC-010
Severity: Medium
Title: No rate limiting on /auth/validate-invite endpoint
Location: backend/src/routes/auth.routes.ts:184
Description: The /auth/validate-invite endpoint is not protected by
  the authLimiter (which only covers /auth/login and /auth/register).
  This endpoint accepts an invite code and returns the invitation details
  (email, role) if valid. Combined with SEC-005 (weak invite codes), this
  enables brute-force enumeration of valid invite codes.
Impact: Invite code brute-forcing and information disclosure (reveals
  which emails have pending invitations and their assigned roles).
Remediation:
  1. Apply aggressive rate limiting to /auth/validate-invite.
  2. Add exponential backoff after failed attempts from the same IP.
```

```
ID: SEC-011
Severity: Medium
Title: Search routes are unauthenticated
Location: backend/src/routes/search.routes.ts
Description: The /search and /search/suggestions endpoints have no
  authentication requirement. While they have their own rate limiter
  (200 req / 5 min), they expose the full Meilisearch property index
  to unauthenticated users.
Impact: Data scraping — an attacker can enumerate all property data
  without authentication, even if the main /properties endpoint requires
  auth.
Remediation:
  1. Add authentication to search routes if property data should be
     access-controlled.
  2. Or accept this as intentional for public search and ensure no
     sensitive data (agent phone numbers, internal IDs, etc.) is included
     in search results.
```

```
ID: SEC-012
Severity: Medium
Title: Sentry debug route exposed in production
Location: backend/src/app.ts:131-133
Description: The /debug-sentry route intentionally throws an error.
  While not directly exploitable, it:
  - Reveals that Sentry is used for error tracking
  - Could be used to flood Sentry with fake errors (quota exhaustion)
  - Sends an error to Sentry on every request (no rate limiting)
Impact: Sentry quota exhaustion, information disclosure about monitoring
  infrastructure.
Remediation:
  1. Guard behind a production check:
     if (config.env !== "production") { app.get("/debug-sentry", ...); }
```

```
ID: SEC-013
Severity: Medium
Title: Internal API key comparison is not timing-safe
Location: backend/src/middlewares/internal.middleware.ts:10, backend/src/middlewares/csrf.middleware.ts:31
Description: The internal API key is compared using !== (strict equality)
  rather than crypto.timingSafeEqual(). This is vulnerable to timing attacks
  where an attacker can determine the correct key character by character
  by measuring response times.
Impact: With enough requests, an attacker could determine the internal
  API key through timing side-channel analysis.
Remediation:
  1. Use crypto.timingSafeEqual() for all secret comparisons.
  2. Ensure both strings are the same length before comparing (pad if needed).
```

```
ID: SEC-014
Severity: Medium
Title: Password policy is weak (minimum 8 characters only)
Location: backend/src/routes/auth.routes.ts:24, :216
Description: The registration schemas only enforce z.string().min(8) for
  passwords. There is no requirement for complexity (uppercase, lowercase,
  digits, special characters).
Impact: Users may choose weak passwords that are easily guessable or
  found in breach databases.
Remediation:
  1. Enforce password complexity requirements (e.g., must contain upper,
     lower, digit, special char).
  2. Consider checking against breached password databases (HaveIBeenPwned API).
  3. Note: Supabase also has its own password policy which may add some
     protection, but the backend should validate independently.
```

```
ID: SEC-015
Severity: Medium
Title: WebSocket CORS allows all origins in non-production
Location: backend/src/socketServer.ts:14-16
Description: The Socket.io server uses cors: { origin: "*" } when not in
  production. This mirrors SEC-006 for WebSocket connections.
Impact: Cross-origin WebSocket hijacking in non-production environments.
Remediation:
  1. Explicitly list allowed origins for all environments.
```

```
ID: SEC-016
Severity: Medium
Title: avatarUrl field allows up to 5MB of data
Location: backend/src/routes/auth.routes.ts:375
Description: The updateProfileSchema allows avatarUrl to be up to
  5,000,000 characters. This appears to support base64-encoded avatar
  images stored directly in the database field. This creates:
  - Large database storage costs
  - Potential DoS by uploading many large avatars
  - No validation that the content is actually an image
Impact: Storage exhaustion, potential for storing malicious content
  in the avatarUrl field.
Remediation:
  1. Use a proper file upload service (Supabase Storage, S3, etc.)
  2. Validate that avatarUrl is a URL if stored as a URL, or validate
     base64 content type if stored inline.
  3. Reduce max size significantly.
```

### LOW

```
ID: SEC-017
Severity: Low
Title: Test email endpoint allows sending to arbitrary addresses
Location: backend/src/routes/auth.routes.ts:423-434
Description: The /auth/test-email endpoint accepts an optional "to"
  parameter and will send a test email to any address. While it requires
  authentication, any authenticated user can use this to:
  - Send emails that appear to come from the application's domain
  - Enumerate valid email addresses
  - Consume Resend API quota
Impact: Email abuse/phishing, API quota exhaustion.
Remediation:
  1. Restrict to ADMIN role only.
  2. Or remove the "to" parameter and only allow sending to the
     authenticated user's own email.
```

```
ID: SEC-018
Severity: Low
Title: Prisma query logging enabled in development exposes query details
Location: backend/src/prismaClient.ts:55-58
Description: In development mode, Prisma logs all queries including
  "query", "error", "warn". Query logs may contain sensitive data from
  WHERE clauses (emails, tokens, etc.).
Impact: Sensitive data exposure in development logs.
Remediation:
  1. In development, log only ["error", "warn"] by default.
  2. Only enable query logging via an explicit DEBUG_PRISMA=true env var.
```

```
ID: SEC-019
Severity: Low
Title: GitHub Actions CD pipeline uses deploy hooks without verification
Location: .github/workflows/cd.yml
Description: The CD pipeline simply POSTs to deploy hook URLs stored in
  GitHub secrets. There is no commit verification, no build step, and no
  approval gate. Anyone with push access to main triggers production
  deployment.
Impact: Unreviewed or malicious code can be deployed to production by
  any contributor with push access.
Remediation:
  1. Require CI to pass before CD runs (add "needs: [backend-ci, frontend-ci]").
  2. Consider requiring manual approval for production deployments.
  3. Add branch protection rules requiring PR reviews before merge to main.
```

```
ID: SEC-020
Severity: Low
Title: Docker image runs as root
Location: scraper/Dockerfile
Description: The scraper Dockerfile does not specify a non-root user.
  The process runs as root inside the container.
Impact: If the container is compromised, the attacker has root access
  within the container, making container escape easier.
Remediation:
  1. Add a non-root user: RUN adduser --disabled-password --gecos '' scraper
  2. Switch to it: USER scraper
  3. Note: Playwright may require some system-level access — test after change.
```

```
ID: SEC-021
Severity: Low
Title: CI pipeline does not run security audits
Location: .github/workflows/ci.yml
Description: The CI pipeline runs type checking and builds but does not
  run npm audit, pip audit, or any dependency vulnerability scanning.
Impact: Vulnerable dependencies may be deployed without detection.
Remediation:
  1. Add "npm audit --audit-level=high" step to backend and frontend CI.
  2. Add "pip audit" step for the scraper.
  3. Consider Dependabot or Snyk for automated dependency PRs.
```

### INFO

```
ID: SEC-022
Severity: Info
Title: Supabase admin client falls back to anon key
Location: backend/src/utils/supabase.ts:6
Description: The supabaseAdmin client uses serviceRoleKey || anonKey.
  If the service role key is not set, the "admin" client operates with
  anon-level permissions, which would silently break admin operations
  (like creating users) rather than failing loudly.
Impact: Silent security degradation — admin operations may fail
  unpredictably if the service role key is missing.
Remediation:
  1. Fail hard if SUPABASE_SERVICE_ROLE_KEY is not set:
     throw new Error("SUPABASE_SERVICE_ROLE_KEY is required")
```

```
ID: SEC-023
Severity: Info
Title: Env routes file exists but is not registered in routes/index.ts
Location: backend/src/routes/env.routes.ts
Description: The env routes file exists and defines GET/PUT /env endpoints,
  but routes/index.ts does not import or register it. The endpoints are
  currently unreachable. However, if someone adds the import, the critical
  endpoints in SEC-002 would immediately become active.
Impact: No current impact, but represents latent risk.
Remediation:
  1. Delete env.routes.ts and env.controller.ts entirely.
  2. Or add a large warning comment explaining why it must never be registered.
```

```
ID: SEC-024
Severity: Info
Title: Body parser limit set to 10MB
Location: backend/src/app.ts:104
Description: express.json() and express.urlencoded() both have a 10MB
  limit. For an API that primarily handles JSON property data, this is
  generous and could enable large payload attacks.
Impact: Memory exhaustion via large request bodies (partially mitigated
  by rate limiting).
Remediation:
  1. Reduce to 1MB for most routes, with a larger limit only for
     specific endpoints that need it (e.g., scrape results with many
     properties).
```

---

## Security Checklist

### Authentication and Authorization
- [x] JWT validation via Supabase (server-side token verification)
- [x] Role-based access control (ADMIN, EDITOR, VIEWER, API_USER)
- [x] Auth middleware applied to all sensitive routes
- [x] Admin-only routes properly gated with authorize("ADMIN")
- [ ] **FIX:** Hardcoded super-admin email (SEC-004)
- [ ] **FIX:** Weak invite codes (SEC-005)
- [ ] **FIX:** Weak password policy (SEC-014)

### Secrets Management
- [ ] **CRITICAL FIX:** Rotate ALL secrets and remove .env from git (SEC-001)
- [ ] **CRITICAL FIX:** Remove env controller endpoints (SEC-002)
- [ ] **FIX:** Remove default internal API key (SEC-003)
- [ ] **FIX:** Fail hard if SUPABASE_SERVICE_ROLE_KEY is missing (SEC-022)

### Input Validation
- [x] Zod validation on all auth endpoints
- [x] Zod validation on property create/update
- [x] express-mongo-sanitize for NoSQL injection prevention
- [x] Prisma ORM prevents SQL injection (no raw queries except health check)
- [ ] **FIX:** Sanitize scraped data before DB insertion (SEC-007)

### HTTP Security
- [x] Helmet with strict CSP
- [x] CORS with origin allowlist (production)
- [x] CSRF protection via Origin/Referer validation
- [x] X-Content-Type-Options: nosniff (Helmet default)
- [x] X-Frame-Options via frameAncestors: ["'none'"] (Helmet)
- [ ] **FIX:** CORS open in non-production (SEC-006)
- [ ] **FIX:** WebSocket CORS open in non-production (SEC-015)

### Rate Limiting
- [x] Global IP-based rate limit (300/15min production)
- [x] Auth-specific rate limit (10/hour production)
- [x] Per-user rate limit (200/15min production)
- [x] Search-specific rate limit (200/5min)
- [ ] **FIX:** No rate limit on /auth/validate-invite (SEC-010)

### Scraper Security
- [x] Internal API key authentication for scraper callbacks
- [x] robots.txt compliance checking
- [x] Per-domain rate limiting with configurable delays
- [x] Job timeout (30 minutes)
- [x] Stuck job killer via cron
- [ ] **FIX:** Default internal API key (SEC-003)
- [ ] **FIX:** SSRF via callbackUrl (SEC-009)
- [ ] **FIX:** Timing-safe key comparison (SEC-013)
- [ ] **FIX:** Scraped data sanitization (SEC-007)

### Infrastructure
- [x] .gitignore covers .env files
- [x] GitHub Actions secrets for sensitive values in CI/CD
- [ ] **CRITICAL FIX:** .env file with secrets in repo (SEC-001)
- [ ] **FIX:** CD pipeline has no CI gate (SEC-019)
- [ ] **FIX:** No dependency vulnerability scanning (SEC-021)
- [ ] **FIX:** Docker container runs as root (SEC-020)

### Logging and Monitoring
- [x] Sentry error tracking with profiling
- [x] Audit log middleware for auth actions
- [x] Scrape job logging with persistence
- [ ] **FIX:** Sentry debug route in production (SEC-012)
- [ ] **FIX:** Verbose Prisma logging in dev (SEC-018)

### Data Protection
- [x] Soft deletes for properties (deletedAt)
- [x] Property versioning (PropertyVersion records)
- [x] TLS for all external connections (CockroachDB sslmode=verify-full, Upstash rediss://)
- [ ] **FIX:** Search endpoints unauthenticated (SEC-011)
- [ ] **FIX:** Large avatarUrl without validation (SEC-016)
- [ ] **FIX:** Test email to arbitrary addresses (SEC-017)

---

## Priority Action Items

### Immediate (Do Today)
1. **SEC-001** — Rotate ALL production secrets. Remove .env from git history.
2. **SEC-003** — Set a strong, unique INTERNAL_API_KEY in all environments. Remove default.

### This Week
3. **SEC-002** — Delete env.controller.ts and env.routes.ts.
4. **SEC-004** — Move super-admin designation to env var or database.
5. **SEC-005** — Increase invite code entropy to 16+ bytes.
6. **SEC-007** — Add HTML sanitization to scraped data pipeline.
7. **SEC-008** — Disable Swagger docs in production.

### This Sprint
8. **SEC-006/015** — Lock down CORS in non-production environments.
9. **SEC-009** — Validate callbackUrl against allowlist.
10. **SEC-010** — Rate limit /auth/validate-invite.
11. **SEC-013** — Use timing-safe comparison for API keys.
12. **SEC-019** — Add CI dependency to CD pipeline.
13. **SEC-021** — Add npm audit / pip audit to CI.

### Backlog
14. **SEC-011** — Decide on search auth policy.
15. **SEC-012** — Guard Sentry debug route.
16. **SEC-014** — Strengthen password policy.
17. **SEC-016** — Fix avatar upload mechanism.
18. **SEC-017** — Restrict test email endpoint.
19. **SEC-020** — Non-root Docker user.
20. **SEC-022** — Fail hard on missing service role key.
