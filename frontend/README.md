# Frontend (Client Application)

This is the frontend application for the Realtors' Practice platform, built with modern web technologies to deliver a premium, luxury user experience.

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Framer Motion (Animations)
- **UI Components**: custom `shadcn/ui` + custom MapCN
- **Auth**: Supabase Auth
- **Maps**: `@mapcn/map` (built on MapLibre GL JS)
- **Speech-to-Text**: Web Speech API (with custom Nigerian phonetic dictionary overrides)

## 📁 Key Directories

- `app/`: Next.js App Router pages and layouts.
  - `(auth)/`: Login, registration, and onboarding flows.
  - `(dashboard)/`: The main application (Search, Properties, Scraper logs, Dashboard).
- `components/`: Reusable React components.
  - `property/`: Property cards, lists, detail views, and filters.
  - `search/`: The search bar, voice hooks, maps, and results overlays.
  - `ui/`: Core design system components.
- `hooks/`: Custom React hooks (e.g., `useSearch`, `useSpeechRecognition`).
- `lib/`: Utilities, constants, and API helpers.

## ⚙️ Environment Variables

Create a `.env.local` file in this directory based on the variables required to connect to the backend and Supabase:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SUPABASE_URL=https://<YOUR_SUPABASE_ID>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<YOUR_SUPABASE_ANON_KEY>
NEXT_PUBLIC_MAP_PROVIDER=osm
```

## 🤖 Jotform AI Widget
The frontend integrates a Jotform AI Chatbot via an embedded script. 
- Logged-in users' session data (hashed via backend) is passed to `window._jfAgentIdentifiedUser` to provide personalized AI responses.
- The sidebar location is specified to inject cleanly into the layout.

## 🏃‍♂️ Development

```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.
