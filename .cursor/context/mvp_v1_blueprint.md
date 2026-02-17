# AI-Native Developer Tool --- Schema → Instant Admin UI (MVP Blueprint)

## The MVP

### Core Idea

Build an AI-powered developer tool that turns backend data structures
into a working internal admin interface instantly. The tool acts like a
lightweight frontend companion for backend/full-stack engineers who want
usable CRUD UIs without writing frontend code.

### Problem

Backend and full-stack engineers frequently need internal dashboards to
inspect and manage data. Building these UIs requires repetitive frontend
work --- tables, forms, validation, layout --- which is time-consuming
and low leverage. Existing solutions are either heavy platforms or
vibe-coded prototypes that aren't reliable.

The goal is to remove frontend friction for internal tooling while
keeping output deterministic and production-feeling.

### Target User

Backend or full-stack engineers who: - Have API responses or schema
definitions\
- Need internal CRUD/admin tooling\
- Want to move fast without frontend expertise

### Value Proposition

Paste backend data → instantly get a usable admin UI.

The tool demonstrates that AI can reason over backend structure and
generate a constrained UI specification that renders into a real working
interface.

------------------------------------------------------------------------

## MVP Scope (72-hour demo)

### Input

User provides:

-   Raw API payload (primary path)\
-   OpenAPI snippet (optional stretch goal)\
-   Optional natural-language intent

### AI Processing

AI analyzes structure and outputs a strict UI spec (validated JSON)
describing:

-   Table columns\
-   Form fields\
-   CRUD actions\
-   Filters

### Renderer

Deterministic renderer maps the spec to:

-   Data table\
-   Create/edit modal form\
-   Filters panel\
-   Action buttons

No runtime AI. No framework abstraction. Just:

backend → spec → UI

------------------------------------------------------------------------

## UI Primitive Set

Minimal CRUD loop:

-   Table --- view records\
-   Form --- create/edit records\
-   Filters --- query data\
-   Actions --- CRUD

------------------------------------------------------------------------

## Architecture

Pipeline:

backend data → AI reasoning → validated UI spec → renderer → UI

AI output is schema-constrained and validated before rendering.

------------------------------------------------------------------------

## Non-Goals

To prevent scope explosion:

-   No frontend framework platform\
-   No routing system\
-   No styling engine\
-   No plugin architecture\
-   No persistence layer\
-   No schema sync engine\
-   No complex callbacks

Focus = demo clarity.

------------------------------------------------------------------------

## Demo Narrative

"Backend engineers waste hours building internal UIs. Paste your API
data, and AI generates a working admin interface instantly."

------------------------------------------------------------------------

## Success Criteria

-   Paste data → generate UI spec\
-   CRUD UI renders\
-   Editable fields + filters\
-   Stable demo flow\
-   Clear magic moment

------------------------------------------------------------------------

## Tech Stack

-   Framework → Next.js (App Router)\
-   UI → shadcn/ui + Tailwind\
-   Table → TanStack Table\
-   Forms → React Hook Form\
-   Validation → Zod\
-   AI → OpenAI SDK via API route\
-   State → React local state\
-   Deploy → Vercel

------------------------------------------------------------------------

## UI Spec Contract --- CRUD Admin MVP

### Structure

``` json
{
  "entity": string,
  "fields": Field[],
  "table": TableConfig,
  "form": FormConfig,
  "filters": string[]
}
```

### Field

``` json
{
  "name": string,
  "label": string,
  "type": "string" | "number" | "boolean" | "enum",
  "required": boolean,
  "options"?: string[]
}
```

### Constraints

-   Deterministic rendering\
-   No nesting\
-   No styling metadata\
-   CRUD semantics only

------------------------------------------------------------------------

## Field → UI Mapping

  Type      Table     Form           Filter
  --------- --------- -------------- ----------
  string    text      input          search
  number    numeric   number input   numeric
  boolean   badge     toggle         dropdown
  enum      label     select         dropdown

------------------------------------------------------------------------

## Renderer Architecture

Pipeline:

UI Spec → Renderer Controller → CRUD Components → Local State → UI

Components:

-   AdminRenderer --- state controller\
-   DataTable --- records view\
-   FormModal --- edit/create\
-   FiltersPanel --- filtering

All mutations flow through AdminRenderer.

------------------------------------------------------------------------

## AI Pipeline

Inputs:

-   Payload/OpenAPI\
-   Optional intent\
-   Optional existing spec

Steps:

1.  Normalize input\
2.  Prompt LLM with spec schema\
3.  Validate via Zod\
4.  Retry on failure\
5.  Deterministic fallback

Endpoint:

POST `/api/generate-ui`

Never render unvalidated output.

------------------------------------------------------------------------

## Folder Structure

    app/
      page.tsx
      api/generate-ui/route.ts

    components/admin/
      AdminRenderer.tsx
      DataTable.tsx
      FormModal.tsx
      FiltersPanel.tsx

    lib/
      spec/
      ai/
      inference/

    types/
    styles/
    .env

------------------------------------------------------------------------

## Demo Flow

1.  Paste JSON payload\
2.  Optional intent\
3.  Generate UI\
4.  AI spec validated\
5.  CRUD interface appears\
6.  Iterate + regenerate

Magic moment:

Paste data → working admin UI.

------------------------------------------------------------------------

## Execution Plan

### Phase 1 --- Renderer Foundation

Hardcoded spec → working CRUD UI

### Phase 2 --- Payload Inference

JSON → deterministic spec

### Phase 3 --- AI Integration

Prompt → validation → fallback

### Phase 4 --- UX Polish

Intent + regenerate flow

### Phase 5 --- Stabilization

Edge cases + demo rehearsal

------------------------------------------------------------------------

## MVP Goal

Prove:

backend structure → AI reasoning → deterministic UI → developer
acceleration.
