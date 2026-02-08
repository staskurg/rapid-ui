# Testing Strategy

This document outlines the testing approach, philosophy, and implementation for the AI Admin UI Generator.

## Testing Philosophy

Following the **MVP testing strategy**, we focus on **demo-critical boundaries** rather than exhaustive coverage. The goal is high-leverage reliability that prevents demo failures.

**Guiding Principle**: Test what could break the demo.

### What We Test

- **Schema Validation**: Ensures UI specs are always valid (prevents renderer crashes)
- **Inference Logic**: Ensures deterministic parsing works correctly
- **Fallback Generator**: Ensures valid specs even for edge cases
- **Renderer State**: Ensures CRUD operations work correctly
- **AI Contract**: Ensures AI output is valid and usable

### What We Skip (MVP Scope)

- Visual regression tests
- End-to-end browser automation
- Snapshot-heavy UI testing
- AI benchmarking suites
- Performance profiling (for MVP)

## Testing Tiers

### Tier 1: Deterministic Unit Tests

**Purpose**: Test core logic that must work correctly

**Test Files**:
- `tests/spec/uiSpecSchema.test.ts`: Schema validation
- `tests/inference/inferFields.test.ts`: Field inference logic
- `tests/spec/fallbackGenerator.test.ts`: Fallback generator

**Coverage**:
- ✅ Schema rejects invalid specs (missing fields, wrong types, broken references)
- ✅ Schema accepts valid specs
- ✅ Type inference works (string, number, boolean, enum detection)
- ✅ Array handling (uses first element structure)
- ✅ Nested object flattening
- ✅ Fallback always produces valid spec
- ✅ Edge cases handled (empty payloads, null values, invalid JSON)

**Why**: These tests protect against renderer crashes and ensure the foundation is solid.

### Tier 2: Renderer Behavior Tests

**Purpose**: Test state transitions and CRUD operations

**Test File**: `tests/renderer/adminRenderer.test.tsx`

**Coverage**:
- ✅ Create record → appears in data array
- ✅ Edit record → updates existing record
- ✅ Delete record → removed from data array
- ✅ Filter application → data filtered correctly
- ✅ CRUD operation callbacks work

**Why**: Ensures renderer state integrity, not styling correctness. Uses React Testing Library for component testing.

### Tier 3: AI Output Contract Evaluation

**Purpose**: Ensure AI output is valid and usable

**Test File**: `tests/ai/aiEval.test.ts`

**Strategy**: Fixture-based validation
- Record successful AI outputs as JSON fixtures
- Replay fixtures during automated tests (fast, stable)
- Validate fixtures against schema and logical constraints

**Coverage**:
- ✅ AI output passes Zod validation
- ✅ Field references are valid (table/form/filters reference existing fields)
- ✅ Enum fields have options array
- ✅ Logical constraints satisfied

**Why**: Ensures AI cannot break rendering. Fixtures provide stability for automated testing.

## Test Stack

- **Vitest**: Fast test runner with Next.js compatibility
- **React Testing Library**: Component testing utilities
- **Jest DOM Matchers**: DOM assertion helpers
- **Zod**: Schema validation (used in tests)

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui
```

## Test Structure

```
tests/
  examples/                   # Manual test examples
    TEST_EXAMPLES.md
    EDGE_CASE_EXAMPLES.md
  spec/
    uiSpecSchema.test.ts        # Schema validation tests
    fallbackGenerator.test.ts   # Fallback generator tests
  inference/
    inferFields.test.ts         # Field inference tests
  renderer/
    adminRenderer.test.tsx      # Renderer state tests
  ai/
    aiEval.test.ts              # AI contract evaluation
    fixtures/                    # Recorded AI outputs
      simple-object.json
      enum-structure.json
      edge-case.json
  setup.ts                      # Test configuration
```

## Manual Testing

For manual testing of the UI with example payloads, see:

- **[Test Examples](../tests/examples/TEST_EXAMPLES.md)** - Standard test examples with intents for testing AI generation
- **[Edge Case Examples](../tests/examples/EDGE_CASE_EXAMPLES.md)** - Edge case scenarios for testing error handling

These are separate from automated tests and are used for manual verification of the UI in the browser.

## Test Results

- ✅ **71 tests passing** across 5 test files
- ✅ Tier 1: Schema validation (16 tests), Inference logic (19 tests), Fallback generator (17 tests)
- ✅ Tier 2: Renderer state management (7 tests)
- ✅ Tier 3: AI output contract evaluation (11 tests)
- ✅ Test suite runs in ~1 second (fast iteration)
- ✅ Fixture-based AI tests are stable

## References

- [MVP Testing Strategy](./.cursor/mvp_testing_strategy.md)
- [Implementation Plan](./.cursor/plans/ai_admin_ui_implementation_plan_47ffe566.plan.md)
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
