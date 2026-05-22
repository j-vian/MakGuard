# MakGuard AI

> Malaysia's AI-powered scam shield. Detect threats before money leaves your account.

MakGuard is a mobile-responsive web application that uses AI to analyze suspicious
messages and verify recipient accounts before a transfer is authorized.

## Core Features
- **Scam Message Scanner** — Paste text or upload a screenshot for instant AI risk analysis
- **Transfer Shield** — Cross-check account numbers and phone numbers against a threat registry
- **Explainability Panel** — Understand exactly why a message was flagged
- **Community Reporting** — Submit scam numbers to protect other users instantly

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
6. Open `http://localhost:3000`

## Environment Variables
See `.env.example` for required keys.

## Project Docs
- [Product Requirements](docs/PRD.md)
- [Technical Specifications](docs/TECH_SPECS.md)
- [48-Hour Roadmap](docs/ROADMAP.md)
- [Style Guide](docs/STYLE_GUIDE.md)

## Team
Built for HackathonX FinTech Forward 2026 — Track 1: Reimagine Money