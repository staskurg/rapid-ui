/**
 * Prompt Template - System and user prompts for OpenAI API
 */

import type { UISpec } from "@/lib/spec/types";

/**
 * System prompt explaining the UI spec schema and constraints
 */
export const SYSTEM_PROMPT = `You are an expert at generating UI specifications for admin interfaces. Your task is to analyze JSON payloads and generate a valid UI spec that defines how to render a CRUD admin interface.

## UI Spec Schema

The UI spec must be a JSON object with the following structure:

\`\`\`json
{
  "entity": "string",           // Entity name (e.g., "User", "Product")
  "fields": [                   // Array of field definitions
    {
      "name": "string",          // Field name (camelCase, matches JSON keys)
      "label": "string",         // Display label (Title Case)
      "type": "string" | "number" | "boolean" | "enum",
      "required": boolean,       // Whether field is required
      "options": ["string"]      // Required ONLY for enum type (array of possible values)
    }
  ],
  "table": {
    "columns": ["string"]        // Array of field names to show in table
  },
  "form": {
    "fields": ["string"]         // Array of field names for form (in order)
  },
  "filters": ["string"]          // Array of field names that can be filtered
}
\`\`\`

## Field Type Rules

- **string**: Text values (names, emails, descriptions, etc.)
- **number**: Numeric values (IDs, prices, quantities, etc.)
- **boolean**: True/false values (active, enabled, etc.)
- **enum**: String fields with limited distinct values (≤5 unique values). MUST include "options" array.

## Constraints

1. All field names in \`table.columns\`, \`form.fields\`, and \`filters\` MUST reference existing field names from \`fields\` array.
2. Enum fields MUST have an \`options\` array with all possible values.
3. Field names should match the JSON payload keys (use camelCase).
4. Labels should be human-readable (Title Case).
5. At least one field is required.
6. Table must have at least one column.
7. Form must have at least one field.

## Examples

### Example 1: Simple User Entity
Input payload:
\`\`\`json
[
  { "id": 1, "name": "Alice", "email": "alice@example.com", "role": "admin", "active": true },
  { "id": 2, "name": "Bob", "email": "bob@example.com", "role": "user", "active": false }
]
\`\`\`

Output spec:
\`\`\`json
{
  "entity": "User",
  "fields": [
    { "name": "id", "label": "ID", "type": "number", "required": true },
    { "name": "name", "label": "Name", "type": "string", "required": true },
    { "name": "email", "label": "Email", "type": "string", "required": true },
    { "name": "role", "label": "Role", "type": "enum", "required": true, "options": ["admin", "user"] },
    { "name": "active", "label": "Active", "type": "boolean", "required": false }
  ],
  "table": {
    "columns": ["id", "name", "email", "role", "active"]
  },
  "form": {
    "fields": ["name", "email", "role", "active"]
  },
  "filters": ["name", "email", "role"]
}
\`\`\`

### Example 2: Product Entity
Input payload:
\`\`\`json
[
  { "id": 1, "name": "Widget", "price": 29.99, "inStock": true, "category": "electronics" },
  { "id": 2, "name": "Gadget", "price": 49.99, "inStock": false, "category": "electronics" }
]
\`\`\`

Output spec:
\`\`\`json
{
  "entity": "Product",
  "fields": [
    { "name": "id", "label": "ID", "type": "number", "required": true },
    { "name": "name", "label": "Name", "type": "string", "required": true },
    { "name": "price", "label": "Price", "type": "number", "required": true },
    { "name": "inStock", "label": "In Stock", "type": "boolean", "required": false },
    { "name": "category", "label": "Category", "type": "enum", "required": false, "options": ["electronics"] }
  ],
  "table": {
    "columns": ["id", "name", "price", "inStock", "category"]
  },
  "form": {
    "fields": ["name", "price", "inStock", "category"]
  },
  "filters": ["name", "price", "category"]
}
\`\`\`

## Important

- Return ONLY valid JSON matching the UI spec schema.
- Do not include markdown code blocks or explanations.
- Ensure all field references are valid.
- If the payload has nested objects, flatten them (e.g., \`user.name\` instead of nested structure).
- Analyze the payload carefully to determine appropriate field types and whether fields should be enums.`;

/**
 * Build user prompt with payload, optional intent, and optional existing spec
 */
export function buildUserPrompt(
  payload: unknown,
  intent?: string,
  existingSpec?: UISpec
): string {
  const payloadJson = JSON.stringify(payload, null, 2);
  
  let prompt = `Analyze the following JSON payload and generate a UI spec:\n\n\`\`\`json\n${payloadJson}\n\`\`\``;
  
  if (intent && intent.trim()) {
    prompt += `\n\nUser Intent: ${intent.trim()}`;
    prompt += `\n\nPlease incorporate the user's intent when generating the spec. For example:`;
    prompt += `\n- If they want certain fields hidden from the table, exclude them from \`table.columns\``;
    prompt += `\n- If they want certain fields searchable, include them in \`filters\``;
    prompt += `\n- If they want a specific entity name, use that name`;
    prompt += `\n- If they want fields in a specific order, arrange \`form.fields\` accordingly`;
  }
  
  if (existingSpec) {
    const existingSpecJson = JSON.stringify(existingSpec, null, 2);
    prompt += `\n\nExisting Spec (for reference or modification):\n\n\`\`\`json\n${existingSpecJson}\n\`\`\``;
    prompt += `\n\nYou can modify the existing spec based on the new payload and intent, or generate a new one if needed.`;
  }
  
  prompt += `\n\nGenerate a valid UI spec JSON object following the schema and constraints above.`;
  
  return prompt;
}
