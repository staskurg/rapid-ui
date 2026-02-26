# AI-Assisted Build Transcript — YC Spring 2026

This markdown file documents how I used AI tools (ChatGPT and Cursor) to plan, design, validate, and ship **RapidUI** — an AI-native developer tool — across three MVP iterations, demo prep, and database migration over ~4 weeks.

**Goal**: Show how I work with AI as a structured engineering collaborator for architecture, reliability, testing, and execution planning — not as a code autocomplete tool.

---

## How to Read This Transcript

| Section | Content |
|---------|---------|
| **Part 1** | GPT persona — how I structured AI as a YC-style execution partner |
| **Part 2** | MVP v1 blueprint — JSON paste → instant admin UI |
| **Part 3** | Testing & evaluation strategy — guardrails for AI reliability |
| **Part 4** | MVP v1 implementation plan — execution roadmap |
| **Part 5** | MVP v2 blueprint — API → one-click live admin UI |
| **Part 6** | MVP v2 implementation — adapter layer, demo API, external preview |
| **Part 7** | MVP v3 blueprint — OpenAPI compiler pipeline |
| **Part 8** | MVP v3 implementation — deterministic compiler, LLM evals, generated UI |
| **Part 9** | Demo prep — account-based compiler UI, spec diffs, demo specs |
| **Part 10** | Postgres storage migration — production persistence |
| **Outcome** | Shipped system summary |

**Provenance**: Sections labeled `[AI OUTPUT]` are copied directly from ChatGPT or Cursor. `[MY NOTES]` provide minimal context. Raw session exports available on request.

---

## Skim Guide — Key Signals

- **AI persona** → scope discipline, rapid iteration, demo reliability
- **MVP blueprints** → architecture + non-goals to prevent scope creep
- **Testing strategy** → demo-critical boundaries, AI eval harness
- **Implementation plans** → phased checkpoints, Cursor-assisted execution
- **MVP v3** → OpenAPI as source of truth, deterministic pipeline, LLM as constrained classifier
- **Demo prep** → account-based specs, multi-resource diffs, demo-ready UX
- **Postgres** → production persistence, no in-memory fallback

---

## Part 1 — Establishing the AI Advisor Persona

[AI OUTPUT]

I configured ChatGPT to behave like a YC-style execution partner before any design work. This persona became the foundation for all subsequent conversations.

### GPT Persona

You are acting as a senior Y Combinator-style startup partner advising a technical founder (software engineer) during a 72-hour sprint to design and prototype an AI-native startup.

Assume the founder is capable of building production-quality MVPs quickly using modern tools, APIs, and AI frameworks.

**Your personality and behavior:**

- Think like a top Silicon Valley investor/operator working with technical founders
- Prioritize execution speed and high-leverage engineering decisions
- Be direct, analytical, and pragmatic — no fluff
- Push toward building, testing, and shipping
- Challenge weak assumptions or overengineering
- Focus on ideas that exploit AI/LLM capabilities in a way that feels native, not bolted on
- Optimize for demo-able, impressive prototypes achievable in days

**Your goals:**

1. Identify high-potential AI-native problem spaces
2. Pressure-test startup ideas quickly
3. Guide toward a simple but compelling MVP
4. Suggest realistic system architecture
5. Recommend tools, APIs, and implementation shortcuts
6. Identify risks, scope traps, and time sinks
7. Keep the founder focused on what ships in 72 hours

**Interaction style:**

- Ask sharp clarifying questions
- Break problems into executable steps
- Suggest architecture patterns and tradeoffs
- Think in terms of rapid experiments and iteration
- Encourage scrappy builds over perfect systems
- Call out distraction or unnecessary complexity

**Optimization priorities:**

→ Maximum meaningful progress in 72 hours  
→ AI-first product design  
→ MVPs that demonstrate technical leverage  
→ Fast validation and demo impact  

**Do not behave like a generic assistant — behave like an experienced YC advisor pushing a technical founder to build an AI-native startup prototype fast.**

**Start by asking:**

"What AI-native problem feels urgent or exciting to you right now, and what advantage do you have in tackling it?"

[MY NOTES]

This persona ensured every design decision was pressure-tested, every feature evaluated for demo impact, and every architectural choice prioritized speed and leverage. I used it with ChatGPT for ideation and blueprint creation; Cursor for implementation.

---

## Part 2 — MVP v1 Blueprint (ChatGPT)

[AI OUTPUT]

This blueprint defined the product architecture, constraints, and demo scope for the first 72-hour sprint.

### AI-Native Developer Tool — Schema → Instant Admin UI (MVP Blueprint)

**Core Idea**

Build an AI-powered developer tool that turns backend data structures into a working internal admin interface instantly. The tool acts like a lightweight frontend companion for backend/full-stack engineers who want usable CRUD UIs without writing frontend code.

**Problem**

Backend and full-stack engineers frequently need internal dashboards to inspect and manage data. Building these UIs requires repetitive frontend work — tables, forms, validation, layout — which is time-consuming and low leverage. Existing solutions are either heavy platforms or vibe-coded prototypes that aren't reliable.

**Value Proposition**

Paste backend data → instantly get a usable admin UI.

**Architecture**

```
backend data → AI reasoning → validated UI spec → renderer → UI
```

AI output is schema-constrained and validated before rendering. Never render unvalidated output.

**Non-Goals** (to prevent scope explosion)

- No frontend framework platform
- No routing system
- No styling engine
- No plugin architecture
- No persistence layer
- No schema sync engine
- No complex callbacks

**Tech Stack**

- Framework → Next.js (App Router)
- UI → shadcn/ui + Tailwind
- Table → TanStack Table
- Forms → React Hook Form
- Validation → Zod
- AI → OpenAI SDK via API route
- Deploy → Vercel

**UI Spec Contract**

```json
{
  "entity": "string",
  "fields": [{ "name", "label", "type", "required", "options?" }],
  "table": { "columns": [] },
  "form": { "fields": [] },
  "filters": []
}
```

Field types: `string | number | boolean | enum`. Deterministic rendering. CRUD semantics only.

**Execution Plan**

1. Phase 1 — Renderer Foundation: Hardcoded spec → working CRUD UI
2. Phase 2 — Payload Inference: JSON → deterministic spec
3. Phase 3 — AI Integration: Prompt → validation → fallback
4. Phase 4 — UX Polish: Intent + regenerate flow
5. Phase 5 — Stabilization: Edge cases + demo rehearsal

[MY NOTES]

This blueprint provided the complete product vision and technical architecture. Clear non-goals prevented scope creep. The deterministic pipeline ensured demo reliability.

---

## Part 3 — Testing & Evaluation Strategy (ChatGPT + Cursor)

[AI OUTPUT]

Before implementation, I used AI to design a lightweight reliability framework focused on protecting demo-critical boundaries.

### MVP Testing Strategy — AI CRUD Admin UI

**Philosophy**

Test what could break the demo. Not exhaustive coverage, but high-leverage reliability.

**Testing Layers**

| Tier | Focus | Why |
|------|-------|-----|
| **Tier 1** | Schema validation, inference logic, fallback generator | Schema failure = renderer crash |
| **Tier 2** | Renderer state transitions (create/edit/delete/filter) | State integrity, not visuals |
| **Tier 3** | AI output contract (fixture → AI → validate with Zod) | AI cannot break rendering |

**What We Skip**

- Visual regression tests
- End-to-end browser automation
- Snapshot-heavy UI testing
- AI benchmarking suites

**AI Eval Harness**

- Multi-run loop per fixture (5–10 runs)
- Structural validity: valid specs / total runs (target ≥90%)
- Stability: structural consistency across runs
- Failure replay: save failing responses for regression
- Command: `npm run eval:ai`

**AI Response Evaluation Strategy (excerpt)**

> We do not test model intelligence. We test: AI output validity + schema contract compliance. Strategy: Fixture payload → AI → UISpec → validate with Zod. Pass condition: Valid UISpec produced. Logical constraints satisfied: Table has columns, form fields exist, enum fields contain options. Stability Strategy: Use recorded fixtures for stable automated testing. Replay fixtures during automated tests (fast, stable). Allow retry logic for live AI tests (optional, slower). Goal: Ensure AI cannot break rendering.

**Evaluation Harness Architecture**

```
eval/
  eval-ai.ts
  fixtures/     # simple-user.json, enum-heavy.json, weird.json, etc.
  reports/
  utils/        # validator, comparator, reporter, ai-generator
```

**Test Stack**: Vitest + React Testing Library + Jest DOM matchers

[MY NOTES]

These documents established the testing philosophy: protect demo-critical boundaries with deterministic tests, measure AI output stability with a dedicated harness. Reliability without sacrificing velocity.

---

## Part 4 — MVP v1 Implementation Plan (Cursor)

[AI OUTPUT]

This plan became the execution roadmap. Cursor assisted with implementation across all phases.

### AI Admin UI Implementation Plan

**Current State (post-MVP v1)**

- ✅ Phase 1: Schema & Types — Zod schema, TypeScript types, sample spec
- ✅ Phase 2: Renderer Components — AdminRenderer, DataTable, FormModal, FiltersPanel
- ✅ Phase 3: Payload Inference — parsePayload, generateSpec, fallback generator
- ✅ Phase 3.5: Reliability Guardrails — 71 tests passing (schema, inference, fallback, renderer, AI contract)
- ✅ Phase 4: AI Integration — OpenAI API, retry logic, fallback on failure
- ✅ Phase 4.5: AI Evaluation Harness — multi-run determinism testing, reports
- ✅ Phase 5: UX Polish — hero section, toasts, error boundary, example system
- ✅ Phase 6: Edge Cases — empty payloads, malformed JSON, documentation

**Key Implementation Details**

| Component | Implementation |
|-----------|----------------|
| **API Route** | `POST /api/generate-ui` — payload, optional intent, Zod validation, retry, fallback |
| **Fallback** | Deterministic parser when AI fails; always returns valid UISpec |
| **Tests** | 71 tests in ~1.25s; fixture-based AI eval for stability |
| **Demo Flow** | Paste JSON → Generate with AI → CRUD interface appears |

**Prompt Template (AI-shaped, from lib/ai/prompt.ts)**

System prompt instructs the model to output JSON matching UISpec schema. Key constraints in prompt:

- Field types: string | number | boolean | enum (enum MUST include options array)
- All table/form/filter references must exist in fields
- Examples included for simple user, enum-heavy, nested payloads
- Request: JSON-only response, no markdown

User prompt: `{ payload, intent?, existingSpec? }` — intent influences which fields to show/hide.

**Checkpoint Strategy**

Each phase had a checkpoint. No phase advanced until the previous passed. Testing integrated after AI (Phase 3.5) to protect demo boundaries.

[MY NOTES]

Cursor helped implement schema validation, component structure, inference logic, and test scaffolding. The phased approach with checkpoints maintained quality while moving fast.

---

## Part 5 — MVP v2 Blueprint (ChatGPT + Cursor)

[AI OUTPUT]

After shipping MVP v1, I evolved the product based on user feedback and a clearer vision. This blueprint defined the next iteration.

### AI-Native Developer Tool — API → One-Click Live Admin UI (MVP v2 Blueprint)

**Core Idea**

Evolve RapidUI from "JSON → admin UI (in-memory CRUD)" into a **one-click internal dashboard generator** that connects to a **real API** (demo API first, external APIs in preview mode), generates a deterministic admin UI spec, and renders a **live CRUD dashboard** backed by that API.

**What's New vs v1**

| Aspect | v1 | v2 |
|--------|-----|-----|
| Data source | Pasted JSON | Demo API (primary) or External API |
| CRUD | Local state | API calls via adapter |
| Schemas | Single | Versioned (v1/v2/v3) per resource |
| Regeneration | Re-parse | Change API version → click Generate → UI updates |

**Value Proposition**

**One click → working CRUD dashboard from a live API.**

- No frontend code
- Deterministic renderer
- AI-assisted spec generation with validation + fallback
- Real API-backed CRUD demo

**Architecture**

```
API → sample payload → AI + fallback → validated spec → renderer → adapter CRUD
```

**Components**

- **Demo API Server**: In-memory store, session-scoped, versioned seeds (v1/v2/v3)
- **Proxy Fetcher**: Server-side external fetch, JSON validation, SSRF protection
- **API Adapter Layer**: Unified CrudAdapter interface with capability flags (read/create/update/delete)
- **Admin Renderer**: Uses adapter for CRUD instead of local state

**Non-Goals**

- Auth / billing / analytics
- Teams/workspaces
- Schema diff engines
- Persisted UI overrides
- Multi-entity dashboards

**Success Criteria**

- One-click live CRUD dashboard
- Version regen updates UI
- External preview works read-only
- Demo usable in under 2 minutes

[MY NOTES]

MVP v2 addressed the main limitation of v1: data lived only in memory. The adapter pattern allowed the same renderer to work with demo API, external API, or pasted JSON.

---

## Part 6 — MVP v2 Implementation Plan (Cursor)

[AI OUTPUT]

Cursor assisted with the full implementation of the API-backed architecture.

### API-Backed Admin UI — Main Implementation Plan

**Phases Completed**

| Phase | Goal | Status |
|-------|------|--------|
| **Phase 1** | Demo store + CRUD routes + session isolation | ✅ |
| **Phase 2** | Adapter layer + AdminRenderer integration | ✅ |
| **Phase 3** | Connect screen + generate/regenerate pipeline | ✅ |
| **Phase 3.5** | Version/prompt change notification (diff toast) | ✅ |
| **Phase 3.75** | CRUD UI polish (loaders, delete confirm, getById) | ✅ |
| **Phase 4** | External API preview (proxy, read-only) | ✅ |
| **Phase 5** | Polish, testing, documentation | ✅ |

**Key Design Decisions**

1. **Single page**: Connect and dashboard on one page. No `/dashboard` route.
2. **Session**: sessionId in React state only. Reload = fresh start. No localStorage.
3. **Three tabs**: Demo API | External API | Paste JSON
4. **CrudAdapter interface**: `getSample()`, `list()`, `create?`, `update?`, `remove?`, `getById?`
5. **idField**: Explicit in UISpec (default `"id"`). Resource registry defines per resource.
6. **External API**: Read-only. Proxy with URL validation, 10s timeout, 30 req/min. dataPath for wrapped responses.

**Adapter Flow**

```
User selects resource + version → Generate → adapter.getSample() → generate-ui → spec
Renderer uses adapter.list() for table; adapter.create/update/remove for CRUD
```

**Demo Datasets**

Users, Products, Tasks, Orders, Blog, Inventory, Nested — each with v1/v2/v3 evolution.

**OpenAI Metrics** (Phase 1 enhancement)

- `lib/ai/metrics.ts` — recordOpenAICall with OTel-style attributes
- Console sink (dev: pretty, prod: compact JSON)
- Tracked: latency, tokens, model, source (api/eval), success/failure

**Version/Prompt Change Notification (Phase 3.5 — Cursor output)**

When to show diff toast:

| Scenario | Show diff? |
|----------|------------|
| First generation | No |
| Resource switch (Users → Products) | No |
| Paste ↔ Demo ↔ External switch | No |
| Same resource, version change + Generate | Yes |
| Same resource, prompt added + Generate | Yes |
| Fallback spec | No — simple toast |

What to diff: Entity name, fields added/removed/changed, table columns, form fields, filters, idField. Format: GitHub-style (+ green, - red). Toast stays until user dismisses.

**CrudAdapter Interface (from plan)**

```ts
interface CrudAdapter {
  mode: "demo" | "external";
  capabilities: { read: true; create: boolean; update: boolean; delete: boolean };
  getSample(): Promise<any>;
  list(): Promise<any[]>;
  create?(input: any): Promise<any>;
  update?(id: string, input: any): Promise<any>;
  remove?(id: string): Promise<void>;
  getById?(id: string | number): Promise<Record<string, unknown>>;
}
```

External adapter: read-only. Create/Update/Delete hidden. "Read-only preview" banner.

[MY NOTES]

Cursor helped implement the adapter layer, demo store, proxy API, connect components, spec diff for version change toasts, and CRUD polish (delete confirmation, submit loaders). The phased plan with checkpoints carried over from v1.

---

## Part 7 — MVP v3 Blueprint (Cursor)

[AI OUTPUT]

After MVP v2, I evolved RapidUI into an **OpenAPI compiler** — treating OpenAPI as the source of truth instead of sample payloads. This blueprint defined the deterministic pipeline architecture.

### AI-Native Developer Tool — OpenAPI → Deterministic Admin UI (MVP v3 Blueprint)

**Core Idea**

Evolve RapidUI from "JSON payload → AI → UISpec" into a **deterministic OpenAPI compiler** that treats OpenAPI as the source of truth. The main page becomes a **compiler UI**: drag-and-drop upload, progress panel, output spec. The generated UI lives at `/u/{id}/{resource}` with sidebar nav — like a real internal admin dashboard.

**Key Invariants**

- Same OpenAPI → same UISpec → same UI
- Unsupported constructs → hard compile errors (no guessing)
- Renderer remains unchanged; lowering produces UISpec compatible with existing SchemaRenderer

**Current State vs Target**

| Aspect | MVP v2 | MVP v3 |
|--------|--------|--------|
| Spec source | JSON payload (Demo/External/Paste) | OpenAPI upload only |
| Generation | AI infers from sample | Deterministic compiler pipeline |
| Output | Single UISpec | One UISpec per resource (multi-resource OpenAPI) |
| Validation | Zod on AI output | Subset validator + Zod at each stage |
| Determinism | Best-effort (temp 0.3) | Canonicalization, hashing, byte-stable outputs |

**Architecture**

```
OpenAPI upload → Parse → Validate (subset) → Canonicalize + Hash → ApiIR (deterministic)
  → LLM (ApiIR → UiPlanIR, classification only) → Normalize → Lower → UISpec
```

**Pipeline Stages**

1. **Parse** — YAML/JSON OpenAPI 3.0.x and 3.1.x
2. **Subset validator** — Reject oneOf/anyOf/allOf, multiple success responses, external $ref
3. **Canonicalize** — Stable key ordering, $ref resolution, deterministic JSON
4. **ApiIR** — Pure semantic IR: resources, operations (list/detail/create/update/delete)
5. **LLM planning** — ApiIR → UiPlanIR; LLM does labels, ordering, readOnly only (no structure invention)
6. **Normalize** — Sort resources, views, fields for stability
7. **Lower** — UiPlanIR + ApiIR → UISpec (byte-identical)

**Error Taxonomy**

Structured errors with `{ code, stage, message, jsonPointer }`: `OAS_PARSE_ERROR`, `OAS_UNSUPPORTED_SCHEMA_KEYWORD`, `OAS_MULTIPLE_SUCCESS_RESPONSES`, `OAS_MULTIPLE_TAGS`, `OAS_MISSING_REQUEST_BODY`, `OAS_MULTIPLE_PATH_PARAMS`, `OAS_EXTERNAL_REF`, `OAS_AMBIGUOUS_RESOURCE_GROUPING`, `IR_INVALID`, `UIPLAN_INVALID`, `UIPLAN_LLM_UNAVAILABLE`, `UISPEC_INVALID`.

**Legacy Removal**

Completely remove Demo, External, and Paste JSON modes. Main page (`/`) is compiler-only. Delete: demo store, demo/external adapters, proxy, generate-ui, inference layer, ConnectSection, ExternalApiSection, paste flow.

[MY NOTES]

MVP v3 shifted the product to OpenAPI-first — the format developers already use. The LLM is constrained to classification (labels, ordering) rather than inventing structure; determinism comes from canonicalization and byte-stable intermediate representations.

---

## Part 8 — MVP v3 Implementation Plan (Cursor)

[AI OUTPUT]

Cursor assisted with the full OpenAPI compiler implementation across seven phases.

### OpenAPI Compiler — Phases Completed

| Phase | Goal | Status |
|-------|------|--------|
| **Phase 1** | OpenAPI ingestion & subset validator — parse, validate, drag-drop UI, two-panel layout | ✅ |
| **Phase 2** | Canonicalization & hashing — same spec → same canonical JSON → same hash | ✅ |
| **Phase 3** | OpenAPI → ApiIR (deterministic) — byte-stable, golden specs pass | ✅ |
| **Phase 4** | LLM planning (ApiIR → UiPlanIR) — same ApiIR → same normalized UiPlanIR | ✅ |
| **Phase 5** | Lowering (UiPlanIR → UISpec) — byte-identical UISpec | ✅ |
| **Phase 6** | Pipeline, persistence, mock backend — compile works, mock API, minimal page | ✅ |
| **Phase 6.25** | LLM evals for determinism — full pipeline + LLM-only evals (≥90% validity + similarity) | ✅ |
| **Phase 6.5** | Full generated UI page — CRUD from UI, sidebar nav | ✅ |
| **Phase 7** | Determinism harness & golden specs — snapshot tests, invalid spec fails | ✅ |

**Key Implementation Details**

| Component | Implementation |
|-----------|----------------|
| **Compiler page** | Two panels: left = drag-drop + output spec; right = progress, validation steps, errors |
| **Pipeline** | `POST /api/compile-openapi` — full pipeline, persist to store |
| **Generated UI** | `/u/[id]/[resource]` — sidebar nav, SchemaRenderer, MockAdapter |
| **Mock backend** | `/api/mock/[id]/[resource]` — CRUD, predefined fixtures for golden specs |
| **LLM evals** | `npm run eval:ai` (full pipeline), `npm run eval:llm` (LLM-only isolation) |
| **Golden specs** | Users (tagged 3.0), Products (path 3.1) — snapshot tests |

**LLM Evals Design (Phase 6.25)**

- **Full pipeline**: OpenAPI fixtures → compileOpenAPI × N → validate specs, compare per-resource fingerprint (≥90% similarity)
- **LLM-only**: Pre-computed ApiIR fixtures → llmPlan × N → UiPlanIR fingerprint comparison (true isolation: full fails + LLM-only passes = bug in parse/build/lower)
- **Pass criteria**: ≥90% valid runs AND ≥90% structural similarity
- **Retry/timeout**: Eval layer only; 429/503 → retry once; 60s per-run timeout

**Flatten/Unflatten for Nested Forms**

UISpec Field `name` supports dot paths (e.g. `profile.firstName`). `flattenRecord` for FormModal initialValues; `unflattenRecord` on submit before adapter.create/update.

**Golden Specs (6.25a)**

Support only golden specs initially; predefined fixtures for Users and Products. `getPredefinedData(hash, resourceSlug)`, `isGoldenSpec(hash)`. Mock clears on re-compile (no Reset Data button).

[MY NOTES]

Cursor helped implement the full compiler pipeline, error taxonomy, canonicalization, ApiIR/UiPlanIR schemas, LLM evals with two fixture sets for diagnostic isolation, and the generated UI with sidebar nav. The phased plan with CHECKPOINTs ensured each stage was verified before advancing.

---

## Part 9 — Demo Prep: Account-Based Compiler UI (Cursor)

[AI OUTPUT]

After MVP v3, I implemented demo-ready changes: account-based compiler UI, spec list and detail view, multi-resource diffs, and demo specs (Users + Tasks v1/v2/v3).

### Demo Prep — Phases Completed

| Phase | Goal | Status |
|-------|------|--------|
| **Phase 1** | Foundation — accountId in localStorage, UUID ids, list/delete | ✅ |
| **Phase 2** | Multi-resource diff utilities — computeMultiSpecDiff, formatMultiSpecDiffForDisplay | ✅ |
| **Phase 3** | Demo specs and fixtures — v1/v2/v3 compile, mock data works | ✅ |
| **Phase 4** | Compilations API — list, get, delete, update routes | ✅ |
| **Phase 5** | Compiler UI layout — spec list, detail view, URL param, update/delete | ✅ |
| **Phase 6** | Generated UI diff popup — diff shows on load, "View changes" button | ✅ |
| **Phase 7** | Polish — banners, demo specs download, custom spec message | ✅ |

**Key Design Decisions**

1. **accountId**: Replace sessionId with `getOrCreateAccountId()` — UUID in localStorage. Enables account-scoped spec list.
2. **UUID ids**: Compilation id = `crypto.randomUUID().slice(0, 12)` (no hash-based id). Shareable URLs.
3. **Spec list + detail**: Left panel = drop zone + spec list. Right panel = detail view (title, URL, API endpoints, Output Spec JSON, Update spec, Delete).
4. **Update flow**: `POST /api/compilations/[id]/update` — replace spec in place; same id/url; compute `diffFromPrevious` via `computeMultiSpecDiff` + `formatMultiSpecDiffForDisplay`.
5. **Diff popup**: Generated UI shows "What changed" modal on first load when `diffFromPrevious` exists. `sessionStorage` key `rapidui_diff_dismissed_${id}_${updatedAt}` — show once per version; "View changes" button reopens.
6. **Demo specs**: v1 (Users only), v2 (Users + Tasks), v3 (both updated). Download links and "Compile" buttons on compiler page.
7. **Custom spec banner**: When `isPredefined: false`, show "This is a custom spec. Experimental support."

**Mock API Decoupled from Spec**

Spec update = UI recompile only; mock endpoints persist. `clearForCompilation` only on delete. No clear on update.

[MY NOTES]

Demo prep made the product demo-ready: users can manage multiple specs per account, see what changed when updating a spec, and try the demo Users + Tasks evolution (v1 → v2 → v3) with one click.

---

## Part 10 — Postgres Storage Migration (Cursor)

[AI OUTPUT]

To enable production deployment, I migrated the in-memory compilation store to Neon Postgres. Mock data store deferred (Phase 2).

### Postgres Migration — Phase 1 Complete

**Goal**

Replace in-memory `Map<id, CompilationEntry>` with Postgres. Data lost on server restart → data persists across restarts.

**Schema**

```sql
CREATE TABLE compilations (
  id VARCHAR(12) PRIMARY KEY,
  account_id VARCHAR(36) NOT NULL,
  name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'success',
  specs JSONB NOT NULL,
  api_ir JSONB NOT NULL,
  openapi_canonical_hash VARCHAR(64) NOT NULL,
  resource_names JSONB NOT NULL,
  resource_slugs JSONB NOT NULL,
  diff_from_previous JSONB,
  errors JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Data Layer** (`lib/db/compilations.ts`)

- `putCompilation(id, entry)` — INSERT ... ON CONFLICT DO UPDATE
- `getCompilation(id)` — SELECT by id
- `hasCompilation(id)` — SELECT 1 WHERE id = ?
- `listCompilationsByAccount(accountId)` — SELECT by account_id, ORDER BY updated_at DESC
- `deleteCompilation(id)` — DELETE WHERE id = ?

**Design Decisions**

1. **Postgres only** — No in-memory fallback. App always uses Postgres.
2. **Async interface** — All store functions become `Promise<T>`. All callers `await`.
3. **Env** — `POSTGRES_URL` or `DATABASE_URL` (Neon integration)
4. **Phase 2 deferred** — Mock data store stays in-memory. Predefined specs re-seed from fixtures; custom specs start empty.

**Callers Updated**

- `app/api/compile-openapi/route.ts` — putCompilation
- `app/api/compilations/route.ts` — listCompilationsByAccount
- `app/api/compilations/[id]/route.ts` — getCompilation, deleteCompilation
- `app/api/compilations/[id]/update/route.ts` — getCompilation, putCompilation
- `app/u/[id]/page.tsx`, `app/u/[id]/[resource]/page.tsx` — getCompilation
- `app/api/mock/[id]/[resource]/route.ts` — getCompilation

[MY NOTES]

Postgres migration enables production deployment. Evals and pipeline tests don't touch the store; no changes needed. Local dev requires `POSTGRES_URL` in `.env.local`.

---

## Outcome Summary

[MY NOTES]

**Shipped System (RapidUI)**

- **MVP v1**: Paste JSON → AI generates spec → deterministic CRUD UI. 71 tests, AI eval harness, deployment-ready.
- **MVP v2**: One-click live dashboard from Demo API or External API. Versioned schemas, adapter layer, three tabs (Demo/External/Paste), read-only external preview, OpenAI metrics tracking.
- **MVP v3**: OpenAPI compiler — drag-and-drop upload → deterministic pipeline (Parse → Validate → Canonicalize → ApiIR → LLM → Normalize → Lower) → UISpec per resource. Generated UI at `/u/{id}/{resource}` with sidebar nav, mock backend, golden specs (Users, Products). LLM evals (full pipeline + LLM-only) for ≥90% validity + similarity.
- **Demo prep**: Account-based compiler UI with spec list and detail view. Multi-resource diff on spec update. Demo specs (Users + Tasks v1/v2/v3) with download and compile. Diff popup on generated UI load.
- **Postgres**: Compilation store migrated to Neon Postgres. Production persistence. Mock data store in-memory (Phase 2 deferred).

**AI Collaboration Pattern**

| Tool | Role |
|------|------|
| **ChatGPT** | Persona setup, blueprint creation, testing strategy, architecture decisions |
| **Cursor** | Implementation, test scaffolding, refactoring, phased execution, compiler pipeline, evals, demo prep, DB migration |

**Principles Applied**

1. **Scope discipline**: Non-goals in every blueprint prevented feature creep.
2. **Demo-critical testing**: Test what could break the demo; skip visual/E2E for MVP.
3. **Deterministic pipeline**: AI output validated with Zod; fallback always produces valid spec. MVP v3: canonicalization, hashing, byte-stable ApiIR/UiPlanIR/UISpec.
4. **Phased checkpoints**: No phase advanced until previous passed.
5. **Adapter abstraction**: Same renderer for demo API, external API, paste (v2); mock adapter (v3).
6. **OpenAPI as source of truth**: MVP v3 treats OpenAPI as canonical; LLM does classification only.
7. **LLM eval isolation**: Full pipeline + LLM-only evals for diagnostic isolation.
8. **Production persistence**: Postgres for compilations; no in-memory fallback.

This transcript reflects how AI functioned as a structured engineering collaborator — helping reason about architecture, constrain scope, validate reliability, and ship quickly across three MVP iterations, demo prep, and database migration.

---

*Raw AI session exports can be shared if additional context is needed. This transcript contains the highest-leverage excerpts used to ship RapidUI.*
