---
name: AI Admin UI Implementation Plan
overview: "Complete implementation plan for the AI Admin UI MVP with testing checkpoints at each phase. Builds incrementally: schema/types → renderer components → payload inference → AI integration → UX polish → stabilization."
todos:
  - id: phase1-schema
    content: "Phase 1: Create UI spec Zod schema, TypeScript types, and sample spec. CHECKPOINT: Schema validation works, types compile, sample spec passes."
    status: pending
  - id: phase2-renderer
    content: "Phase 2: Build AdminRenderer, DataTable, FormModal, FiltersPanel components. CHECKPOINT: Full CRUD flow works with hardcoded spec, all field types render correctly."
    status: pending
  - id: phase3-inference
    content: "Phase 3: Implement payload parser and spec generator. CHECKPOINT: JSON parsing works, type inference correct, inferred specs render working UI."
    status: pending
  - id: phase4-ai
    content: "Phase 4: Integrate OpenAI API with prompt templates, API route, validation, retry logic, and fallback. CHECKPOINT: AI generates valid specs, fallback works, intent influences generation."
    status: pending
  - id: phase35-testing
    content: "Phase 3.5: Set up Vitest, write Tier 1-3 tests (schema validation, inference, fallback, renderer state, AI contract eval with fixtures). CHECKPOINT: All tests pass, demo cannot silently break."
    status: pending
  - id: phase5-ux
    content: "Phase 5: Polish main page layout, add loading states, error handling, regenerate flow, visual polish. CHECKPOINT: Professional UI, responsive, clear feedback, all flows intuitive."
    status: pending
  - id: phase6-edge-cases
    content: "Phase 6: Handle edge cases, optimize performance, prepare demo materials and script. CHECKPOINT: Edge cases handled, demo flow works end-to-end, Vercel deployment verified."
    status: pending
isProject: false
---

# AI Admin UI Implementation Plan

## Current State

- ✅ Next.js project initialized with TypeScript and App Router
- ✅ Dependencies installed (shadcn/ui, TanStack Table, React Hook Form, Zod, OpenAI SDK)
- ✅ Folder structure created
- ✅ GitHub repository connected
- ✅ Vercel deployment configured
- ✅ OpenAI API key configured
- ❌ No implementation code yet (components/admin only has .gitkeep files)

## Implementation Strategy

Build incrementally with **testing checkpoints** after each major phase. Each checkpoint ensures the foundation is solid before moving forward.

## Testing Philosophy

Following the MVP testing strategy, we focus on **demo-critical boundaries** rather than exhaustive coverage. The goal is high-leverage reliability that prevents demo failures.

**Guiding principle**: Test what could break the demo.

**Testing Tiers**:

- **Tier 1**: Deterministic Unit Tests (schema validation, inference logic, fallback generator)
- **Tier 2**: Renderer Behavior Tests (state transitions, not visuals)
- **Tier 3**: AI Output Contract Evaluation (fixture-based validation)

**What We Skip** (MVP scope):

- Visual regression tests
- End-to-end browser automation
- Snapshot-heavy UI testing
- AI benchmarking suites

**Test Stack**: Vitest + React Testing Library + Jest DOM matchers

---

## Phase 1: Schema & Types Foundation

**Goal**: Define the UI spec contract with Zod validation and TypeScript types.

### Tasks

1. **Create UI Spec Schema** (`lib/spec/schema.ts`)
  - Define Zod schema matching blueprint spec:
    - Entity name (string)
    - Fields array with: name, label, type (`string | number | boolean | enum`), required, options (optional for enum)
    - Table config (columns array referencing field names)
    - Form config (field order)
    - Filters array (field names)
  - Export schema for validation
2. **Create TypeScript Types** (`lib/spec/types.ts`)
  - Export TypeScript types from Zod schema using `z.infer`
  - Export `UISpec`, `Field`, `TableConfig`, `FormConfig` types
  - Ensure type safety throughout the app
3. **Create Sample Spec** (`lib/spec/sample-spec.ts`)
  - Hardcoded demo spec for testing (e.g., "User" entity)
  - Sample fields: id (number), name (string), email (string), role (enum: admin/user), active (boolean)
  - Sample data array (3-5 records)
  - Export both spec and sample data

### 🛑 CHECKPOINT 1: Schema Validation

**Test Requirements:**

- Schema validates correct UISpec structure
- Schema rejects invalid specs (missing fields, wrong types, enum without options)
- TypeScript types compile correctly
- Sample spec passes validation
- Can import and use types in other files

**Manual Test:**

- Create a test file that validates the sample spec
- Verify TypeScript autocomplete works with UISpec type

---

## Phase 2: Renderer Components

**Goal**: Build the core CRUD UI components that render from a UI spec.

### Tasks

1. **Install shadcn/ui Components**
  - Install required components: Button, Input, Select, Dialog, Label, Badge, Table, Tabs
  - Verify components render correctly
2. **AdminRenderer Component** (`components/admin/AdminRenderer.tsx`)
  - Main state controller component
  - Props: `spec: UISpec`, `initialData?: Record<string, any>[]`
  - State management:
    - `data`: array of records
    - `selectedRecord`: for editing
    - `filters`: filter values object
    - `isCreateModalOpen`: boolean
    - `isEditModalOpen`: boolean
  - CRUD handlers:
    - `handleCreate(record)`: add to data array
    - `handleUpdate(id, record)`: update existing record
    - `handleDelete(id)`: remove from data array
    - `handleFilter(filters)`: apply filters to displayed data
  - Renders: DataTable, FormModal (create/edit), FiltersPanel
3. **DataTable Component** (`components/admin/DataTable.tsx`)
  - Uses TanStack Table (`@tanstack/react-table`)
  - Props: `data`, `spec`, `onEdit`, `onDelete`
  - Dynamic column generation from spec.fields
  - Type-specific cell rendering:
    - `string`: text display
    - `number`: numeric formatting
    - `boolean`: Badge component (Active/Inactive)
    - `enum`: Label with value
  - Action column: Edit button, Delete button
  - Supports sorting (TanStack Table built-in)
  - Uses shadcn/ui Table components
4. **FormModal Component** (`components/admin/FormModal.tsx`)
  - Uses React Hook Form + Zod validation
  - Props: `spec`, `isOpen`, `onClose`, `onSubmit`, `initialValues?` (for edit mode)
  - Dynamic form generation from spec.fields
  - Field type mapping:
    - `string`: Input component
    - `number`: Input with type="number"
    - `boolean`: Toggle/Switch component
    - `enum`: Select component with options
  - Validation: required fields enforced via Zod schema generated from spec
  - Create mode: empty form
  - Edit mode: pre-filled with initialValues
  - Submit calls `onSubmit` with form data
5. **FiltersPanel Component** (`components/admin/FiltersPanel.tsx`)
  - Props: `spec`, `filters`, `onFilterChange`
  - Renders filter inputs for fields in `spec.filters`
  - Type-specific filter inputs:
    - `string`: Search input (text match)
    - `number`: Min/Max number inputs
    - `boolean`: Select dropdown (All/True/False)
    - `enum`: Select dropdown with all options
  - Applies filters and calls `onFilterChange` with filter values object
6. **Main Page Integration** (`app/page.tsx`)
  - Replace default Next.js template
  - Import sample spec and data
  - Render AdminRenderer with hardcoded spec
  - Basic layout: header, AdminRenderer component

### 🛑 CHECKPOINT 2: Renderer Functionality

**Test Requirements:**

- Page loads without errors
- Table displays sample data correctly
- All field types render properly (string, number, boolean, enum)
- Create button opens modal
- Create form submits and adds record to table
- Edit button opens modal with pre-filled data
- Edit form submits and updates record in table
- Delete button removes record from table
- Filters apply correctly (string search, number range, boolean/enum select)
- Table sorting works
- Form validation works (required fields)

**Manual Test:**

- Run `npm run dev`
- Navigate to localhost:3000
- Test full CRUD flow with sample data
- Verify all field types display correctly
- Test filtering with different field types

---

## Phase 3: Payload Inference

**Goal**: Parse JSON payloads and generate UI specs deterministically (without AI).

### Tasks

1. **Payload Parser** (`lib/inference/payload-parser.ts`)
  - Function: `parsePayload(payload: unknown): ParsedStructure`
  - Handles:
    - Array of objects → uses first element structure
    - Single object → uses object structure
    - Nested objects → flattens (prefix with parent key, e.g., `user.name`)
  - Type inference logic:
    - `string`: typeof value === 'string'
    - `number`: typeof value === 'number'
    - `boolean`: typeof value === 'boolean'
    - `enum`: if limited distinct values (≤5 unique values) → enum with options array
  - Field label generation: camelCase → Title Case (e.g., `firstName` → `First Name`)
2. **Spec Generator** (`lib/inference/spec-generator.ts`)
  - Function: `generateSpec(parsed: ParsedStructure, entityName?: string): UISpec`
  - Converts parsed structure to validated UISpec
  - Defaults:
    - Entity name: provided or "Entity"
    - Table columns: all fields
    - Form fields: all fields in order
    - Filters: all string and number fields
  - Validates output with Zod schema before returning
3. **Fallback Generator** (`lib/inference/fallback-generator.ts`)
  - Function: `generateFallbackSpec(payload: unknown): UISpec`
  - Used when AI fails or payload is invalid
  - Same logic as spec generator but with error handling
  - Always returns valid UISpec (never throws)
4. **UI Integration** (`app/page.tsx`)
  - Add JSON input textarea
  - Add "Parse JSON" button
  - Parse JSON on button click
  - Show inferred spec preview (read-only, formatted JSON)
  - Add "Generate UI" button that uses inferred spec
  - Error handling: invalid JSON shows error message

### 🛑 CHECKPOINT 3: Payload Inference

**Test Requirements:**

- Parse simple object → generates valid spec
- Parse array → uses first element structure
- Type inference works (string, number, boolean, enum detection)
- Nested objects flatten correctly
- Generated spec passes Zod validation
- Invalid JSON shows error (doesn't crash)
- Empty payload handled gracefully
- Inferred spec renders working UI

**Manual Test:**

- Paste various JSON payloads:
  - Simple object: `{ "name": "John", "age": 30, "active": true }`
  - Array: `[{ "id": 1, "name": "Alice" }, { "id": 2, "name": "Bob" }]`
  - With enums: `[{ "role": "admin" }, { "role": "user" }]`
- Verify inferred spec is correct
- Verify UI renders from inferred spec

---

## Phase 4: AI Integration

**Goal**: Integrate OpenAI API to generate UI specs from payloads with natural language intent.

### Tasks

1. **OpenAI Client** (`lib/ai/client.ts`)
  - Initialize OpenAI client with API key from env
  - Export client instance
  - Error handling for missing API key
2. **Prompt Template** (`lib/ai/prompt.ts`)
  - System prompt: Explains UI spec schema, constraints, field types
  - User prompt template: Includes payload JSON, optional intent, optional existing spec
  - Request JSON-only response matching UISpec schema
  - Include examples in prompt
3. **API Route** (`app/api/generate-ui/route.ts`)
  - POST endpoint
  - Request body: `{ payload: unknown, intent?: string, existingSpec?: UISpec }`
  - Steps:
  1. Call OpenAI API with prompt
  2. Parse JSON response
  3. Validate against Zod schema
  4. Retry logic: max 2 retries on validation failure (with adjusted prompt)
  5. Fallback: if AI fails after retries → use deterministic parser
    sponse: `{ spec: UISpec, source: 'ai' | 'fallback' }`
    ror handling: return error response with message
4. **Frontend Integration** (`app/page.tsx`)
  - Add "Generate with AI" button
  - Add optional "Intent" textarea (natural language instructions)
  - Loading state during AI generation (spinner/disabled button)
  - Error display for API errors
  - Success: use generated spec in AdminRenderer
  - Show source indicator ("Generated by AI" or "Fallback")

### 🛑 CHECKPOINT 4: AI Integration

**Test Requirements:**

- API route handles valid requests
- AI generates valid spec (passes Zod validation)
- Invalid AI response triggers retry
- Fallback works when AI fails
- Intent influences spec generation (test with different intents)
- Loading states display correctly
- Error messages show for API failures
- Generated spec renders working UI

**Manual Test:**

- Test with various payloads and intents:
  - Simple payload: `[{ "name": "Test", "value": 100 }]`
  - With intent: "Make name field searchable and hide value field from table"
  - Invalid payload → fallback should work
- Verify AI-generated specs are logical and valid
- Test error scenarios (network error, invalid API key)

---

## Phase 3.5: Reliability Guardrails (Testing)

**Goal**: Add automated tests to protect demo-critical boundaries. This phase ensures AI cannot break rendering and renderer logic remains stable.

### Testing Philosophy

Focus on **demo-critical boundaries** - test what could break the demo. Not exhaustive coverage, but high-leverage reliability.

### Tasks

1. **Test Setup** (`vitest.config.ts`, `tests/setup.ts`)
  - Configure Vitest for Next.js compatibility
  - Set up React Testing Library
  - Configure Jest DOM matchers
  - Add test scripts to `package.json`: `test`, `test:watch`, `test:ui`
2. **Tier 1: Deterministic Unit Tests** (Required)
  **UISpec Schema Validation Tests** (`tests/spec/uiSpecSchema.test.ts`)
  - Test invalid specs are rejected:
    - Missing required fields (entity, fields, table, form, filters)
    - Invalid field types (not in allowed set)
    - Enum fields without options array
    - Broken table/form field references (references non-existent field names)
  - Test valid specs are accepted
  - **Why**: Schema failure = renderer crash = demo failure
   **Field Inference Logic Tests** (`tests/inference/inferFields.test.ts`)
  - Test payload → inferred field types:
    - `{ name: "Alice" }` → string type
    - `{ age: 42 }` → number type
    - `{ active: true }` → boolean type
    - Enum detection: limited distinct values (≤5) → enum with options array
  - Test array handling (uses first element structure)
  - Test nested object flattening (prefix with parent key)
  - **Why**: Ensures deterministic inference pipeline stability
   **Fallback Spec Generator Tests** (`tests/spec/fallbackGenerator.test.ts`)
  - Test fallback always produces valid UISpec
  - Test consistent field references (table/form/filters reference existing fields)
  - Test default table/form/filter configs
  - Test edge cases: empty payload, null values, invalid JSON
  - **Why**: Demo safety net when AI output fails
3. **Tier 2: Renderer Behavior Tests** (Lightweight)
  **AdminRenderer State Tests** (`tests/renderer/adminRenderer.test.tsx`)
  - Use React Testing Library
  - Test state transitions (not visuals):
    - Create record → appears in data array
    - Edit record → updates existing record
    - Delete record → removed from data array
    - Filter application → data filtered correctly
  - Test CRUD operation callbacks
  - **Why**: Renderer state integrity, not styling correctness
4. **Tier 3: AI Output Contract Evaluation**
  **AI Eval Tests** (`tests/ai/aiEval.test.ts`)
  - Test AI output validity + schema contract compliance
  - Strategy: Fixture payload → AI → UISpec → validate with Zod
  - Test payload scenarios:
    - Simple object
    - Enum-like structure
    - Edge-case data
    - Slightly malformed input
  - Pass conditions:
    - Valid UISpec produced (passes Zod validation)
    - Logical constraints satisfied:
      - Table has columns (references existing fields)
      - Form fields exist (references existing fields)
      - Enum fields contain options array
  - **Stability Strategy**: Use recorded fixtures (`tests/ai/fixtures/`) for stable automated testing
    - Record successful AI outputs as JSON fixtures
    - Replay fixtures during automated tests (fast, stable)
    - Allow retry logic for live AI tests (optional, slower)
  - **Why**: Ensure AI cannot break rendering

### 🛑 CHECKPOINT 3.5: Reliability Guardrails

**Test Requirements:**

- All Tier 1 tests pass (schema validation, inference, fallback)
- Renderer state tests verify CRUD operations
- AI eval tests validate contract compliance (using fixtures)
- Tests run fast and reliably
- Demo cannot silently break

**Manual Test:**

- Run test suite: `npm test`
- Verify all tests pass
- Test suite runs in < 10 seconds (fast iteration)
- Verify fixture-based AI tests are stable

---

## Phase 5: UX Polish & Error Handling

**Goal**: Improve user experience, add loading states, error boundaries, and polish the UI.

### Tasks

1. **Main Page Layout** (`app/page.tsx`)
  - Hero section: Value proposition ("Paste backend data → instantly get a usable admin UI")
  - Input section:
    - JSON textarea with placeholder example
    - Intent textarea (optional, collapsible)
    - Action buttons: "Parse JSON", "Generate with AI"
  - Generated UI section: AdminRenderer (only shown after generation)
  - Clear/Reset button
  - Better spacing and typography
2. **Loading States**
  - Spinner component during AI generation
  - Disabled buttons during processing
  - Skeleton loader for table (if needed)
3. **Error Handling**
  - Error boundary component (React Error Boundary)
  - User-friendly error messages:
    - Invalid JSON: "Invalid JSON format. Please check your input."
    - API error: "Failed to generate UI. Using fallback parser."
    - Validation error: "Generated spec is invalid. Using fallback."
  - Error display component (toast or inline)
4. **Regenerate Flow**
  - "Regenerate" button after initial generation
  - Preserves current data (optional: ask user if they want to keep data)
  - Allows intent modification
  - Shows loading state during regeneration
5. **Visual Polish**
  - Consistent spacing (Tailwind utilities)
  - Responsive layout (mobile-friendly)
  - Clear visual hierarchy
  - Success/error feedback (toasts or banners)
  - Dark mode support (if shadcn/ui supports it)

### 🛑 CHECKPOINT 5: UX & Polish

**Test Requirements:**

- Page layout looks professional
  - Responsive on mobile/tablet
  - Clear visual hierarchy
  - Loading states work correctly
  - Error messages are user-friendly
  - Regenerate flow works
  - All user flows are intuitive

**Manual Test:**

- Test on different screen sizes
- Test error scenarios and verify messages
- Test regenerate flow
- Verify all interactions feel smooth

---

## Phase 6: Edge Cases & Demo Preparation

**Goal**: Handle edge cases and prepare for demo presentation.

### Tasks

1. **Edge Case Handling**
  - Empty payloads → graceful fallback
  - Null/undefined values → handled in parser
  - Very large payloads → performance optimization (if needed)
  - Special characters in field names → sanitization
  - Missing required fields → validation errors
  - Malformed JSON → clear error messages
2. **Error Boundaries**
  - React Error Boundary component
  - Graceful degradation on renderer errors
  - User-friendly error messages
3. **Performance Optimization**
  - Large table virtualization (if needed, TanStack Table supports this)
  - Debounced filters (if needed)
  - Memoized components (React.memo where beneficial)
4. **Demo Preparation**
  - Create sample payloads for demo:
    - Simple: `[{ "name": "Product", "price": 29.99, "inStock": true }]`
    - Complex: `[{ "id": 1, "user": { "name": "Alice" }, "role": "admin", "active": true }]`
    - Enum-rich: `[{ "status": "pending" }, { "status": "approved" }, { "status": "rejected" }]`
  - Demo script/narrative:
    - Opening: "Backend engineers waste hours building internal UIs"
    - Magic moment: Paste JSON → working admin UI appears
    - Show CRUD operations
    - Show filtering
    - Show AI generation with intent
  - Verify all flows work end-to-end
  - Test Vercel deployment
5. **Documentation**
  - Update README with demo examples
  - Add architecture overview (if needed)
  - Document testing approach (reference testing strategy)

### 🛑 CHECKPOINT 6: Edge Cases & Demo

**Test Requirements:**

- Edge cases handled gracefully (no crashes)
- Performance acceptable (large payloads render smoothly)
- Demo flow works end-to-end
- Vercel deployment works
- Demo script ready
- All tests still pass

**Manual Test:**

- Test all edge cases manually
- Run demo script end-to-end
- Verify deployment on Vercel
- Test with various payloads
- Verify error messages are user-friendly

---

## File Structure Reference

```
app/
  page.tsx                    # Main landing page
  api/generate-ui/route.ts    # AI generation endpoint
  layout.tsx                   # Root layout

components/
  admin/
    AdminRenderer.tsx         # Main state controller
    DataTable.tsx              # Table view component
    FormModal.tsx              # Create/edit form
    FiltersPanel.tsx           # Filter controls
  ui/                         # shadcn/ui components

lib/
  spec/
    schema.ts                 # Zod validation schema
    types.ts                  # TypeScript types
    sample-spec.ts            # Hardcoded demo spec
  ai/
    client.ts                 # OpenAI client
    prompt.ts                 # Prompt templates
  inference/
    payload-parser.ts         # JSON parsing logic
    spec-generator.ts         # Spec generation
    fallback-generator.ts     # Fallback logic

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
    fixtures/                  # Recorded AI outputs for stable testing
      simple-object.json
      enum-structure.json
      edge-case.json
  setup.ts                    # Test configuration

types/
  index.ts                    # Shared types
```

## Success Criteria

- ✅ Paste JSON payload → working admin UI appears
- ✅ All CRUD operations functional
- ✅ Filters work correctly
- ✅ AI generates valid specs
- ✅ Fallback works when AI fails
- ✅ All tests pass (Tier 1-3: schema validation, inference, fallback, renderer state, AI contract eval)
- ✅ Demo cannot silently break (testing protects demo-critical boundaries)
- ✅ Stable demo flow
- ✅ Clear "magic moment" for users

## Testing Strategy Reference

This plan incorporates the testing strategy from `.cursor/mvp_testing_strategy.md`. Key principles:

- **Focus**: Demo-critical boundaries, not exhaustive coverage
- **Philosophy**: Test what could break the demo
- **Three Tiers**: Deterministic unit tests → Renderer behavior → AI contract evaluation
- **Stability**: Use fixtures for AI eval tests to ensure fast, stable validation
- **Skip**: Visual regression, E2E automation, snapshot-heavy UI testing (not needed for MVP)

## Implementation Order

1. **Phase 1**: Schema & Types → **CHECKPOINT 1**
2. **Phase 2**: Renderer Components → **CHECKPOINT 2**
3. **Phase 3**: Payload Inference → **CHECKPOINT 3**
4. **Phase 4**: AI Integration → **CHECKPOINT 4**
5. **Phase 3.5**: Reliability Guardrails (Testing) → **CHECKPOINT 3.5** ⚠️ Critical: Prevents demo failures
6. **Phase 5**: UX Polish → **CHECKPOINT 5**
7. **Phase 6**: Edge Cases & Demo Preparation → **CHECKPOINT 6**

Each checkpoint must pass before proceeding to the next phase.

**Note**: Phase 3.5 (Reliability Guardrails) is strategically placed after AI integration to ensure AI output validation is in place before UX polish. This protects the demo from breaking silently.