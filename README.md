# RapidUI.dev

Generate deterministic UIs from OpenAPI specs. An AI-powered compiler that transforms OpenAPI 3.0/3.1 into schema-driven CRUD interfaces. Same OpenAPI → same UI, every time.

## Overview

Upload an OpenAPI spec (YAML or JSON) → compile → get a live CRUD dashboard for each resource.

RapidUI is a **deterministic compiler**, not an AI UI builder. The LLM is a constrained phase that infers labels and field ordering—it cannot add/remove fields or change structure.

## Quick Demo

1. **Upload** — Drop an OpenAPI file (`.yaml`, `.yml`, or `.json`) or click **Demo specs** to use a built-in example (Golden Users, Golden Products, or Demo v1/v2/v3)
2. **Compile** — The pipeline runs: Parse → Validate subset → ApiIR → UiPlanIR (LLM) → UISpec
3. **View** — Click **View UI** to open the generated CRUD interface at `/u/[id]/[resource]`

The generated UI includes:
- Data table with all list fields
- Create / Edit / Delete operations
- Filters and search
- Form validation

## Features

- **OpenAPI 3.0.x & 3.1.x** — Parse YAML or JSON
- **Deterministic pipeline** — Same spec → same UISpec → same UI
- **CRUD semantics** — List, detail, create, update, delete inferred from paths and methods
- **Mock backend** — Generated UIs use `/api/mock/[id]/[resource]` for CRUD (no external API required)
- **Compilation storage** — Postgres-backed; compilations persist per account
- **Type-safe** — TypeScript and Zod throughout

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: shadcn/ui + Tailwind CSS
- **Table**: TanStack Table
- **Forms**: React Hook Form + Zod
- **AI**: OpenAI SDK (LLM planning phase)
- **Database**: Neon Postgres (compilations)
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- OpenAI API key
- Postgres database (Neon, Supabase, or any Postgres)

### Installation

1. Clone the repository:
```bash
git clone git@github.com-personal:staskurg/rapid-ui.git
cd rapid-ui
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Add to `.env.local`:
```
OPENAI_API_KEY=your_api_key_here
POSTGRES_URL=postgresql://user:pass@host/db
# or DATABASE_URL
```

5. Run migrations:
```bash
npm run db:migrate
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

### Testing

```bash
npm test              # Run tests once
npm run test:watch    # Run tests in watch mode
npm run test:ui       # Open Vitest UI
npm run eval:ai       # Full pipeline determinism eval (requires OPENAI_API_KEY)
npm run eval:llm      # LLM-only determinism eval
npm run eval:all      # Run both evals in parallel
```

See [eval/README.md](./eval/README.md) for eval options (`--fixture`, `--runs`, etc.).

## Project Structure

```
rapid-ui/
├── app/
│   ├── api/
│   │   ├── compile-openapi/   # POST: compile OpenAPI → UISpec
│   │   ├── compilations/     # List, get, update, delete compilations
│   │   ├── demo-specs/       # Download demo OpenAPI files
│   │   └── mock/             # Mock CRUD API for generated UIs
│   ├── u/[id]/               # View compiled UI (resource selection)
│   ├── u/[id]/[resource]/    # CRUD interface for a resource
│   └── page.tsx               # Compiler page (upload, list, detail)
├── components/
│   ├── compiler/             # ProgressPanel, CompiledUISidebar, CompiledUIContent
│   ├── connect/              # OpenApiDropZone
│   └── renderer/              # SchemaRenderer, DataTable, FormModal, FiltersPanel
├── lib/
│   ├── compiler/             # OpenAPI → UISpec pipeline
│   │   ├── openapi/          # Parser, subset validator, canonicalize
│   │   ├── apiir/            # ApiIR build, grouping, operations
│   │   ├── uiplan/           # LLM planning, UiPlanIR schema, normalize
│   │   └── lowering/         # UiPlanIR → UISpec
│   ├── db/                   # Postgres compilations store
│   ├── adapters/             # MockAdapter for generated UIs
│   └── spec/                 # UISpec types and validation
└── tests/
    └── compiler/             # Pipeline, canonical, apiir, uiplan, lowering tests
```

## Environment Variables

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `OPENAI_API_KEY` | Yes | OpenAI API key for LLM planning phase |
| `POSTGRES_URL` or `DATABASE_URL` | Yes | Postgres connection string for compilations |

## Documentation

- **[Architecture Overview](./ARCHITECTURE.md)** — System design and compiler pipeline
- **[OpenAPI Compiler](./docs/openapi-compiler.md)** — Pipeline stages, supported subset, error codes
- **[Getting Started](./docs/getting-started.md)** — Step-by-step setup guide
- **[Mock API Testing](./docs/mock-api-testing.md)** — Manual testing of generated UIs
- **[Form Modal Nested Schema](./docs/form-modal-nested-schema.md)** — Nested field handling in forms

## How It Works

1. **Upload** — User drops OpenAPI file or selects demo spec
2. **Parse** — YAML/JSON parsed into OpenAPI document
3. **Validate** — Subset validator rejects unsupported constructs
4. **Canonicalize** — Resolve `$ref`, stable key/array ordering, hash
5. **ApiIR** — Deterministic conversion to semantic IR (resources, operations)
6. **UiPlanIR** — LLM infers labels, field order, readOnly (constrained)
7. **Lower** — UiPlanIR → UISpec (one per resource)
8. **Store** — Save to Postgres; list at `/`
9. **View** — Navigate to `/u/[id]/[resource]`; SchemaRenderer + MockAdapter render CRUD UI

## Supported OpenAPI Subset

RapidUI supports a strict subset of OpenAPI. Unsupported features cause **compile errors**.

- **Versions**: 3.0.x, 3.1.x
- **Style**: CRUD only (GET list/detail, POST create, PUT/PATCH update, DELETE)
- **Paths**: One path param max (e.g. `/users/{id}`)
- **Request bodies**: `application/json` required for POST/PUT/PATCH
- **Responses**: Single success response, `application/json`
- **Schemas**: No `oneOf`, `anyOf`, `allOf`; local `$ref` only

See [docs/openapi-compiler.md](./docs/openapi-compiler.md) for full details.

## Deployment

1. Connect your GitHub repo to Vercel
2. Add `OPENAI_API_KEY` and `POSTGRES_URL` (or `DATABASE_URL`) in Vercel
3. Run migrations (e.g. via Vercel build command or manual)
4. Deploy on push to main
