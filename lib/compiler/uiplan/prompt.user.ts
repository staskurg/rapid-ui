/**
 * User prompt template for ApiIR → UiPlanIR.
 * Injects schema + ApiIR JSON. Replace <API_IR_JSON_HERE> with canonical JSON.
 */

const USER_PROMPT_TEMPLATE = `Transform the following ApiIR JSON into UiPlanIR JSON.

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
<API_IR_JSON_HERE>`;

/**
 * Build user prompt with ApiIR JSON injected.
 */
export function buildUserPrompt(apiIrJson: string): string {
  return USER_PROMPT_TEMPLATE.replace("<API_IR_JSON_HERE>", apiIrJson);
}
