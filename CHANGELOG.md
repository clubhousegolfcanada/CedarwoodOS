# CedarwoodOS Changelog

## 2026-03-11 — v0.1.0 — Phase 1 Strip (In Progress)

### Backend — Third-Party Integrations Removed
- Removed TrackMan integration (route, service, knowledge base)
- Removed OpenPhone/SMS integration (3 routes, service, utils, tests, docs, scripts)
- Removed HubSpot CRM integration (route, webhook, 2 services, test)
- Removed UniFi door access (2 routes, 9 services, 32 scripts, docs, config)
- Removed NinjaOne remote management (3 routes, service, config, script)
- Removed Gmail receipt scanning (route, service, job)
- Removed call-transcripts route
- Cleaned up index.ts imports and route registrations

### Backend — Booking & Gamification Removed
- Removed entire booking system (routes, services, types, jobs, SOPs, knowledge base, tests)
- Removed customer portal routes (customer, customerProfile, customerBookings)
- Removed gamification: challenges, leaderboard, seasons, badges, achievements, boxes, friends, profileStats
- Removed ClubCoin adjustments admin route
- Removed all gamification jobs (challengeExpiry, rankCalculation, seasonalReset, challengeAgreementProcessor, bookingRewards)
- Removed Pattern Learning System V3 services (deferred to Phase 2)
- Removed all golf-specific SOPs (booking, brand, emergency, tech)
- Removed HubSpot-dependent syncCustomerNames service

### Frontend — Golf-Specific Code Removed
- Removed booking page, customer portal pages, golf pages, ClubOS mascot pages
- Removed booking components (calendar, forms, multi-simulator, pricing, etc.)
- Removed customer components (dashboard, leaderboard, box opening, challenges, etc.)
- Removed achievements, OpenPhone, TierBadge, ChecklistSystem, OccupancyMap components
- Removed Pattern Learning System UI (10+ components)
- Removed booking hooks, services, types
- Removed UniFi/NinjaOne/Splashtop API files and configs
- Removed golf-specific utils and box-animations CSS

### Stats
- ~246 files deleted, ~89,500 lines removed (~23.9% of original codebase)

---

## 2026-03-11 — v0.0.1 — Initial Fork

- Forked from ClubOS v1 (commit b9f2b84)
- 1,569 files, 375,179 lines
- Clean git history initialized
- Phase 1 strip-and-clean begins
