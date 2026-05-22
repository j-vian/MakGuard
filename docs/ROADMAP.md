# Project Roadmap & Milestones (48-Hour Block Strategy)

## Operational Phases

### Phase 1: Groundwork & Environment Setup (Hours 0 - 12)
- Initialize Next.js environment repository and connect Vercel tracking.
- Set up Supabase workspace tables and generate mock PDRM/NSRC data sheets.
- Establish baseline shadcn/ui component configurations.

### Phase 2: Intelligence Layer & Input Forms (Hours 12 - 24)
- Member A: Build message input form and screenshot upload UI component (this must be done first — blocks Phase 3).
- Member B: Construct Next.js API routes connecting to Gemini 2.0 Flash SDK.
- Member B: Solidify system prompt engineering to guarantee predictable JSON output structure.
- Member C: Seed Supabase with realistic PDRM/NSRC mock scam data (phone numbers, account numbers, URLs).
- Milestone gate: API route returns valid JSON risk score before moving to Phase 3.

### Phase 3: Core Feature Assembly & UI Integration (Hours 24 - 36)
- Build out the **Transfer Shield** search panel and interactive dashboard elements.
- Connect frontend components directly to live Supabase database states.
- Refine the mobile view UI components to ensure an flawless presentation layer.

### Phase 4: Production Deployment & Demo Verification (Hours 36 - 48)
- Complete deployment builds to Vercel and verify live production endpoints.
- Seed database with realistic scenario numbers matching pitch deck scripts.
- Execute end-to-end user path testing to eliminate demo-day code failures.

## Critical Task Dependencies
- Gemini 2.5 Flash JSON parsing structures must be stable before finalizing the visual dashboard components.
- Supabase table access keys must be integrated into the Vercel project layout prior to final deployment validation.
