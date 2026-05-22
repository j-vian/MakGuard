# Product Requirements Document (PRD) - MakGuard AI

## Problem Statement
Every year, thousands of Malaysians fall victim to sophisticated digital financial scams (such as phishing links, fake banking SMS, and urgency-driven WhatsApp messages). Traditional banking defenses identify threats only *after* money has already left the account. MakGuard provides an active intercept point, breaking down scams in real time at the crucial moment right before a user authorizes an online transfer.

## Target Audience
- Digital banking consumers in Malaysia (vulnerable demographics like students and elderly citizens).
- Tech-savvy individuals acting as a structural shield for their extended families.

## User Stories
- **As a user receiving a suspicious message**, I want to paste the text or upload a screenshot so that the AI can instantly analyze structural patterns and provide an explainable risk evaluation.
- **As a user about to transfer money to a new recipient**, I want to enter their account or phone number so that the system can cross-check it against known threat registries before I authorize payment.
- **As a community member**, I want to quickly report a scam number or URL so that other users are instantly protected from that same threat source.

## Success Metrics
- End-to-end demo flow completes without errors: Scan Message → Risk Score → Transfer Shield → Threat Result.
- AI classification response latency under 3 seconds per request (measured from form submit to result display).
- Transfer Shield correctly flags 100% of pre-seeded scam accounts in the demo dataset.
- UI renders correctly on mobile viewport (375px width) with zero horizontal scroll or layout breaks.
- Community report submission persists to Supabase and reflects instantly in the threat database.

## Scope
### IN SCOPE (MVP Focus)
- Mobile-responsive web application built using Next.js 14 and Tailwind CSS.
- AI Scam Scanner powered by Gemini 2.5 Flash API to analyze behavioral pressure patterns and return a structured risk percentage.
- **Transfer Shield**: A verification form that queries a database populated with mock PDRM and NSRC scam accounts.
- Dynamic data persistence using Supabase for tracking real-time community scam reports.

### OUT OF SCOPE (Strictly Cut)
- Real-time phone call voice streaming or native microphone capture (too high-risk for 48 hours).
- Active production payment gateway or actual production bank core API integrations.
- Native iOS or Android mobile application builds.
