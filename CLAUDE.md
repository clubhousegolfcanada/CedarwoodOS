# CedarwoodOS — Build Instructions

## What This Is

CedarwoodOS is a white-label business operations terminal forked from ClubOS (a golf simulator management platform). The goal is to strip all golf-specific code and branding, leaving a clean, universal business terminal that any contractor or business can use to manage operations, knowledge, documents, and team communication.

The first deployment target is Cedarwood Contracting.

## Architecture

- Frontend: Next.js on Vercel
- Backend: Express/TypeScript on Railway
- Database: PostgreSQL on Railway
- AI: Claude API (Anthropic) for terminal intelligence
- Messaging: Slack integration for team communication

This is a SEPARATE deployment from ClubOS. Separate Railway project, separate Vercel project, separate database, separate repo. ClubOS must not be affected by any changes here.

---

## Phase 1: Strip and Clean

### KEEP — these are the core product

**Frontend components:**
- Terminal component (search box, AI/Ticket/Human toggle, Process button)
- "+ Update" button and its form/modal (for adding knowledge to the database)
- Receipt/document upload component (rename to "Document Upload" if labeled golf-specific)
- Tickets page (full copy, works as-is)
- Messages page (Slack integration)
- Quick Links component (refactor to be configurable from a database table, not hardcoded)
- Auth/login flow and all auth pages
- Navigation shell (Home, Tickets, Messages, and a "More" menu)
- My Tasks component
- Database browser/editor (the interface that lets admins view and edit database records)

**Backend routes and services:**
- AI terminal route and service (query handler that reads from database and responds)
- Ticket CRUD routes and service
- Receipt/document upload route and processing logic (extraction, storage)
- Slack webhook integration (incoming and outgoing)
- Auth routes, JWT middleware, role-based access control
- Database browser/update routes (the + Update backend)
- User management routes

**Database tables (keep and migrate):**
- users and auth-related tables
- tickets and ticket-related tables
- receipts/documents table and related storage
- Any tables the terminal reads from for AI responses
- Slack configuration tables
- Role/permission tables

### REMOVE — golf-specific, not needed

**Frontend — delete these entirely:**
- Everything booking-related (Skedda integration, booking pages, scheduling UI, bay selection)
- TrackMan integration pages and components
- OpenPhone/SMS components and pages
- HubSpot CRM components and iframes
- UniFi door access controls and pages
- NinjaOne remote management pages
- ClubCoin/gamification system (points, rewards, currency UI)
- Dynamic pricing components
- Checklists page (unless it is generic enough to keep — use judgment)
- Any component that references golf, simulator, bay, course, or clubhouse specifically

**Backend — delete these entirely:**
- Booking routes and services
- TrackMan routes and services
- OpenPhone/SMS routes and services
- HubSpot routes and services
- UniFi routes and services
- NinjaOne routes and services
- ClubCoin/gamification routes and services
- Dynamic pricing routes and services
- Pattern Learning System (V3-PLS) — defer to Phase 2
- Any route that references golf, simulator, bay, course, or clubhouse specifically

**Database migrations:**
- Do NOT delete old migration files. Leave them in place for reference.
- Create NEW migrations that drop unused tables cleanly.
- Keep all auth, ticket, receipt/document, terminal, slack, and user tables.

### REBRAND

- Replace all instances of "ClubOS" with "CedarwoodOS" in UI text, page titles, meta tags, and comments.
- Replace all instances of "Clubhouse" or "Clubhouse 24/7" with "Cedarwood" in UI text.
- Replace the ClubOS logo/branding with placeholder text "CedarwoodOS" (no logo asset needed yet).
- Update terminal placeholder text from golf examples to contracting examples:
  - Old: "power outage, equipment frozen, booking cancellation"
  - New: "warranty claim process, material specs, safety protocols, vendor contacts"
- Update page title from "ClubOS - Golf Simulator Management" to "CedarwoodOS - Operations Terminal"
- Update any hardcoded color scheme if it references Clubhouse brand colors (keep the dark teal, it works universally).

---

## Phase 2: New Features (do NOT build yet, just be aware)

These come after Phase 1 is deployed and working:

- Quick Links admin table: allow the admin to add/edit/remove Quick Links through the UI instead of hardcoding them.
- Document intelligence: when a PDF or Word doc is uploaded, the system should extract text, auto-categorize it, and add it as searchable records in the knowledge base.
- Query logging: track what questions are asked and surface unanswered or low-confidence queries to the admin as knowledge gaps.
- Multi-tenant architecture: one deployment serving multiple businesses with data isolation.
- SMS integration (re-add OpenPhone or similar for businesses that want text-based queries).

---

## Environment Variables

Create a new `.env.example` with these (values TBD for the new Railway/Vercel deployment):

```
DATABASE_URL=
ANTHROPIC_API_KEY=
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=
JWT_SECRET=
NODE_ENV=production
PORT=3001
FRONTEND_URL=
```

Remove any env vars related to: OpenPhone, HubSpot, UniFi, NinjaOne, TrackMan, Skedda, Stripe (unless Stripe is needed for future billing).

---

## How to Work

1. Show your work. After each major deletion or change, commit with a descriptive message.
2. Keep a CHANGELOG.md. Log every significant change with the date.
3. After stripping is complete, run the build for both frontend and backend. Fix any import errors or broken references caused by deletions.
4. Test locally before deploying.
5. Do NOT guess at file contents or functionality. Read the file first, understand what it does, then decide keep or remove.

## Commit Message Format

```
strip: remove TrackMan integration routes and components
strip: remove booking system frontend pages
rebrand: replace ClubOS references with CedarwoodOS
fix: resolve broken imports after OpenPhone removal
feat: add quick_links database table
```

## Definition of Done (Phase 1)

- [ ] All golf-specific code removed
- [ ] All branding updated to CedarwoodOS
- [ ] Terminal works: can type a question and get an AI response from the database
- [ ] + Update works: can add knowledge through the UI
- [ ] Document upload works: can upload a PDF or Word doc
- [ ] Tickets page works: can create and view tickets
- [ ] Messages/Slack integration works
- [ ] Quick Links display (hardcoded is fine for now, configurable in Phase 2)
- [ ] Auth works: can log in with role-based access
- [ ] Frontend builds without errors
- [ ] Backend builds without errors
- [ ] CHANGELOG.md is up to date
- [ ] Ready to deploy to new Railway + Vercel project
