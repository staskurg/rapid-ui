# RapidUI.dev

Generate deterministic UIs from backend data. An AI-powered developer tool that transforms backend data structures into schema-driven user interfaces instantly. Built for backend and full-stack engineers who need usable CRUD UIs without writing frontend code.

## Overview

Connect to an API or paste JSON → instantly get a schema-driven CRUD dashboard.

RapidUI offers three ways to get started:

- **Demo API** — One-click dashboard from built-in resources (Users, Products, Tasks, Orders, etc.) with full CRUD
- **External API** — Connect to any public REST API for read-only preview (e.g. JSONPlaceholder, ReqRes)
- **Paste JSON** — Paste arbitrary JSON for backward compatibility and ad-hoc use

No frontend coding required—just connect or paste and get a fully functional interface.

## Quick Demo

### Option A: Demo API (fastest)

1. Open the **Demo API** tab
2. Select a resource (e.g. **Users**) and version (v1, v2, or v3)
3. Optionally add a prompt (e.g. "Hide id from table")
4. Click **Generate**
5. Get a live CRUD dashboard with Create, Edit, Delete, filters, and search

### Option B: External API

1. Open the **External API** tab
2. Enter a URL (e.g. `https://jsonplaceholder.typicode.com/users`)
3. If the response is wrapped (e.g. `{ data: [...] }`), select the data path
4. Click **Generate**
5. Get a read-only preview dashboard

### Option C: Paste JSON

1. Open the **Paste JSON** tab
2. Paste a JSON payload (or use "Try Example")
3. Optionally add a prompt
4. Click **Generate with AI** or **Parse JSON**
5. Get a working UI with full CRUD (local state), filtering, and search

### Example Payload (Paste JSON)

```json
[
  {
    "id": 1,
    "name": "Wireless Mouse",
    "price": 29.99,
    "inStock": true,
    "category": "electronics"
  },
  {
    "id": 2,
    "name": "USB Keyboard",
    "price": 49.99,
    "inStock": false,
    "category": "electronics"
  }
]
```

**Result**: A fully functional interface with:
- Data table showing all records
- Create/Edit/Delete operations
- Filtering by category, price range, and stock status
- Search functionality
- Form validation

## Features

- **Three data sources**: Demo API (full CRUD), External API (read-only preview), Paste JSON (local state)
- **One-click generation**: Connect → Generate → Dashboard in seconds
- **Instant UI generation**: Paste JSON or connect to API to generate a complete interface
- **CRUD operations**: Full create, read, update, delete (Demo API and Paste JSON)
- **Smart field detection**: Automatically detects field types and generates appropriate form controls
- **Filtering & search**: Built-in filtering capabilities for data tables
- **Type-safe**: Built with TypeScript and Zod validation

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: shadcn/ui + Tailwind CSS
- **Table**: TanStack Table
- **Forms**: React Hook Form
- **Validation**: Zod
- **AI**: OpenAI SDK
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenAI API key

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

4. Add your OpenAI API key to `.env.local`:
```
OPENAI_API_KEY=your_api_key_here
```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

Build for production:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

### Testing

```bash
npm test              # Run tests once
npm run test:watch    # Run tests in watch mode
npm run test:ui       # Open Vitest UI (browser-based test runner)
npm run eval:ai       # AI evaluation harness (requires OPENAI_API_KEY)
```

See [eval/README.md](./eval/README.md) for eval options (`--fixture`, `--runs`, etc.).

## Project Structure

```
rapid-ui/
├── app/
│   ├── api/               # API routes
│   │   ├── demo/          # Demo API (CRUD, sample, reset)
│   │   ├── generate-ui/   # AI spec generation
│   │   └── proxy/         # External API proxy (read-only)
│   └── page.tsx           # Main page (three tabs)
├── components/
│   ├── connect/           # Connect section (Demo, External, Paste)
│   └── renderer/          # Schema-driven UI (table, form, filters)
├── lib/
│   ├── adapters/          # CrudAdapter (demo, external)
│   ├── ai/                # AI integration
│   ├── demoStore/        # Demo seeds and session store
│   ├── inference/        # Data inference logic
│   └── spec/              # UI spec handling
├── tests/
│   ├── adapters/         # Adapter tests
│   ├── examples/         # Manual test examples
│   └── utils/            # Utility tests
└── styles/
```

## Environment Variables

- `OPENAI_API_KEY` - Your OpenAI API key (required)

## Deployment

This project is configured for deployment on Vercel:

1. Connect your GitHub repository to Vercel
2. Add the `OPENAI_API_KEY` environment variable in Vercel dashboard
3. Deploy automatically on push to main branch

## Documentation

- **[Architecture Overview](./ARCHITECTURE.md)** - System design and component structure
- **[Test Examples](./tests/examples/TEST_EXAMPLES.md)** - Example payloads for testing AI generation
- **[Edge Case Examples](./tests/examples/EDGE_CASE_EXAMPLES.md)** - Edge case scenarios for manual testing

## How It Works

1. **Connect or paste**: Choose Demo API, External API, or Paste JSON
2. **Sample fetch**: Adapter fetches sample data (seeds for demo, proxy for external, or pasted JSON)
3. **Spec generation**: AI (or deterministic parser) generates a UI specification from the payload
4. **Validation**: Zod validates the spec
5. **Rendering**: SchemaRenderer renders table, forms, and filters from the spec
6. **CRUD**: Demo API and Paste JSON support full CRUD; External API is read-only

## Feature Details

- ✅ **Smart type detection**: Automatically detects strings, numbers, booleans, and enums
- ✅ **Nested Object Support**: Flattens nested objects (e.g., `user.name` → "User Name")
- ✅ **Enum Detection**: Identifies fields with limited distinct values (≤5) as enums
- ✅ **AI-Powered Customization**: Use natural language prompts to customize the UI
- ✅ **Fallback Safety**: Always generates a valid UI spec, even for edge cases
- ✅ **Error Boundaries**: Graceful error handling with user-friendly messages
- ✅ **Type-Safe**: Full TypeScript + Zod validation throughout

## Edge Cases Handled

- Empty arrays → Fallback spec with helpful error message
- Empty objects → Clear error message
- Null/undefined values → Handled gracefully in type inference
- Invalid JSON → User-friendly error with fallback option
- Special characters in field names → Sanitized for display
- Missing fields → Optional fields handled correctly
- Malformed payloads → Fallback generator ensures valid spec
