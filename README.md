# AI-Native Developer Tool — Schema → Instant Admin UI

An AI-powered developer tool that transforms backend data structures into working internal admin interfaces instantly. Built for backend and full-stack engineers who need usable CRUD UIs without writing frontend code.

## Overview

Paste your backend data → instantly get a usable admin UI.

The tool demonstrates that AI can reason over backend structure and generate a constrained UI specification that renders into a real working interface. No frontend coding required—just paste JSON and get a fully functional CRUD admin interface.

## Quick Demo

1. **Paste JSON payload** (or use the "Try Example" button)
2. **Optionally add a prompt** to customize the UI (e.g., "Hide id field, make name searchable")
3. **Click "Generate with AI"** or **"Parse JSON"** for deterministic parsing
4. **Get a working admin UI** with full CRUD operations, filtering, and search

### Example Payload

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

**Result**: A fully functional admin interface with:
- Data table showing all records
- Create/Edit/Delete operations
- Filtering by category, price range, and stock status
- Search functionality
- Form validation

## Features

- **Instant UI Generation**: Paste JSON payload or OpenAPI snippet to generate a complete admin interface
- **CRUD Operations**: Full create, read, update, delete functionality
- **Smart Field Detection**: Automatically detects field types and generates appropriate form controls
- **Filtering & Search**: Built-in filtering capabilities for data tables
- **Type-Safe**: Built with TypeScript and Zod validation

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
git clone git@github.com-personal:staskurg/ai-admin-ui.git
cd ai-admin-ui
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

## Project Structure

```
ai-admin-ui/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   └── page.tsx           # Main page
├── components/
│   └── admin/             # Admin UI components
├── docs/                   # Documentation
│   ├── ARCHITECTURE.md    # System architecture
│   └── TESTING.md         # Testing strategy
├── lib/
│   ├── ai/                # AI integration
│   ├── inference/         # Data inference logic
│   └── spec/              # UI spec handling
├── tests/                  # Tests (automated + manual examples)
│   ├── examples/          # Manual test examples
│   ├── ai/                # AI test fixtures
│   ├── inference/         # Inference tests
│   ├── renderer/          # Renderer tests
│   └── spec/              # Schema tests
├── types/                 # TypeScript type definitions
└── styles/                # Additional styles
```

## Environment Variables

- `OPENAI_API_KEY` - Your OpenAI API key (required)

## Deployment

This project is configured for deployment on Vercel:

1. Connect your GitHub repository to Vercel
2. Add the `OPENAI_API_KEY` environment variable in Vercel dashboard
3. Deploy automatically on push to main branch

## Documentation

- **[Architecture Overview](./docs/ARCHITECTURE.md)** - System design and component structure
- **[Testing Strategy](./docs/TESTING.md)** - Testing approach and philosophy
- **[Test Examples](./tests/examples/TEST_EXAMPLES.md)** - Example payloads for testing AI generation
- **[Edge Case Examples](./tests/examples/EDGE_CASE_EXAMPLES.md)** - Edge case scenarios for manual testing

## How It Works

1. **Payload Parsing**: JSON payload is parsed to extract structure (field types, nested objects, enums)
2. **AI Generation** (optional): OpenAI analyzes the payload and generates a UI specification
3. **Fallback**: If AI fails, deterministic parser creates a valid spec
4. **Rendering**: UI spec is rendered into React components (table, forms, filters)
5. **CRUD Operations**: All operations work on client-side state (ready for backend integration)

## Features

- ✅ **Smart Type Detection**: Automatically detects strings, numbers, booleans, and enums
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
