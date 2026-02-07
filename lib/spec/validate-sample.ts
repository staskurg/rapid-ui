/**
 * Validation test file for CHECKPOINT 1
 * This file verifies that the schema and types work correctly
 */

import { UISpecSchema, type UISpec } from "./schema";
import { sampleSpec, validateSampleSpec } from "./sample-spec";

// Test 1: Sample spec passes validation
console.log("Test 1: Validating sample spec...");
const isValid = validateSampleSpec();
console.log(`Sample spec validation: ${isValid ? "✅ PASS" : "❌ FAIL"}`);

// Test 2: Schema validates correct UISpec structure
console.log("\nTest 2: Validating correct UISpec structure...");
try {
  const validSpec: UISpec = {
    entity: "Product",
    fields: [
      { name: "id", label: "ID", type: "number", required: true },
      { name: "name", label: "Name", type: "string", required: true },
    ],
    table: { columns: ["id", "name"] },
    form: { fields: ["name"] },
    filters: ["name"],
  };
  UISpecSchema.parse(validSpec);
  console.log("✅ Valid spec passes validation");
} catch (error) {
  console.log("❌ Valid spec failed validation:", error);
}

// Test 3: Schema rejects invalid specs
console.log("\nTest 3: Testing invalid spec rejection...");

// Test 3a: Missing required fields
try {
  UISpecSchema.parse({ entity: "Test" } as unknown);
  console.log("❌ Missing fields should be rejected");
} catch {
  console.log("✅ Missing fields correctly rejected");
}

// Test 3b: Invalid field type
try {
  UISpecSchema.parse({
    entity: "Test",
    fields: [{ name: "test", label: "Test", type: "invalid" as unknown, required: false }],
    table: { columns: ["test"] },
    form: { fields: ["test"] },
    filters: [],
  });
  console.log("❌ Invalid field type should be rejected");
} catch {
  console.log("✅ Invalid field type correctly rejected");
}

// Test 3c: Enum without options
try {
  UISpecSchema.parse({
    entity: "Test",
    fields: [{ name: "role", label: "Role", type: "enum", required: false }],
    table: { columns: ["role"] },
    form: { fields: ["role"] },
    filters: [],
  });
  console.log("❌ Enum without options should be rejected");
} catch {
  console.log("✅ Enum without options correctly rejected");
}

// Test 3d: Table column references non-existent field
try {
  UISpecSchema.parse({
    entity: "Test",
    fields: [{ name: "id", label: "ID", type: "number", required: false }],
    table: { columns: ["id", "nonexistent"] },
    form: { fields: ["id"] },
    filters: [],
  });
  console.log("❌ Invalid table column reference should be rejected");
} catch {
  console.log("✅ Invalid table column reference correctly rejected");
}

// Test 4: TypeScript types compile correctly
console.log("\nTest 4: TypeScript type checking...");
const typedSpec: UISpec = sampleSpec;
console.log(`✅ TypeScript types work correctly (entity: ${typedSpec.entity})`);

console.log("\n✅ CHECKPOINT 1 validation complete!");
