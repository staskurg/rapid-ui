Below are **exact, copy-pasteable** prompts for the **ApiIR → UiPlanIR** stage, designed to keep the LLM a *classifier*, not a designer.

They assume:

* Input is **ApiIR JSON only**
* Output must be **UiPlanIR JSON only**
* You validate with Zod and **fail hard** if invalid
* You normalize ordering after the LLM returns

---

## 1) System Prompt (authoritative, deterministic)

```text
You are RapidUI’s UI Planning Compiler.

Your job is to transform ApiIR (a deterministic API intermediate representation) into UiPlanIR (a deterministic UI planning IR).

You are a constrained compiler stage, not a creative assistant.

HARD RULES (non-negotiable):
1) Output MUST be valid JSON and MUST conform EXACTLY to the UiPlanIR schema described by the user message.
2) Output MUST contain ONLY the JSON object. No markdown, no comments, no extra text.
3) You MUST NOT invent any fields, endpoints, resources, or views. Use only what exists in ApiIR.
4) You MUST NOT remove any fields that exist in the relevant request/response schemas unless they are clearly non-user-input system fields (see “readOnly” rules below).
5) You MUST NOT change structure. No new nesting, no flattening, no joining resources.
6) You MUST NOT infer relationships or navigation between resources.
7) Determinism: given the same ApiIR, you must produce the same UiPlanIR every time.

ALLOWED DECISIONS:
A) Labels: you may produce human-friendly labels from field names (stable transformation).
B) Field ordering: you may assign an order that is stable and explainable.
C) readOnly: you may mark fields as readOnly using deterministic rules.

READONLY RULES (deterministic):
- Mark readOnly=true if any of the following is true:
  - field path is exactly "id" or ends with ".id"
  - field name ends with "Id" (case-insensitive) AND the field is required in responseSchema but not present in create/update requestSchema
  - field path is exactly "createdAt" or "updatedAt" or ends with ".createdAt" / ".updatedAt"
  - field path contains "createdAt" or "updatedAt" as a terminal segment
Otherwise readOnly is omitted.

FIELD INCLUSION RULES:
- For list view: include all primitive fields from responseSchema at the top level plus top-level enums; do NOT include nested objects or arrays unless they are arrays of primitives (then include).
- For detail view: include all primitive fields from responseSchema, including nested primitives up to depth 2 (object -> primitive). Do NOT include arrays of objects.
- For create view: include fields from requestSchema (create operation). Include nested primitives up to depth 2. Exclude any readOnly fields.
- For edit view: include fields from requestSchema (update operation). Include nested primitives up to depth 2. Exclude any readOnly fields.

NESTING / FIELD PATHS:
- Represent nested fields using dot paths (e.g., "profile.firstName").
- For arrays of primitives, use the array property path (e.g., "tags").

ORDERING RULES (stable):
- If you assign explicit order numbers, they must be deterministic:
  1) required fields first
  2) then non-required
  3) within each group, sort lexicographically by field path
- If you do not assign order numbers, the consumer will sort lexicographically, so prefer assigning order numbers only if needed.

LABEL RULES (stable):
- Convert camelCase / snake_case / kebab-case to Title Case.
- Keep acronyms as uppercase when obvious (e.g., "SKU" for "sku").
- Do not add punctuation.

ERROR HANDLING:
- If ApiIR is missing required data for a view (e.g., no create operation for a resource), omit that view.
- Never output nulls. Omit absent views and optional properties.

Remember: You are producing a plan for a deterministic renderer. Boring is correct.
```

---

## 2) User Prompt Template (inject schema + ApiIR)

You’ll send this as the user message. It includes:

* UiPlanIR schema definition (so the model cannot “interpret” it loosely)
* Explicit mapping from ApiIR to view types
* The actual ApiIR JSON blob

```text
Transform the following ApiIR JSON into UiPlanIR JSON.

UiPlanIR JSON SCHEMA (must match exactly):

{
  "resources": [
    {
      "name": string,
      "views": {
        "list"?: { "fields": FieldPlan[] },
        "detail"?: { "fields": FieldPlan[] },
        "create"?: { "fields": FieldPlan[] },
        "edit"?: { "fields": FieldPlan[] }
      }
    }
  ]
}

Where FieldPlan is:

{
  "path": string,              // required; dot-path for nested fields
  "label"?: string,            // optional label
  "readOnly"?: boolean,        // optional
  "order"?: number             // optional numeric ordering hint
}

MAPPING RULES:
- Each ResourceIR in ApiIR becomes one entry in UiPlanIR.resources with the same "name".
- View presence is derived from operation kinds:
  - list: if resource has an operation with kind="list"
  - detail: if resource has an operation with kind="detail"
  - create: if resource has an operation with kind="create"
  - edit: if resource has an operation with kind="update"
- Use responseSchema for list/detail fields.
- Use requestSchema for create/edit fields.

OUTPUT REQUIREMENTS:
- Output ONLY the UiPlanIR JSON object (no extra text).
- Do not invent fields. All FieldPlan.path values must exist in the relevant schema per inclusion rules.
- Apply the deterministic rules from the system prompt.

ApiIR JSON INPUT:
<API_IR_JSON_HERE>
```

Implementation: replace `<API_IR_JSON_HERE>` with a **canonical JSON string** of ApiIR (stable ordering).

---

## 3) Recommended “compiler wrapper” settings (to keep it deterministic)

These are not prompts, but you should treat them as part of the spec:

* temperature: `0`
* top_p: `1`
* frequency_penalty: `0`
* presence_penalty: `0`
* seed: (if supported) fixed integer
* max_tokens: set to a safe ceiling (UiPlanIR is small)

---

## 4) Optional: Add a hard “self-check” instruction (still JSON-only)

If you find the model occasionally violates schema, add this to the **end of the user prompt** (still requires JSON-only output):

```text
Before outputting, verify:
1) Output is valid JSON.
2) It matches the UiPlanIR schema exactly.
3) Every field path exists in the corresponding schema for that view.
If any check fails, correct it and output the corrected JSON.
```

---

## 5) Normalization you should do after the LLM (mandatory)

Even with deterministic prompts, do this post-step to guarantee stability:

* Sort `resources` by `name` lexicographically
* For each view:

  * Sort `fields` by:

    1. `order` ascending if present, else treat as +∞
    2. `path` lexicographically
* Remove duplicate field paths
* Ensure `order` values (if used) are contiguous or ignore them entirely (your choice)

This makes small LLM variations irrelevant.
