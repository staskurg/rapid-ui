# Getting Started

Step-by-step guide to run RapidUI locally and generate your first UI from an OpenAPI spec.

## Prerequisites

- **Node.js 18+**
- **npm** or **yarn**
- **OpenAI API key** — [Get one](https://platform.openai.com/api-keys)
- **Postgres database** — [Neon](https://neon.tech) (free tier) or any Postgres

## 1. Clone and Install

```bash
git clone git@github.com-personal:staskurg/rapid-ui.git
cd rapid-ui
npm install
```

## 2. Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
OPENAI_API_KEY=sk-...
POSTGRES_URL=postgresql://user:password@host/dbname?sslmode=require
```

Or use `DATABASE_URL` instead of `POSTGRES_URL`.

## 3. Run Migrations

```bash
npm run db:migrate
```

Creates the `compilations` table. Run once per database.

## 4. Start Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 5. Generate Your First UI

1. **Demo specs** — Click **Demo specs** → **Golden Users** or **Golden Products**
2. Wait for compile (Parse → Validate → Compile)
3. Click **View UI** (or the link in the progress panel)
4. You’re at `/u/[id]/[resource]` with a full CRUD interface

## 6. Try Your Own OpenAPI

1. Create or download an OpenAPI 3.0/3.1 spec (YAML or JSON)
2. Drop the file onto the upload zone (or click to browse)
3. If validation passes, the UI compiles and appears in **Your specs**
4. Click a spec → **View UI**

See [docs/openapi-compiler.md](./openapi-compiler.md) for the supported subset. Unsupported features cause clear compile errors.

## Troubleshooting

### "POSTGRES_URL or DATABASE_URL is required"

Add `POSTGRES_URL` or `DATABASE_URL` to `.env.local`. Neon provides a connection string in the dashboard.

### "Missing accountId"

The app uses a client-generated account ID (stored in localStorage). If you see this in API responses, ensure you’re loading the app in a browser (not headless).

### Compilation fails with OAS_* errors

Your OpenAPI spec uses unsupported features. Check the error message and [supported subset](./openapi-compiler.md). Common issues: `oneOf`/`anyOf`/`allOf`, multiple path params, missing request body on POST.

### LLM timeout or rate limit

The UiPlanIR step calls OpenAI. Ensure `OPENAI_API_KEY` is valid and you have quota. Evals use retries; the API route may surface `UIPLAN_LLM_UNAVAILABLE`.
