/**
 * User prompt template for ApiIR → UiPlanIR.
 * Injects schema + ApiIR JSON. Replace <API_IR_JSON_HERE> with canonical JSON.
 */

import { readFileSync } from "fs";
import path from "path";

const UIplanSchemaJson = (() => {
  const p = path.join(process.cwd(), "lib/compiler/uiplan/uiplan.schema.json");
  return JSON.parse(readFileSync(p, "utf-8"));
})();

const USER_PROMPT_TEMPLATE = `Transform the following ApiIR JSON into UiPlanIR JSON.

UiPlanIR JSON SCHEMA (output must conform exactly):

<UIplan_SCHEMA_JSON>

FieldPlan — include ALL of these for every field:
  - path: string (required; dot-path for nested fields)
  - label: string (required; Title Case from path)
  - readOnly: boolean (include only when true; omit when false)
  - order: number (required; sequential 1, 2, 3... per view)

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
- For every field: include path, label, and order. Include readOnly only when true.
- Follow the example format from the system prompt.

BEFORE OUTPUTTING, VERIFY:
1) Output is valid JSON.
2) It matches the UiPlanIR schema exactly.
3) Every field path exists in the corresponding ApiIR schema for that view.
If any check fails, correct it and output the corrected JSON.

ApiIR JSON INPUT:
<API_IR_JSON_HERE>`;

/**
 * Build user prompt with ApiIR JSON injected.
 */
export function buildUserPrompt(apiIrJson: string): string {
  return USER_PROMPT_TEMPLATE.replace(
    "<UIplan_SCHEMA_JSON>",
    JSON.stringify(UIplanSchemaJson, null, 2)
  ).replace("<API_IR_JSON_HERE>", apiIrJson);
}
