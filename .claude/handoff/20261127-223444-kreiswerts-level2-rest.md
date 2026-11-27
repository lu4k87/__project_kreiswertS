[Claude] [KreiswertS] Finish Level 2: contract, simulated payment, factors
Rückmeldung an: mk-dev-bb

Context: Repo ~/mk_dev/__project_kreiswertS (branch main, commit 262ece0). Level 1 and Level 2 parts 1–3 are built (docs/FEATURES.md). "Level 2: not built" lists: signed payments and integrated payment, contract execution, sourced emission factors, combined chain benefit of both sites. User decision 2026-11-27: build all of it. No real payment provider (Stripe, Mollie, PayPal …): payment is simulated, but built technically like a real app. It is a prototype first.

Task:
1. Contract: from an agreed negotiation / its exchange create a contract from the accepted revision (immutable snapshot); both sites confirm ("sign", who + when recorded); status flow in src/server/domain/status.ts with tests; pages + API following src/app/api/offers/route.ts (route → viewer → Zod → DAL → Drizzle).
2. Simulated payment per exchange: amount from the accepted terms (price, VAT basis, freight share); states pending → authorised → captured / failed / refunded; a PaymentProvider interface with a SimulatedProvider adapter (a real provider can be plugged in later); idempotency key on create/capture; provider confirmation endpoint protected (signature check even when simulated); audit trail; every place in the UI labelled "simulated" (DE/EN).
3. Sourced emission factors: factors carry source, version, geography, boundary; use only real, verifiable public sources – never invent numbers; a factor without a reliable public value stays marked as example; results lose the "illustrative" label only when every factor used is sourced.
4. Combined chain benefit of both sites: only from inputs both sites released (explicit consent), shown on /impact and on the negotiation.

Files: docs/FEATURES.md (add the rows first), src/server/domain/status.ts, src/server/db/schema.ts, src/server/dal/, src/server/validation/, src/app/api/my/…, src/app/(platform)/exchanges, negotiations, impact, src/i18n/level2.ts, scripts/e2e-level2.mjs, docs/FRONTEND.md §10, docs/architecture* (python3 scripts/architecture/make.py) + online copy web_kreiswerts (project memory "dev-team-page-always-current").

Beachten: AGENTS.md §0 + §5 – own test instance on its own port with the kreiswerts_e2e DB, never port 3000 or the working DB; every API change end-to-end; payment and contract routes are security-critical → security-reviewer (model opus) before the commit; new UI uses the tokens, Section, prose-justify. The parallel chat kreiswerts-ui-dark changes globals.css and shared components – check git status + ListAgents before touching shared files.
