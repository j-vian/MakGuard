# MakGuard AI

> Malaysia's AI-powered scam shield. Detect threats before money leaves your account.

MakGuard is a mobile-responsive web application that uses AI to analyze suspicious
messages and verify recipient accounts before a transfer is authorized.

## Core Features
- **Passive Browser Extension** — Scans web pages in the background when suspicious patterns appear; alerts via badge + dismissible banner
- **Call Guard** — Listens during Google Meet / Microsoft Teams (web) calls and alerts on scam speech patterns (Chrome extension)
- **Scam Message Scanner** — Paste text or upload a screenshot for instant AI risk analysis
- **Transfer Shield** — Cross-check account numbers and phone numbers against a threat registry
- **Explainability Panel** — Understand exactly why a message was flagged
- **Community Reporting** — Submit scam numbers to protect other users instantly

## Browser Extension (Chrome / Edge)

The extension lives in the `extension/` folder and calls the deployed API at [makguard.vercel.app](https://makguard.vercel.app).

### Install (Chrome / Edge)

1. Download [makguard-extension.zip](https://makguard.vercel.app/makguard-extension.zip) from the landing page (or run `npm run pack:extension` locally)
2. Unzip the file
3. Open `chrome://extensions` (or `edge://extensions`) and enable **Developer mode**
4. Click **Load unpacked** and select the unzipped folder
5. Click the MakGuard toolbar icon and ensure protection is **ON**
6. After updates, click **Reload** on the MakGuard card in `chrome://extensions`

### Demo flow for judges

1. Landing page → download zip → Load unpacked (one-time)
2. Demo scam page → red urgent alert within ~3–5 seconds
3. Gmail → open a mock phishing email → same alert
4. `/dashboard` → manual scanner still works

### How passive scanning works

- Runs on **every website** plus **Gmail Web** (not native email apps)
- Content script extracts visible text and link URLs (never full HTML)
- Local heuristics skip safe pages — **no Gemini call unless suspicious**
- **Gmail inbox list** always gets a live AI scan (no result cache — inbox content changes too often)
- **Opened email threads** and static pages use a **30-minute in-memory session cache** only (not persisted); revisiting the same email shows the alert instantly with matching explanation
- Risk score ≥ 61 triggers a red urgent banner; lower scores update the badge only

### Call Guard (video calls)

- Works on **Google Meet** and **Microsoft Teams in Chrome** (web client only — not desktop apps)
- Click **Start listening** on the in-meeting panel (drag the panel by its header to move it)
- Captures **meeting tab audio** so the remote caller is heard even with headphones, plus mic speech-to-text
- Urgent phrases trigger scans in ~1–2s; tab audio is analyzed every ~4s via Gemini
- See [docs/CALL_GUARD_DEMO_SCRIPT.md](docs/CALL_GUARD_DEMO_SCRIPT.md) for the teammate “scammer” test script
- Dashboard **Call Guard** tab includes demo mode (paste script without a live call)

## Tech Stack
- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS, shadcn/ui
- **AI**: Google Gemini 2.5 Flash API
- **Database**: Supabase (Postgres)
- **Deployment**: Vercel

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy environment variables: `cp .env.example .env.local`
4. Fill in your API keys in `.env.local`
5. Run the development server: `npm run dev`
6. Open `http://localhost:3000` (landing page) or `http://localhost:3000/dashboard` (tools)

## Environment Variables
See `.env.example` for required keys.

## Project Docs
- [Product Requirements](docs/PRD.md)
- [Technical Specifications](docs/TECH_SPECS.md)
- [48-Hour Roadmap](docs/ROADMAP.md)
- [Style Guide](docs/STYLE_GUIDE.md)

## Team
Built for HackathonX FinTech Forward 2026 — Track 1: Reimagine Money