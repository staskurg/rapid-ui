# AI Response Evaluation Strategy --- MVP Determinism Harness

## Overview

This document defines a lightweight evaluation strategy to test
AI-generated UI specifications for a CRUD admin MVP. The goal is not to
measure AI intelligence, but to enforce **contract stability**,
**structural validity**, and **renderer safety**.

System pipeline:

input → AI → UISpec → renderer

We evaluate whether AI output remains deterministic and valid under
repeated runs and varied payload inputs.

------------------------------------------------------------------------

## Evaluation Goals

### 1. Structural Validity

Ensure generated UISpec passes schema validation.

Primary metric:

valid_rate = valid_specs / total_runs

Target:

≥ 90% valid output rate.

------------------------------------------------------------------------

### 2. Logical Integrity

Check for:

-   Field references exist
-   Enum fields include options
-   Table/form configurations are usable

Goal:

Renderer-safe outputs only.

------------------------------------------------------------------------

### 3. Stability / Determinism

Repeated runs with the same input should produce structurally consistent
specs.

We compare:

-   field names
-   field types
-   table/form structure

Exact JSON equality is NOT required --- structural similarity is
sufficient.

------------------------------------------------------------------------

### 4. Edge Tolerance

Weird or incomplete payloads should not break spec generation.

Goal:

Fallback or valid spec generation without renderer failure.

------------------------------------------------------------------------

## Evaluation Harness Architecture

Directory layout:

eval/ eval-ai.ts fixtures/ reports/

Fixtures simulate realistic backend payloads:

-   simple-user.json
-   enum-heavy.json
-   numeric.json
-   mixed.json
-   weird.json

------------------------------------------------------------------------

## Evaluation Loop

For each fixture:

1.  Call AI generation N times (recommended: 5--10 runs)
2.  Validate output via schema
3.  Run logical checks
4.  Compare structural consistency
5.  Record metrics

Pseudo-flow:

for each fixture: repeat N times: generate spec validate spec compare
structure summarize results

------------------------------------------------------------------------

## Validation Checks

Each response must pass:

-   Zod UISpec validation
-   Valid field references
-   Enum options present
-   Non-empty table/form config

Optional heuristics:

-   ≥ 1 table column
-   ≥ 1 form field

------------------------------------------------------------------------

## Stability Comparison Strategy

Extract a structural fingerprint:

-   field names + types
-   table columns
-   form fields

Compare across runs to detect drift.

Goal:

Detect non-deterministic structure.

------------------------------------------------------------------------

## Reporting Output

Each fixture produces a summary:

Example:

Fixture: simple-user\
Runs: 10\
Valid specs: 9/10\
Stability: high\
Errors: enum options missing (1 case)

Reports stored in:

eval/reports/

Readable summaries are preferred over raw logs.

------------------------------------------------------------------------

## Failure Replay Strategy

When a spec fails validation:

-   Save failing response
-   Add to fixture set

This creates regression tests over time.

------------------------------------------------------------------------

## Workflow Integration

Run evaluation after:

-   Prompt changes
-   Schema changes
-   Inference updates

Command:

node eval/eval-ai.ts

If metrics degrade → regression detected.

------------------------------------------------------------------------

## Success Criteria

Evaluation harness proves:

-   AI rarely breaks schema contract
-   Renderer-safe specs generated consistently
-   Structural stability maintained
-   Edge inputs handled safely

------------------------------------------------------------------------

## What We Do NOT Evaluate

Avoid over-testing:

-   Semantic UI correctness
-   Exact JSON matching
-   Model benchmarking
-   AI reasoning quality

Focus remains on system guarantees.

------------------------------------------------------------------------

## YC Narrative Advantage

This harness demonstrates:

-   AI contract enforcement
-   Deterministic system thinking
-   Reliability engineering in AI workflows

Messaging:

"We validate AI output against strict contracts and measure determinism
across repeated runs to protect renderer stability."

------------------------------------------------------------------------

## Outcome

A lightweight evaluation harness that:

-   Detects regressions
-   Enforces spec safety
-   Builds confidence in AI integration
-   Preserves demo reliability

Testing supports velocity --- it does not slow it down.
