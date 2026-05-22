# Style & Environment Guide for Cursor IDE Alignment

## Coding Conventions
- **Language Standards**: Strict TypeScript typing. Avoid falling back on `any` definitions.
- **Architectural Flow**: Write small, modular client components (`use client`) inside `/src/components/ui/` rather than large, messy monolithic code blocks.
- **Variable Styling**: camelCase for functional values, PascalCase for structural React elements, and snake_case for Supabase columns.

## Targeted Cursor Prompting Instructions
- **Design Philosophy**: Default completely to clean, polished mobile layouts. Prioritize responsive Tailwind parameters (`sm:`, `md:`) to focus layout structures on smartphone viewports.
- **Development Constraint**: Adhere to a "no-over-engineering" rule. Utilize native Next.js capabilities and clean layout designs. Avoid building complex custom middleware abstractions.
- **Clean Execution Code**: Produce complete, drop-in codebase adjustments. Avoid writing code snippets with lazy placeholders like `// TODO: implement later`.
- **API Route Enforcement**: All Supabase queries and external API calls (Gemini, VirusTotal) must be made exclusively inside `/app/api/` server-side route handlers. Never call Supabase or third-party APIs directly from client components — this exposes secret keys in the browser bundle.
