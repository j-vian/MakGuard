# MakGuard AI

> Malaysia's AI-powered scam shield. Detect threats before money leaves your account.

MakGuard is a mobile-responsive web application that uses AI to analyze suspicious
messages and verify recipient accounts before a transfer is authorized.

## Core Features
- **Passive Browser Extension** — Scans web pages in the background when suspicious patterns appear; alerts via badge + dismissible banner
- **Scam Message Scanner** — Paste text or upload a screenshot for instant AI risk analysis
- **Transfer Shield** — Cross-check account numbers and phone numbers against a threat registry
- **Explainability Panel** — Understand exactly why a message was flagged
- **Community Reporting** — Submit scam numbers to protect other users instantly

## Browser Extension (Chrome / Edge)

The extension lives in the `extension/` folder and calls the deployed API at [makguard.vercel.app](https://makguard.vercel.app).

### Install (unpacked — hackathon demo)

1. Open `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `extension/` folder
4. Click the MakGuard toolbar icon and ensure protection is **ON**
5. After pulling extension updates, click **Reload** on the MakGuard card in `chrome://extensions`

### Demo flow for judges

1. Visit the landing page at `/` — install instructions and product intro
2. With the extension enabled, open [Demo scam page](https://makguard.vercel.app/demo/scam.html)
3. Within ~3 seconds, MakGuard should show a red badge and a dismissible scam alert banner
4. Open `/dashboard` to show the manual AI Threat Scanner still works for screenshots

### How passive scanning works

- Content script extracts visible page text and link URLs (never full HTML)
- Local heuristics filter out safe pages (bank names, urgency words, suspicious TLDs)
- If suspicious, sends truncated text to `POST /api/scan` with `source: "extension"`
- Results are cached per URL for 5 minutes to protect Gemini quota
- Risk score ≥ 61 triggers a non-blocking alert; lower scores update the badge only

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