# Eval Report Analysis — Feb 26, 2026

## Summary

Across 4 reports (2 LLM-only, 2 full pipeline), the model achieves **94–97% similarity** between runs but shows **consistent non-determinism** in specific areas. All evals pass the 90% threshold, but improving determinism will make the system more reliable.

---

## Key Findings

### 1. **Inconsistent Field Inclusion (Most Critical)**

| Fixture | Issue | Schema Reality |
|---------|-------|----------------|
| demo_users_tasks_v2 | `description` sometimes in create/edit, sometimes not | **Not in schema** — model invents it |
| demo_users_tasks_v2 | `profile.phone` sometimes in list, sometimes omitted | **In schema** — model omits it |
| demo_users_tasks_v3 | `description`, `assignee` sometimes in detail | **Not in schema** — model invents them |
| golden_openapi_products | `inventory.warehouseId` sometimes in list, sometimes omitted | **In schema** — model omits it |

**Root cause:** The model does not strictly follow schema boundaries. It sometimes:
- **Adds** fields not in schema (description, assignee, createdAt)
- **Omits** optional fields that are in schema (profile.phone, inventory.warehouseId)

### 2. **Path Invention vs Schema Paths**

- **Tasks:** Schema has `assigneeId`; model sometimes outputs `assignee` in detail view.
- **Rule:** Use the **exact path** from the schema. Never infer human-readable aliases.

### 3. **Read-Only Field Addition (Full Pipeline)**

- **Users:** `createdAt` appears in run 2 but not run 1.
- **Rule:** Only include `createdAt` if it exists in the schema. Do not add it "because it's common."

### 4. **Field Ordering Drift**

- **Users create view:** Sometimes `email, firstName, lastName, phone...` vs `email, status, firstName, lastName...`
- **Rule:** Entity-specific ordering must be applied consistently; Status should not jump before name fields for Users.

### 5. **Label Casing**

- **Products:** `SKU` vs `Sku` — inconsistent acronym handling.
- **Rule:** Explicitly state `sku` → `SKU` (uppercase) in label rules.

---

## Strategy for Improvement

### A. Strengthen Schema Fidelity

1. **Explicit "no invention" rule:** Add a bullet: "Every `path` in your output MUST appear in the corresponding ApiIR schema for that view. Never infer, alias, or add fields."
2. **Explicit "no omission" rule:** "Optional fields in the schema MUST be included. Do not skip them."
3. **Schema-source reminder:** "For each view, derive fields ONLY from: list/detail → responseSchema; create/edit → requestSchema."

### B. Fix Entity-Specific Ordering

1. **Tasks:** Change "assignee" to "assigneeId" (or "assigneeId if present") so the model uses the schema path.
2. **Tasks:** Remove "description" from the canonical ordering if it's not always in schema; say "title, status, assigneeId, dueDate/dueAt, priority, then others."

### C. Add Pre-Output Verification

Add a short checklist the model must mentally run:
- Every list/detail path exists in responseSchema
- Every create/edit path exists in requestSchema
- No path was invented (assignee, description when only assigneeId exists)
- Optional fields are included

### D. Label Rules

Add explicit: `sku` → `SKU` (acronym, uppercase).

---

## Recommended Prompt Edits

See the updated `lib/compiler/uiplan/prompt.system.txt` with:
- Stronger FIELD INCLUSION RULES
- Corrected Tasks ordering (assigneeId, not assignee)
- New PATH FIDELITY section
- Expanded LABEL RULES (sku → SKU)
- Pre-output verification reminder
