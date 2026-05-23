## Plan: ScamGuard AI Web App

Build ScamGuard AI inside the existing Next.js workspace, preserving the current MakGuard pages and adding a new ScamGuard flow with internal screen states. Use a server-proxied Google STT path, Gemini for scam analysis, Web Audio API for voice masking, localStorage for settings/history, and a demo simulation mode that feeds transcript text when mic/API access is unavailable.

**Steps**
1. Add a new ScamGuard entry surface while preserving current MakGuard pages; introduce a dedicated route/component shell for the new experience and keep existing navigation intact.
2. Refactor the scan API/schema to the required scam-call shape `{ score, flags, recommendation }`; update [lib/gemini.ts](c:\Users\chaic\OneDrive\Desktop\finHack 2026\MakGuard\lib\gemini.ts), [app/api/scan/route.ts](c:\Users\chaic\OneDrive\Desktop\finHack 2026\MakGuard\app\api\scan\route.ts), and [lib/types.ts](c:\Users\chaic\OneDrive\Desktop\finHack 2026\MakGuard\lib\types.ts). *depends on step 1*
3. Build the ScamGuard home/monitor UI in a single client surface with internal view switching: Home, Call Monitor, Alert, Safe Result, History, and Settings. *depends on step 1*
4. Implement server-proxied Google STT chunk processing for live transcription; keep browser mic capture in the client, but send audio chunks to a Next.js route instead of exposing keys in the browser. *depends on step 3*
5. Implement live scam detection polling against `/api/scan` every 5 seconds using the running transcript, with risk meter updates, flags, and recommendation text. *depends on step 2 and 4*
6. Add Alert and Safe Result states with full-screen high-contrast treatment, copyable alert text, optional vibration, and verified-caller display logic. *parallel with step 5*
7. Add Voice Masking using Web Audio API, auto-activating in the mid-risk band and disabling on call end. *parallel with step 5*
8. Add elderly protection settings and localStorage-backed history, including guardian details and timestamped scam attempts. *parallel with step 3*
9. Add demo simulation flows for scam and safe calls so the app can be judged without microphone permission and without waiting for live speech input. *depends on step 3*
10. Apply visual requirements: dark theme, max-width 420px mobile layout, Sora and JetBrains Mono typography, circular risk meter, rolling transcript with cursor, and bilingual English/Bahasa Malaysia copy.

**Relevant files**
- [app/page.tsx](c:\Users\chaic\OneDrive\Desktop\finHack 2026\MakGuard\app\page.tsx) — main ScamGuard shell and internal view switching
- [app/layout.tsx](c:\Users\chaic\OneDrive\Desktop\finHack 2026\MakGuard\app\layout.tsx) — metadata, fonts, and page framing
- [app/globals.css](c:\Users\chaic\OneDrive\Desktop\finHack 2026\MakGuard\app\globals.css) — theme variables, fonts, risk meter styles
- [app/api/scan/route.ts](c:\Users\chaic\OneDrive\Desktop\finHack 2026\MakGuard\app\api\scan\route.ts) — scam detection endpoint
- [lib/gemini.ts](c:\Users\chaic\OneDrive\Desktop\finHack 2026\MakGuard\lib\gemini.ts) — Gemini model/schema configuration
- [lib/types.ts](c:\Users\chaic\OneDrive\Desktop\finHack 2026\MakGuard\lib\types.ts) — shared response types
- [app/shield/page.tsx](c:\Users\chaic\OneDrive\Desktop\finHack 2026\MakGuard\app\shield\page.tsx) — preserve existing shield page while integrating navigation
- [components/BottomNav.tsx](c:\Users\chaic\OneDrive\Desktop\finHack 2026\MakGuard\components\BottomNav.tsx) — update or preserve navigation as needed

**Verification**
1. Confirm the app builds and the new ScamGuard surface loads without breaking the existing MakGuard pages.
2. Verify a sample transcript produces the new `{ score, flags, recommendation }` response shape and updates the risk meter correctly.
3. Validate demo mode end-to-end without microphone permission and verify alert/safe transitions.
4. Check localStorage persistence for settings and history, and confirm verified numbers show the green safe state without claiming 100% safety.
5. Test mobile layout at 420px and ensure bilingual labels render cleanly.

**Decisions**
- Keep the existing Next.js workspace and preserve the current pages instead of starting a separate Vite app.
- Use a server-proxied Google STT flow rather than exposing the STT key directly in the browser.
- Keep the ScamGuard experience self-contained, but not at the expense of breaking the current MakGuard screens.

**Further Considerations**
1. The exact proxy shape for Google STT needs to be defined before implementation so chunking, base64 encoding, and auth are consistent.
2. If the user wants a fully browser-only demo fallback, the app should retain a simulated transcript mode as a no-key safety net.
