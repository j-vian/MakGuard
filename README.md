# MakGuard AI

> Malaysia's AI-powered scam shield — detect financial fraud before money leaves your account.

**Hackathon X FinTech Forward 2026** · Theme: *Future of Money: Reimagine Finance with AI* · **Track 1: Reimagine Money**

**Live demo:** [makguard.vercel.app](https://makguard.vercel.app)

---

## Problem & Solution

**Problem:** Thousands of Malaysians lose money to digital scams every year — phishing links, fake bank SMS, urgency-driven WhatsApp messages, and phone scams during video calls. Traditional banking defences often react *after* a transfer is completed.

**Solution:** MakGuard is a proactive AI scam shield with two layers:
1. **Passive browser extension** — watches web pages and Gmail in the background and alerts users before they click or transfer.
2. **Cyber Defense Terminal (web dashboard)** — manual scanner, transfer shield registry, community reporting, and Call Guard demo tools.

**Target users:** Malaysian digital banking consumers, especially students and elderly users, plus family members who act as a first line of defence for relatives.

---

## Technology Used

| Layer | Stack |
|-------|-------|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| **Browser extension** | Chrome Manifest V3 (JavaScript) — Chrome / Edge |
| **Backend / API** | Next.js Route Handlers (`/app/api/*`) |
| **AI** | Google Gemini 2.5 Flash (`@google/generative-ai`) |
| **Database** | Supabase (PostgreSQL) + Supabase Storage (evidence images) |
| **Hosting** | Vercel (production deployment linked to GitHub) |

---

## How the System Is Built

### Architecture overview

```
User (browser)
    │
    ├── MakGuard Chrome Extension
    │       ├── content.js      → extracts visible text + URLs from any page
    │       ├── background.js   → heuristics, throttling, API calls
    │       ├── call-guard.js   → Meet / Teams in-call panel + speech capture
    │       └── popup.html      → toggle protection on/off
    │
    └── Next.js Web App (makguard.vercel.app)
            ├── /               → landing page + extension download
            ├── /dashboard      → scanner, Call Guard demo, transfer shield, reporting
            └── /app/api/*      → server-side Gemini + Supabase (keys never exposed to client)
                    ├── POST /api/scan      → text, screenshot, Call Guard audio/transcript
                    ├── POST /api/shield    → verify phone / account / URL against registry
                    ├── POST /api/report    → submit community scam reports
                    └── POST /api/report/evidence → upload evidence screenshots
```

### Key design decisions

- **All third-party API keys stay server-side.** The extension and client components only call internal `/api/*` routes.
- **Cost-aware scanning.** Local heuristics run first; Gemini is called only when content looks suspicious (except Gmail inbox, which always gets a live scan).
- **Structured AI output.** Gemini returns JSON with `risk_score`, `threat_tags`, and a user-facing `explanation` — parsed and validated before display.
- **Community threat registry.** Supabase `scam_reports` table stores seeded PDRM/NSRC demo data plus live community submissions.

### Repository structure

```
makguard/
├── app/                  # Next.js pages and API routes
│   ├── page.tsx          # Landing page
│   ├── dashboard/        # Cyber Defense Terminal (all main tools)
│   └── api/              # Server-side API handlers
├── components/ui/        # shadcn/ui components
├── docs/                 # PRD, tech specs, Call Guard demo script
├── extension/            # Chrome extension source (load unpacked or zip)
├── lib/                  # Gemini client, Supabase clients, scan logic, types
├── public/
│   ├── demo/scam.html    # Demo scam page for passive extension testing
│   └── makguard-extension.zip
├── scripts/              # Extension pack script (runs on prebuild)
└── supabase/             # SQL setup for evidence storage
```

### Database schema

**Table: `scam_reports`**

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `target_value` | text | Phone number, bank account, or URL |
| `value_type` | text | `phone` · `account` · `url` |
| `threat_type` | text | e.g. `bank_impersonation`, `phishing` |
| `report_count` | integer | Times reported |
| `source` | text | `pdrm_seed` · `nsrc_seed` · `community_report` |
| `reporter_notes` | text | Optional notes from reporter |
| `evidence_url` | text | Public URL to uploaded screenshot (optional) |

Run `supabase/setup-evidence.sql` in the Supabase SQL Editor to enable evidence uploads.

---

## Core Features

| Feature | Description |
|---------|-------------|
| **Passive Browser Extension** | Scans web pages and Gmail Web in the background; shows badge + dismissible red banner when risk score ≥ 61 |
| **Call Guard** | Listens during Google Meet / Microsoft Teams (web) calls; alerts on scam speech patterns |
| **Scam Message Scanner** | Paste text or upload a screenshot for instant AI risk analysis with explainability |
| **Transfer Shield** | Browse and search a threat registry of reported phone numbers, accounts, and URLs |
| **Community Reporting** | Submit scam numbers with optional evidence screenshots to protect other users |

---

## Setup Steps

### Prerequisites

- Node.js 18+ and npm
- A [Google AI Studio](https://aistudio.google.com/) API key (Gemini)
- A [Supabase](https://supabase.com/) project with the `scam_reports` table seeded

### 1. Clone and install

```bash
git clone https://github.com/j-vian/MakGuard.git
cd MakGuard
npm install
```

### 2. Configure environment variables

Create `.env.local` in the project root:

```env
# Gemini
GEMINI_API_KEY=your_gemini_api_key

# Supabase (client — safe to expose in browser)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Supabase (server only — never expose to client)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Add the same variables to your Vercel project settings for production deployment.

### 3. Set up Supabase

1. Create the `scam_reports` table (see `docs/TECH_SPECS.md` for full schema).
2. Seed demo data (PDRM/NSRC mock accounts and phone numbers).
3. Run `supabase/setup-evidence.sql` in the Supabase SQL Editor to enable evidence image uploads.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the landing page, or [http://localhost:3000/dashboard](http://localhost:3000/dashboard) for the Cyber Defense Terminal.

> **Note:** Stop the dev server with `Ctrl+C` in the same terminal before restarting. If port 3000 is in use, run `taskkill /PID <pid> /F` (Windows) then start again.

### 5. Install the browser extension

1. Download [makguard-extension.zip](https://makguard.vercel.app/makguard-extension.zip) from the landing page, or run `npm run pack:extension` locally.
2. Unzip the file.
3. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge) and enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.
5. Click the MakGuard toolbar icon and ensure protection is **ON**.

### 6. Build for production

```bash
npm run build   # also packs extension zip via prebuild script
npm run start
```

---

## Demo Guide (for Judges)

### Quick demo flow (~5 minutes)

1. **Landing page** → download extension zip → Load unpacked (one-time setup).
2. **Passive scan** → visit [makguard.vercel.app/demo/scam.html](https://makguard.vercel.app/demo/scam.html) → red urgent alert within ~3–5 seconds.
3. **Gmail Web** → open a mock phishing email → same passive alert.
4. **Dashboard** → `/dashboard` → paste a scam message in the Scanner tab → see risk score + AI explanation.
5. **Transfer Shield** → search a pre-seeded scam phone number or account → confirm it appears in the registry.
6. **Community Report** → submit a test report → verify it appears in the shield registry.
7. **Call Guard** → join Google Meet or Teams in Chrome → click **Start listening** on the in-meeting panel → read the scammer script from [docs/CALL_GUARD_DEMO_SCRIPT.md](docs/CALL_GUARD_DEMO_SCRIPT.md).

### Call Guard notes

- Works on **Google Meet** and **Microsoft Teams web client** in Chrome (not desktop apps).
- Captures meeting tab audio so the remote caller is heard even with headphones.
- Dashboard **Call Guard** tab includes a demo mode (paste script without a live call).

---

## AI Tools Used

> Required by Hackathon X FinTech Forward 2026 judging guidelines. All team members can explain and walk through the code produced with these tools.

| Tool | How we used it |
|------|----------------|
| **Cursor AI** | Primary IDE assistant — code generation, refactoring, debugging, architecture planning |
| **Google Gemini 2.5 Flash** | Runtime AI engine — scam message analysis, screenshot OCR/classification, Call Guard transcript and audio analysis |
| **Claude** | Brainstorming for product direction, UX copy, demo scripts, and documentation drafts |

**Human oversight:** All AI-generated code was reviewed, tested, and modified by the team. API routes, extension logic, Supabase integration, and demo flows were validated end-to-end before submission.

---

## Open Source Libraries & Dependencies

| Package | Purpose |
|---------|---------|
| `next` | React framework with App Router and API routes |
| `react` / `react-dom` | UI rendering |
| `typescript` | Type safety across frontend and API |
| `tailwindcss` | Utility-first styling |
| `shadcn` / `@base-ui/react` | Accessible UI component primitives |
| `class-variance-authority`, `clsx`, `tailwind-merge` | Component styling utilities |
| `lucide-react` | Icons |
| `@google/generative-ai` | Gemini API SDK |
| `@supabase/supabase-js` | Supabase database and storage client |
| `sonner` | Toast notifications |
| `eslint` / `eslint-config-next` | Linting |

Full dependency list with versions: see `package.json`.

---

## Project Documentation

- [Product Requirements (PRD)](docs/PRD.md)
- [Technical Specifications](docs/TECH_SPECS.md)
- [Call Guard Demo Script](docs/CALL_GUARD_DEMO_SCRIPT.md)

---

## Team

Built for **Hackathon X FinTech Forward 2026** — Track 1: Reimagine Money.

| Name | Role |
|------|------|
| **John Vianney Albert** | Lead Developer & Project Lead — planning, PRD, tech specs, roadmap, and style guide; full-stack development (Next.js, React, API routes, Chrome extension); project setup, API integration (Gemini, Supabase), and production deployment on Vercel |
| **Chai Chuan Yi** | Product & Design Advisor — expert review and brainstorming on system gaps and improvements; Figma prototype and presentation slides |
| **John Benedict Albert** | Frontend Advisor — UX/UI guidance, system redesign ideas, and layout direction for the web app and dashboard |
