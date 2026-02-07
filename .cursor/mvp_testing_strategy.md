# MVP Testing Strategy --- AI CRUD Admin UI

## Philosophy

This testing strategy focuses on protecting the **demo-critical
boundaries** of an AI-driven CRUD admin UI. The goal is not exhaustive
coverage, but high-leverage reliability that prevents demo failures.

We test:

-   Spec validation correctness
-   Renderer state integrity
-   Deterministic fallback logic
-   AI output contract safety

We do **not** attempt enterprise-grade QA or visual testing.

Guiding principle:

> Test what could break the demo.

------------------------------------------------------------------------

## Testing Layers

### Tier 1 --- Deterministic Unit Tests (Required)

These protect the core engine contracts.

#### UISpec Schema Validation

Goal:

-   Invalid spec → rejected
-   Valid spec → accepted

Test cases:

-   Missing required fields
-   Invalid types
-   Enum without options
-   Broken table references

Why:

Schema failure = renderer crash = demo failure.

------------------------------------------------------------------------

#### Field Inference Logic

Payload → inferred field types

Example checks:

    { name: "Alice" } → string
    { age: 42 } → number
    { active: true } → boolean

Ensures deterministic inference pipeline stability.

------------------------------------------------------------------------

#### Fallback Spec Generator

Guarantees fallback always produces:

-   Valid UISpec
-   Consistent field references

This is the demo safety net when AI output fails.

------------------------------------------------------------------------

### Tier 2 --- Renderer Behavior Tests (Lightweight)

We validate state transitions --- not visuals.

Focus:

-   Create record → appears
-   Edit record → updates
-   Delete record → removed

Use React Testing Library.

Goal:

Renderer state integrity, not styling correctness.

------------------------------------------------------------------------

### Tier 3 --- AI Output Contract Evaluation

We do not test model intelligence.

We test:

> AI output validity + schema contract compliance

Strategy:

Fixture payload → AI → UISpec → validate with Zod

Test payload scenarios:

-   Simple object
-   Enum-like structure
-   Edge-case data
-   Slightly malformed input

Pass condition:

-   Valid UISpec produced
-   Logical constraints satisfied

Optional heuristic checks:

-   Table has columns
-   Form fields exist
-   Enum fields contain options

------------------------------------------------------------------------

## AI Eval Stability Strategy

AI responses may vary.

Recommended approach:

-   Allow retry logic inside tests
-   Or record successful outputs as fixtures
-   Replay fixtures during automated testing

Goal:

Fast, stable validation without flakiness.

------------------------------------------------------------------------

## Recommended Test Stack

Minimal tooling:

    Vitest
    React Testing Library
    Jest DOM matchers

Why:

-   Fast execution
-   TypeScript-friendly
-   Minimal configuration
-   Next.js compatible

------------------------------------------------------------------------

## Suggested Folder Structure

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
      fixtures/

Clean separation of system layers.

------------------------------------------------------------------------

## Sprint Integration

Add a reliability phase after AI integration.

### Phase 3.5 --- Reliability Guardrails

Tasks:

-   UISpec validation tests
-   Inference tests
-   Fallback generator tests
-   Renderer state tests
-   AI contract eval fixtures

Goal:

Demo cannot silently break.

------------------------------------------------------------------------

## What We Explicitly Skip

Not required for MVP:

-   Visual regression tests
-   End-to-end browser automation
-   Snapshot-heavy UI testing
-   AI benchmarking suites

These add complexity without improving demo safety.

------------------------------------------------------------------------

## YC Narrative Advantage

This testing layer demonstrates:

-   AI output validation discipline
-   Deterministic safety boundaries
-   Engineering rigor in AI workflows

Messaging:

> "AI output is validated, fallback is deterministic, and renderer
> behavior is contract-tested."

This signals production thinking --- even in an MVP.

------------------------------------------------------------------------

## Outcome

A lightweight but robust safety net ensuring:

-   AI cannot break rendering
-   Renderer logic remains stable
-   Demo reliability is preserved
-   Iteration remains fast

Testing protects velocity --- it does not slow it down.
