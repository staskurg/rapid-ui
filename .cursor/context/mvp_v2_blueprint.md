
# AI-Native Developer Tool — API → One-Click Live Admin UI (Next MVP Blueprint)

## The MVP (Next Iteration)

### Core Idea

Evolve RapidUI from “JSON → admin UI (in-memory CRUD)” into a **one-click internal dashboard generator** that connects to a **real API** (demo API first, external APIs in preview mode), generates a deterministic admin UI spec, and renders a **live CRUD dashboard** backed by that API.

### What’s new vs v1

- Data source is an API, not pasted JSON
- CRUD calls hit endpoints, not local state
- Versioned schema evolution for demo (v1/v2/v3)
- One-click regen: change API version → click Generate → UI updates
- External API support is read-only preview with graceful degradation

---

## Problem

Backend/full-stack engineers constantly build internal CRUD dashboards. This is repetitive, low-leverage frontend work. Heavy platforms are overkill; ad‑hoc AI prototypes are unreliable.

This MVP proves:

> Connect API → generate dashboard → modify API → regenerate → deterministic UI

---

## Target User

Backend/full-stack engineers who:

- Have REST endpoints or JSON APIs
- Need internal dashboards fast
- Prefer automation over frontend scaffolding

---

## Value Proposition

**One click → working CRUD dashboard from a live API.**

- No frontend code
- Deterministic renderer
- AI-assisted spec generation with validation + fallback
- Real API-backed CRUD demo

---

## MVP Scope

### Supported Data Sources

#### Demo API (first-class)

- Next.js in-memory JSON CRUD backend
- Session-scoped sandbox
- Versioned schemas v1/v2/v3
- Full CRUD always supported

#### External API Preview

- User provides endpoint URL
- Server-side proxy fetch
- Read-only UI preview
- CRUD buttons disabled
- Graceful degradation

---

## Demo Narrative

1. Choose demo resource (Users v1)
2. Generate UI → CRUD dashboard appears
3. Modify records
4. Switch to Users v2
5. Regenerate → UI updates

Magic moment:

> Modify API → click → instant updated UI

---

## Non-Goals

- Auth / billing / analytics
- Teams/workspaces
- Schema diff engines
- Persisted UI overrides
- Multi-entity dashboards
- OpenAPI ingestion

---

## Architecture

Pipeline:

API → sample payload → AI + fallback → validated spec → renderer → adapter CRUD

Never render unvalidated AI output.

---

## Components

### Demo API Server

- In-memory store keyed by sessionId
- Versioned seed datasets
- CRUD endpoints

### Proxy Fetcher

- Server-side external fetch
- JSON validation

### API Adapter Layer

Unified CRUD interface with capability flags.

### Spec Generator

Existing AI + fallback pipeline.

### Admin Renderer

Uses adapter for CRUD instead of local state.

---

## Data Model

### Session Isolation

- sessionId generated client-side
- Stored in localStorage
- Included in demo API requests

### Versioning

`/api/demo/{resource}?session={id}&v=2`

v1: baseline  
v2: added fields/enums  
v3: renamed/modified fields  

---

## UI Spec Contract

Unchanged from v1.

```json
{
  "entity": "string",
  "fields": [],
  "table": {},
  "form": {},
  "filters": []
}
```

Constraints:

- Deterministic
- Flattened fields
- CRUD-only semantics

---

## CRUD API Contract (Demo)

GET list  
POST create  
PUT update  
DELETE remove  

IDs are inferred per resource. Renderer extracts record key dynamically.

PATCH is not required; demo uses PUT for simplicity.

---

## Adapter Interface

```ts
interface CrudAdapter {
  mode: "demo" | "external";
  capabilities: {
    read: true;
    create: boolean;
    update: boolean;
    delete: boolean;
  };
  getSample(): Promise<any>;
  list(): Promise<any[]>;
  create?(input: any): Promise<any>;
  update?(id: string, input: any): Promise<any>;
  remove?(id: string): Promise<void>;
}
```

External adapter is read-only.

---

## UI Flow

### Connect Screen

- Demo resource selector + version
- External API URL input
- Generate button

### Dashboard

- Regenerate UI
- Version switch
- Reset demo data
- Spec preview panel (visible for debugging)
- Filters, table, forms

---

## Regeneration Workflow

1. Fetch sample
2. Generate spec
3. Validate
4. Reset renderer state
5. Render UI
6. Load live data

---

## Demo Datasets

Use seeded JSON examples:

- Users
- Products
- Tasks
- Orders
- Blog posts
- Inventory
- Nested example

Each has v1/v2/v3 evolution.

---

## Robustness

- Zod validation gate
- Retry AI output
- Fallback parser
- Error boundary
- Toast error reporting
- Graceful external API failures

---

## Folder Structure

```
app/
  page.tsx
  dashboard/page.tsx
  api/
    generate-ui/
    demo/
    proxy/

components/
  admin/
  connect/

lib/
  adapters/
  demoStore/
  spec/
  ai/

types/
```

---

## Execution Plan

### Phase 1
Demo store + CRUD routes + session isolation

### Phase 2
Adapter integration with renderer

### Phase 3
Generate/regenerate pipeline

### Phase 4
External API preview

### Phase 5
Polish + testing

---

## Success Criteria

- One-click live CRUD dashboard
- Version regen updates UI
- External preview works read-only
- Demo usable in under 2 minutes
- No crashes; graceful failures

---

## Decisions

- Record IDs inferred per resource (no forced normalization)
- Demo uses PUT, not PATCH
- Spec preview panel remains visible for debugging

---

End of blueprint.
