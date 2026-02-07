---
name: AI Admin UI MVP Implementation
overview: "Build an AI-powered admin UI generator that transforms backend API payloads into working CRUD interfaces. The implementation follows a 5-phase approach: project setup → renderer foundation → payload inference → AI integration → UX polish → stabilization."
todos:
  - id: phase0-setup
    content: "Phase 0: Initialize Next.js project, install dependencies, set up shadcn/ui, create folder structure, configure environment variables, initialize git repo"
    status: completed
  - id: phase1-schema
    content: "Phase 1: Define UI spec Zod schema and TypeScript types"
    status: completed
  - id: phase1-renderer
    content: "Phase 1: Build AdminRenderer component with state management and CRUD operations"
    status: completed
  - id: phase1-table
    content: "Phase 1: Implement DataTable component with TanStack Table and type-specific rendering"
    status: completed
  - id: phase1-form
    content: "Phase 1: Build FormModal component with React Hook Form and dynamic field generation"
    status: completed
  - id: phase1-filters
    content: "Phase 1: Create FiltersPanel component with type-specific filter inputs"
    status: completed
  - id: phase1-demo
    content: "Phase 1: Test with hardcoded spec and sample data, verify full CRUD flow"
    status: completed
  - id: phase2-parser
    content: "Phase 2: Implement payload parser for JSON inference and deterministic spec generation"
    status: completed
  - id: phase2-integration
    content: "Phase 2: Add JSON input UI and integrate parser with renderer"
    status: completed
  - id: phase3-ai-client
    content: "Phase 3: Set up OpenAI client and create prompt templates"
    status: pending
  - id: phase3-api-route
    content: "Phase 3: Build API route with AI generation, validation, retry logic, and fallback"
    status: pending
  - id: phase3-frontend
    content: "Phase 3: Integrate AI generation into main page with loading and error states"
    status: pending
  - id: phase35-schema-tests
    content: "Phase 3.5: Write UISpec schema validation tests (invalid/valid specs, enum validation, field references)"
    status: pending
  - id: phase35-inference-tests
    content: "Phase 3.5: Write field inference tests (type detection, array handling, nested objects)"
    status: pending
  - id: phase35-fallback-tests
    content: "Phase 3.5: Write fallback generator tests (valid spec output, consistent references)"
    status: pending
  - id: phase35-renderer-tests
    content: "Phase 3.5: Write renderer state tests (CRUD operations, filters, state transitions)"
    status: pending
  - id: phase35-ai-eval-tests
    content: "Phase 3.5: Write AI contract eval tests (fixture payloads, schema compliance, create fixtures)"
    status: pending
  - id: phase4-ux
    content: "Phase 4: Polish main page layout, add loading states, improve error handling, add regenerate flow"
    status: pending
  - id: phase5-stabilize
    content: "Phase 5: Handle edge cases, add error boundaries, optimize performance, verify all tests pass, prepare demo materials"
    status: pending
isProject: false
---

# AI Admin UI MVP Implementation Plan

## Overview

Transform backend data structures into instant admin UIs using AI reasoning. The tool accepts API payloads, generates validated UI specs, and renders deterministic CRUD interfaces.

## Testing Strategy

### Philosophy

Focus on **demo-critical boundaries** - test what could break the demo. Not exhaustive coverage, but high-leverage reliability that prevents demo failures.

**Guiding principle**: Test what could break the demo.

### Testing Layers

1. **Tier 1 - Deterministic Unit Tests** (Required)
  - UISpec schema validation
  - Field inference logic
  - Fallback spec generator
  - **Why**: Protect core engine contracts
2. **Tier 2 - Renderer Behavior Tests** (Lightweight)
  - State transitions (create, edit, delete, filter)
  - Use React Testing Library
  - **Why**: Validate renderer state integrity, not visuals
3. **Tier 3 - AI Output Contract Evaluation**
  - AI output validity + schema compliance
  - Use fixture payloads → AI → validate UISpec
  - Record successful outputs as fixtures for stable testing
  - **Why**: Ensure AI cannot break rendering

### What We Skip (MVP)

- Visual regression tests
- End-to-end browser automation
- Snapshot-heavy UI testing
- AI benchmarking suites

These add complexity without improving demo safety.

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **UI Components**: shadcn/ui + Tailwind CSS
- **Table**: TanStack Table (React Table)
- **Forms**: React Hook Form + Zod validation
- **AI**: OpenAI SDK (GPT-4 or GPT-3.5-turbo)
- **State**: React local state (useState/useReducer)
- **Testing**: Vitest + React Testing Library + Jest DOM matchers
- **Deploy**: Vercel-ready configuration

## Phase 0: Project Initialization

### Setup Tasks

1. **Initialize Next.js project**
  - Create Next.js app with TypeScript
  - Configure App Router structure
  - Set up Tailwind CSS
2. **Install dependencies**
  - Core: `next`, `react`, `react-dom`, `typescript`
  - UI: `@radix-ui/*` (for shadcn components), `tailwindcss`, `class-variance-authority`, `clsx`, `tailwind-merge`
  - Table: `@tanstack/react-table`
  - Forms: `react-hook-form`, `@hookform/resolvers`, `zod`
  - AI: `openai`
  - Testing: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`
  - Utils: `date-fns` (for date formatting)
3. **Initialize shadcn/ui**
  - Set up shadcn/ui configuration (`components.json`)
  - Install base components: Button, Input, Select, Dialog, Label, Badge, Tabs
4. **Create folder structure**
  ```
   app/
     page.tsx (main landing page)
     api/generate-ui/route.ts (AI endpoint)
   components/
     admin/
       AdminRenderer.tsx
       DataTable.tsx
       FormModal.tsx
       FiltersPanel.tsx
     ui/ (shadcn components)
   lib/
     spec/
       schema.ts (Zod schema for UI spec)
       types.ts (TypeScript types)
     ai/
       prompt.ts (AI prompt templates)
       client.ts (OpenAI client setup)
     inference/
       payload-parser.ts (JSON payload analysis)
   types/
     index.ts (shared types)
   styles/
     globals.css
   tests/
     spec/
       uiSpecSchema.test.ts
       fallbackGenerator.test.ts
     inference/
       inferFields.test.ts
     renderer/
       adminRenderer.test.tsx
     ai/
       aiEval.test.ts
       fixtures/ (recorded AI outputs for stable testing)
  ```
5. **Environment setup**
  - Create `.env.local` with `OPENAI_API_KEY` placeholder
  - Add `.env.local` to `.gitignore`
  - Create `.env.example` with placeholder
6. **Git repository**
  - Initialize git repo
  - Create initial commit
  - Set up `.gitignore` for Next.js
7. **Testing setup**
  - Configure Vitest (`vitest.config.ts`)
  - Set up React Testing Library
  - Configure Jest DOM matchers
  - Add test scripts to `package.json`
8. **Hello World app**
  - Create basic landing page with project title
  - Verify Next.js dev server runs
  - Verify test setup works (run `npm test`)

## Phase 1: Renderer Foundation

### Core Components

1. **Define UI Spec Schema** (`lib/spec/schema.ts`)
  - Zod schema matching blueprint spec:
    - Entity name (string)
    - Fields array (name, label, type, required, options)
    - Table config (columns, sorting)
    - Form config (field order, validation)
    - Filters array (field names)
2. **TypeScript Types** (`lib/spec/types.ts`)
  - Export TypeScript types from Zod schema
  - Field types: `string | number | boolean | enum`
3. **AdminRenderer Component** (`components/admin/AdminRenderer.tsx`)
  - Main state controller
  - Manages: data array, selected record, form state, filters
  - Handles CRUD operations (create, read, update, delete)
  - Props: initial spec (hardcoded for Phase 1), initial data
4. **DataTable Component** (`components/admin/DataTable.tsx`)
  - Uses TanStack Table
  - Renders columns based on spec
  - Supports sorting, row selection
  - Action buttons (Edit, Delete)
  - Type-specific cell rendering (string, number, boolean badge, enum label)
5. **FormModal Component** (`components/admin/FormModal.tsx`)
  - React Hook Form + Zod validation
  - Dynamic form fields based on spec
  - Field types: input (string), number input, toggle (boolean), select (enum)
  - Create/Edit modes
  - Submit handler calls AdminRenderer callbacks
6. **FiltersPanel Component** (`components/admin/FiltersPanel.tsx`)
  - Filter inputs for specified fields
  - String: search input
  - Number: min/max inputs
  - Boolean/Enum: dropdown selects
  - Applies filters to table data
7. **Hardcoded Demo Spec**
  - Create sample spec (e.g., "User" entity with id, name, email, role, active)
  - Sample data array
  - Test full CRUD flow

### Success Criteria

- Hardcoded spec renders working table
- Create/Edit forms work
- Filters apply correctly
- Delete removes records
- All field types render properly

## Phase 2: Payload Inference

### JSON Analysis

1. **Payload Parser** (`lib/inference/payload-parser.ts`)
  - Accepts JSON payload (array or single object)
  - Infers field types from data
  - Detects arrays → uses first element structure
  - Type detection: string, number, boolean, enum (if limited distinct values)
  - Generates field labels from keys (camelCase → Title Case)
2. **Deterministic Spec Generator**
  - Converts parsed structure to UI spec format
  - Sets default table columns (all fields)
  - Sets default form config
  - Sets default filters (all string/number fields)
3. **Integration**
  - Add input area on main page for JSON paste
  - Parse button triggers inference
  - Display generated spec (read-only preview)
  - "Generate UI" button uses inferred spec

### Success Criteria

- Paste JSON → see inferred spec
- Inferred spec renders working UI
- Handles arrays, nested objects (flatten), edge cases

## Phase 3: AI Integration

### AI Pipeline

1. **OpenAI Client Setup** (`lib/ai/client.ts`)
  - Initialize OpenAI client with API key
  - Error handling for missing key
2. **Prompt Template** (`lib/ai/prompt.ts`)
  - System prompt: Explain UI spec schema, constraints
  - User prompt: Include payload, optional intent, existing spec
  - Request JSON-only response matching schema
3. **API Route** (`app/api/generate-ui/route.ts`)
  - POST endpoint
  - Accepts: payload (JSON), intent (optional string), existingSpec (optional)
  - Calls OpenAI API
  - Validates response against Zod schema
  - Retry logic (max 2 retries on validation failure)
  - Fallback to deterministic parser if AI fails
4. **Frontend Integration**
  - Add "AI Generate" button on main page
  - Optional intent textarea
  - Loading state during generation
  - Error handling and display
  - Use generated spec in AdminRenderer

### Success Criteria

- AI generates valid spec from payload
- Validation catches invalid responses
- Fallback works if AI fails
- Intent influences spec generation

## Phase 3.5: Reliability Guardrails (Testing)

### Testing Philosophy

Focus on **demo-critical boundaries** - test what could break the demo. Not exhaustive coverage, but high-leverage reliability.

### Tier 1: Deterministic Unit Tests (Required)

1. **UISpec Schema Validation Tests** (`tests/spec/uiSpecSchema.test.ts`)
  - Test invalid specs are rejected:
    - Missing required fields (entity, fields, table, form, filters)
    - Invalid field types
    - Enum fields without options array
    - Broken table/form field references
  - Test valid specs are accepted
  - **Why**: Schema failure = renderer crash = demo failure
2. **Field Inference Logic Tests** (`tests/inference/inferFields.test.ts`)
  - Test payload → inferred field types:
    - `{ name: "Alice" }` → string type
    - `{ age: 42 }` → number type
    - `{ active: true }` → boolean type
    - Enum detection (limited distinct values → enum with options)
  - Test array handling (uses first element structure)
  - Test nested object flattening
  - **Why**: Ensures deterministic inference pipeline stability
3. **Fallback Spec Generator Tests** (`tests/spec/fallbackGenerator.test.ts`)
  - Test fallback always produces valid UISpec
  - Test consistent field references
  - Test default table/form/filter configs
  - **Why**: Demo safety net when AI output fails

### Tier 2: Renderer Behavior Tests (Lightweight)

1. **AdminRenderer State Tests** (`tests/renderer/adminRenderer.test.tsx`)
  - Use React Testing Library
  - Test state transitions (not visuals):
    - Create record → appears in data array
    - Edit record → updates existing record
    - Delete record → removed from data array
    - Filter application → data filtered correctly
  - Test CRUD operation callbacks
  - **Why**: Renderer state integrity, not styling correctness

### Tier 3: AI Output Contract Evaluation

1. **AI Eval Tests** (`tests/ai/aiEval.test.ts`)
  - Test AI output validity + schema contract compliance
  - Strategy: Fixture payload → AI → UISpec → validate with Zod
  - Test payload scenarios:
    - Simple object
    - Enum-like structure
    - Edge-case data
    - Slightly malformed input
  - Pass conditions:
    - Valid UISpec produced
    - Logical constraints satisfied (table has columns, form fields exist, enum fields contain options)
  - **Stability strategy**: Use recorded fixtures (`tests/ai/fixtures/`) for stable automated testing, allow retry logic for live AI tests
  - **Why**: Ensure AI cannot break rendering

### Test Configuration

- Vitest config for Next.js compatibility
- Setup file for Jest DOM matchers
- Test utilities for common patterns
- CI-ready test scripts

### Success Criteria

- All Tier 1 tests pass (schema validation, inference, fallback)
- Renderer state tests verify CRUD operations
- AI eval tests validate contract compliance
- Tests run fast and reliably
- Demo cannot silently break

## Phase 4: UX Polish

### User Experience

1. **Main Page Layout** (`app/page.tsx`)
  - Hero section with value proposition
  - Input section: JSON textarea, intent textarea (optional)
  - Action buttons: "Parse JSON", "Generate with AI"
  - Generated UI section (AdminRenderer)
  - Clear/reset functionality
2. **Loading States**
  - Spinner during AI generation
  - Skeleton loaders for table
3. **Error Handling**
  - Invalid JSON error messages
  - AI API error messages
  - Validation error display
4. **Regenerate Flow**
  - "Regenerate" button after initial generation
  - Preserves current data
  - Allows intent modification
5. **Visual Polish**
  - Consistent spacing and typography
  - Responsive layout
  - Clear visual hierarchy
  - Success/error feedback

### Success Criteria

- Intuitive user flow
- Clear feedback for all actions
- Professional appearance
- Works on mobile/tablet

## Phase 5: Stabilization

### Edge Cases & Testing

1. **Edge Cases**
  - Empty payloads
  - Null/undefined values
  - Very large payloads
  - Nested objects (flatten or handle)
  - Special characters in field names
  - Missing required fields in data
2. **Error Boundaries**
  - React error boundaries
  - Graceful degradation
3. **Performance**
  - Large table virtualization (if needed)
  - Debounced filters
  - Memoized components
4. **Demo Preparation**
  - Sample payloads for demo
  - Clear demo script/narrative
  - Test all user flows
  - Verify Vercel deployment
5. **Documentation**
  - README with setup instructions
  - Demo payload examples
  - Architecture overview

### Success Criteria

- Handles edge cases gracefully
- Stable demo flow
- Clear magic moment demonstration
- Ready for presentation

## Key Files to Create

### Configuration

- `package.json` - Dependencies
- `tsconfig.json` - TypeScript config
- `tailwind.config.ts` - Tailwind setup
- `components.json` - shadcn/ui config
- `vitest.config.ts` - Vitest configuration
- `.env.example` - Environment template

### Core Types & Schema

- `lib/spec/schema.ts` - Zod validation schema
- `lib/spec/types.ts` - TypeScript types
- `types/index.ts` - Shared types

### Components

- `components/admin/AdminRenderer.tsx` - Main controller
- `components/admin/DataTable.tsx` - Table view
- `components/admin/FormModal.tsx` - Create/edit form
- `components/admin/FiltersPanel.tsx` - Filter controls

### AI & Inference

- `lib/ai/client.ts` - OpenAI client
- `lib/ai/prompt.ts` - Prompt templates
- `lib/inference/payload-parser.ts` - JSON analysis
- `app/api/generate-ui/route.ts` - API endpoint

### Pages

- `app/page.tsx` - Main landing page
- `app/layout.tsx` - Root layout
- `styles/globals.css` - Global styles

### Tests

- `tests/spec/uiSpecSchema.test.ts` - Schema validation tests
- `tests/spec/fallbackGenerator.test.ts` - Fallback generator tests
- `tests/inference/inferFields.test.ts` - Field inference tests
- `tests/renderer/adminRenderer.test.tsx` - Renderer state tests
- `tests/ai/aiEval.test.ts` - AI output contract tests
- `tests/ai/fixtures/` - Recorded AI outputs for stable testing
- `tests/setup.ts` - Test setup file (Jest DOM matchers)

## Implementation Order

1. **Phase 0**: Complete project setup, dependencies, folder structure, testing setup
2. **Phase 1**: Build renderer with hardcoded spec, verify CRUD works
3. **Phase 2**: Add JSON parsing, deterministic spec generation
4. **Phase 3**: Integrate OpenAI API, add validation and fallback
5. **Phase 3.5**: Add reliability guardrails - write and run all tests
6. **Phase 4**: Polish UX, add loading states, error handling
7. **Phase 5**: Handle edge cases, verify all tests pass, prepare demo, deploy

## Success Metrics

- ✅ Paste JSON payload → working admin UI appears
- ✅ All CRUD operations functional
- ✅ Filters work correctly
- ✅ AI generates valid specs
- ✅ All tests pass (schema validation, inference, renderer, AI contract)
- ✅ Stable demo flow
- ✅ Clear "magic moment" for users
- ✅ Testing demonstrates engineering rigor and AI output validation discipline

