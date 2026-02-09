# Architecture Overview

This document provides a high-level overview of the RapidUI.dev architecture, components, and data flow.

## System Overview

RapidUI.dev is a Next.js application that transforms JSON payloads into working admin interfaces. It uses AI (OpenAI) to generate UI specifications, with deterministic fallbacks for reliability.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User Input                           │
│              (JSON Payload + Optional Prompt)                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Parsing & Inference                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Payload    │  │     AI       │  │  Fallback    │    │
│  │   Parser     │→ │  Generator   │→ │  Generator   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    UI Specification                         │
│              (Validated with Zod Schema)                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Renderer Components                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Admin      │  │   Data       │  │    Form      │    │
│  │  Renderer    │→ │   Table      │  │    Modal     │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│  ┌──────────────┐                                          │
│  │  Filters     │                                          │
│  │   Panel      │                                          │
│  └──────────────┘                                          │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Schema & Types (`lib/spec/`)

**Purpose**: Define the UI specification contract

- **`schema.ts`**: Zod schema for validating UI specs
- **`types.ts`**: TypeScript types inferred from Zod schema
- **Key Types**:
  - `UISpec`: Complete UI specification
  - `Field`: Field definition (name, label, type, required, options)
  - `TableConfig`: Table column configuration
  - `FormConfig`: Form field configuration

**Validation Rules**:
- All field references must exist
- Enum fields must have options array
- At least one field required
- Table/form must have at least one field

### 2. Payload Inference (`lib/inference/`)

**Purpose**: Parse JSON payloads and generate UI specs deterministically

- **`payload-parser.ts`**: 
  - Parses JSON payloads (arrays or single objects)
  - Flattens nested objects (e.g., `user.name` → "User Name")
  - Infers field types (string, number, boolean, enum)
  - Detects enums (≤5 distinct values)
  - Handles null/undefined values

- **`spec-generator.ts`**:
  - Converts parsed structure to validated UISpec
  - Sets defaults (all fields in table/form, string/number fields filterable)
  - Validates output with Zod schema

- **`fallback-generator.ts`**:
  - Always returns valid UISpec (never throws)
  - Used when parsing fails or payload is invalid
  - Provides minimal valid spec as safety net

**Edge Cases Handled**:
- Empty arrays → Error with helpful message
- Empty objects → Error with helpful message
- Null/undefined values → Filtered out, defaults to string type
- Special characters → Sanitized in labels (names preserved for data access)
- Invalid payloads → Fallback generator ensures valid spec

### 3. AI Integration (`lib/ai/`)

**Purpose**: Generate UI specs using OpenAI with natural language customization

- **`client.ts`**: OpenAI client initialization
- **`prompt.ts`**: System and user prompt templates
  - System prompt: Explains UI spec schema and constraints
  - User prompt: Includes payload, optional intent, examples
  - Request JSON-only response format

**API Route** (`app/api/generate-ui/route.ts`):
- POST endpoint for AI generation
- Retry logic (max 2 retries on validation failure)
- Fallback to deterministic parser if AI fails
- Returns `{ spec: UISpec, source: 'ai' | 'fallback' }`

**Error Handling**:
- Invalid JSON response → Retry with enhanced prompt
- API errors → Fallback to deterministic parser
- Validation failures → Retry with error feedback

### 4. Renderer Components (`components/admin/`)

**Purpose**: Render UI from UISpec

- **`AdminRenderer.tsx`**: 
  - Main state controller
  - Manages data, filters, modals
  - CRUD handlers (create, update, delete)
  - Filtering logic

- **`DataTable.tsx`**:
  - Uses TanStack Table for sorting/pagination
  - Dynamic column generation from spec
  - Type-specific cell rendering (string, number, boolean, enum)
  - Action buttons (Edit, Delete)

- **`FormModal.tsx`**:
  - Uses React Hook Form + Zod validation
  - Dynamic form generation from spec
  - Type-specific inputs (Input, Select, Switch)
  - Create/Edit modes

- **`FiltersPanel.tsx`**:
  - Type-specific filter inputs
  - String search, number range, boolean/enum select
  - Applies filters to displayed data

### 5. Main Page (`app/page.tsx`)

**Purpose**: User interface for input and generation

**Features**:
- JSON input textarea
- Optional prompt textarea (collapsible)
- "Try Example" button (random examples)
- "Try Prompt" button (random prompts)
- "Parse JSON" button (deterministic)
- "Generate with AI" button (AI-powered)
- Loading states
- Error handling with toasts
- Spec preview (collapsible)
- Generated UI display

**State Management**:
- `jsonInput`: Raw JSON string
- `prompt`: Optional natural language instructions
- `inferredSpec`: Generated UI spec
- `parsedData`: Parsed data array
- `specSource`: Generation method (ai/fallback/deterministic)
- Loading states (isGenerating, isParsing)

### 6. Error Handling

**Error Boundary** (`components/ErrorBoundary.tsx`):
- Catches React rendering errors
- User-friendly error display
- "Try Again" button for recovery

**Error Handling Strategy**:
- **Parsing errors**: User-friendly messages with fallback option
- **AI errors**: Fallback to deterministic parser
- **Validation errors**: Clear messages with retry option
- **Rendering errors**: Error boundary catches and displays

## Data Flow

### Generation Flow

1. **User Input**: JSON payload + optional prompt
2. **Parse JSON**: Validate JSON syntax
3. **AI Generation** (if requested):
   - Call OpenAI API with payload + prompt
   - Parse and validate response
   - Retry on validation failure (max 2 retries)
   - Fallback to deterministic parser if AI fails
4. **Deterministic Parsing** (if AI not used or failed):
   - Parse payload structure
   - Infer field types
   - Generate spec with defaults
5. **Validation**: Validate spec with Zod schema
6. **Rendering**: Render UI components from spec

### CRUD Flow

1. **Create**: Form submission → Add to data array
2. **Read**: Display data in table (with filtering)
3. **Update**: Form submission → Update data array
4. **Delete**: Remove from data array

**Note**: Currently operates on client-side state. Ready for backend integration.

## Technology Stack

- **Framework**: Next.js 16 (App Router)
- **UI Library**: shadcn/ui + Tailwind CSS
- **Table**: TanStack Table (sorting, pagination)
- **Forms**: React Hook Form + Zod validation
- **AI**: OpenAI SDK (gpt-4o-mini)
- **Type Safety**: TypeScript + Zod
- **Error Handling**: react-error-boundary
- **Notifications**: Sonner (toasts)

## Key Design Decisions

1. **Zod Validation**: Ensures UI specs are always valid, preventing renderer crashes
2. **Fallback Strategy**: Always generates valid spec, even for edge cases
3. **Deterministic First**: Deterministic parser as fallback ensures reliability
4. **Type Inference**: Smart detection of enums, nested objects, field types
5. **Error Boundaries**: Graceful degradation on rendering errors
6. **Client-Side State**: CRUD operations work immediately, ready for backend integration

## File Structure

```
app/
  page.tsx                    # Main landing page
  api/generate-ui/route.ts   # AI generation endpoint
  layout.tsx                  # Root layout

components/
  admin/
    AdminRenderer.tsx         # Main state controller
    DataTable.tsx             # Table view component
    FormModal.tsx             # Create/edit form
    FiltersPanel.tsx          # Filter controls
  ui/                         # shadcn/ui components
  ErrorBoundary.tsx           # Error boundary component

lib/
  spec/
    schema.ts                 # Zod validation schema
    types.ts                 # TypeScript types
  ai/
    client.ts                # OpenAI client
    prompt.ts                # Prompt templates
  inference/
    payload-parser.ts        # JSON parsing logic
    spec-generator.ts        # Spec generation
    fallback-generator.ts    # Fallback logic
  examples.ts                # Example payloads and prompts

docs/
  ARCHITECTURE.md            # This file
  TESTING.md                 # Testing documentation
```

## Future Enhancements

- Backend integration (API calls for CRUD operations)
- Persistence (localStorage or database)
- Export/import functionality
- Custom field types
- Advanced filtering (date ranges, complex queries)
- Performance optimization (virtualization for large tables)
- Multi-entity support
- Authentication and authorization
