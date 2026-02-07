/**
 * Test file for CHECKPOINT 3: Payload Inference
 * This file verifies that payload inference works correctly
 */

import { parsePayload } from "./payload-parser";
import { generateSpec } from "./spec-generator";
import { generateFallbackSpec } from "./fallback-generator";

console.log("=== CHECKPOINT 3: Payload Inference Tests ===\n");

// Test 1: Parse simple object
console.log("Test 1: Parse simple object...");
try {
  const simplePayload = { name: "John", age: 30, active: true };
  const parsed = parsePayload(simplePayload);
  console.log(`✅ Simple object parsed: ${parsed.fields.length} fields`);
  console.log(`   Fields: ${parsed.fields.map(f => `${f.name}(${f.type})`).join(", ")}`);
} catch (error) {
  console.log(`❌ Failed: ${error}`);
}

// Test 2: Parse array
console.log("\nTest 2: Parse array...");
try {
  const arrayPayload = [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ];
  const parsed = parsePayload(arrayPayload);
  console.log(`✅ Array parsed: ${parsed.fields.length} fields`);
  console.log(`   Fields: ${parsed.fields.map(f => `${f.name}(${f.type})`).join(", ")}`);
} catch (error) {
  console.log(`❌ Failed: ${error}`);
}

// Test 3: Enum detection
console.log("\nTest 3: Enum detection...");
try {
  const enumPayload = [
    { role: "admin" },
    { role: "user" },
    { role: "admin" },
  ];
  const parsed = parsePayload(enumPayload);
  const roleField = parsed.fields.find(f => f.name === "role");
  if (roleField?.type === "enum" && roleField.options) {
    console.log(`✅ Enum detected: ${roleField.name} with options [${roleField.options.join(", ")}]`);
  } else {
    console.log(`❌ Enum not detected correctly`);
  }
} catch (error) {
  console.log(`❌ Failed: ${error}`);
}

// Test 4: Nested object flattening
console.log("\nTest 4: Nested object flattening...");
try {
  const nestedPayload = {
    id: 1,
    user: {
      name: "Alice",
      email: "alice@example.com",
    },
  };
  const parsed = parsePayload(nestedPayload);
  const hasFlattened = parsed.fields.some(f => f.name.includes("."));
  if (hasFlattened) {
    console.log(`✅ Nested objects flattened`);
    console.log(`   Flattened fields: ${parsed.fields.filter(f => f.name.includes(".")).map(f => f.name).join(", ")}`);
  } else {
    console.log(`❌ Nested objects not flattened`);
  }
} catch (error) {
  console.log(`❌ Failed: ${error}`);
}

// Test 5: Generate spec
console.log("\nTest 5: Generate spec...");
try {
  const payload = [{ name: "Test", value: 100 }];
  const parsed = parsePayload(payload);
  const spec = generateSpec(parsed, "Product");
  console.log(`✅ Spec generated: entity="${spec.entity}", ${spec.fields.length} fields`);
  console.log(`   Table columns: ${spec.table.columns.length}`);
  console.log(`   Form fields: ${spec.form.fields.length}`);
  console.log(`   Filters: ${spec.filters.length}`);
} catch (error) {
  console.log(`❌ Failed: ${error}`);
}

// Test 6: Invalid JSON handled gracefully
console.log("\nTest 6: Invalid payload fallback...");
try {
  const invalidPayload = "not valid json";
  const fallbackSpec = generateFallbackSpec(invalidPayload);
  console.log(`✅ Fallback spec generated: entity="${fallbackSpec.entity}"`);
} catch (error) {
  console.log(`❌ Fallback failed: ${error}`);
}

// Test 7: Empty payload handled gracefully
console.log("\nTest 7: Empty payload fallback...");
try {
  const emptyPayload: unknown[] = [];
  const fallbackSpec = generateFallbackSpec(emptyPayload);
  console.log(`✅ Empty payload handled: entity="${fallbackSpec.entity}"`);
} catch (error) {
  console.log(`❌ Empty payload failed: ${error}`);
}

console.log("\n✅ CHECKPOINT 3 validation complete!");
