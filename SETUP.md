# Setup Guide

## Environment Variables

All secrets go in `backend/.env`. Here's a template:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/realtors_practice"

# Supabase (Auth only)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Frontend URL (for email links, CORS)
FRONTEND_URL="http://localhost:3000"
CORS_ORIGIN="http://localhost:3000"

# Email (Resend)
RESEND_API_KEY="re_xxxxxxxxxxxx"
EMAIL_FROM="Realtors Practice <noreply@yourdomain.com>"

# Scraper
SCRAPER_URL="http://localhost:8000"
INTERNAL_API_KEY="your-internal-api-key"

# Redis (optional, for Celery job queue)
REDIS_URL=""

# Meilisearch
MEILISEARCH_URL="http://localhost:7700"
MEILISEARCH_MASTER_KEY=""
```

Frontend also needs `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL="http://localhost:5000/api"
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
```

---

## Google Sign-In Setup

Google Sign-In uses Supabase OAuth. You need to configure both Google Cloud Console and Supabase.

### Step 1: Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Navigate to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth client ID**
5. If prompted, configure the **OAuth consent screen** first:
   - User Type: External
   - App name: "Realtors' Practice"
   - User support email: your email
   - Authorized domains: add `supabase.co` and your production domain
   - Scopes: `.../auth/userinfo.email`, `.../auth/userinfo.profile`
6. Create the OAuth Client ID:
   - Application type: **Web application**
   - Name: "Realtors' Practice"
   - Authorized JavaScript origins:
     - `http://localhost:3000` (dev)
     - `https://realtors-practice-new.vercel.app` (prod)
   - Authorized redirect URIs:
     - `https://YOUR-SUPABASE-PROJECT.supabase.co/auth/v1/callback`
7. Copy the **Client ID** and **Client Secret**

### Step 2: Supabase Dashboard

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication > Providers**
4. Find **Google** and enable it
5. Paste the **Client ID** and **Client Secret** from Google Cloud Console
6. Set the **Redirect URL** (Supabase provides this — copy it back to Google Console if needed)
7. Save

### Step 3: Verify

- The login page already has Google Sign-In implemented
- The settings page has Google link/unlink functionality
- Test by clicking "Sign in with Google" on the login page

---

## Resend Email Setup

Resend is used for invitation emails and notifications.

### Step 1: Create Resend Account

1. Go to [resend.com](https://resend.com) and create an account
2. Navigate to **API Keys**
3. Create a new API key with "Sending access"
4. Copy the key (starts with `re_`)

### Step 2: Add Domain (for production)

1. In Resend, go to **Domains**
2. Add your domain (e.g., `realtorspractice.com`)
3. Add the DNS records Resend provides (SPF, DKIM, etc.)
4. Wait for verification

### Step 3: Configure

Add to `backend/.env`:
```env
RESEND_API_KEY="re_your_api_key_here"
EMAIL_FROM="Realtors Practice <noreply@yourdomain.com>"
```

> **Note:** During development without a verified domain, Resend only allows sending to the email you signed up with. For testing, use your own email as the recipient.

---

## Invite System

Admins can invite new users (including other admins) from Settings > Team Members:

1. Admin clicks "Invite User" and enters email + role
2. System generates a 6-character alphanumeric invite code
3. Invitation email is sent via Resend with the code
4. Invitee goes to `/admin-register`, enters the code
5. Code is validated (must match email, not expired, not used)
6. Invitee creates their account with their own password
7. Codes expire after 24 hours
