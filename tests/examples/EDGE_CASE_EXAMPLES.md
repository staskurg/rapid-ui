# Edge Case Test Examples

> **⚠️ DEPRECATED (MVP v3):** This document describes the legacy Paste JSON / Demo API flow, which has been removed in MVP v3. RapidUI now compiles from OpenAPI specs only. For OpenAPI edge cases, see the subset validator and compiler error taxonomy in [docs/openapi-compiler.md](../../docs/openapi-compiler.md).

---

Use these examples to test edge case handling in the UI. Copy and paste them into the JSON Payload field (Paste JSON tab) and test both "Parse JSON" and "Generate with AI" to verify edge cases are handled correctly.

> **Note:** These examples also work via the **Demo API** tab or **External API** tab when the data structure matches.

## 🧪 Edge Case Test Examples

### Edge Case 1: Special Characters in Field Names
**Purpose:** Test field name sanitization and label generation

**JSON Payload:**
```json
{
  "id": 1,
  "field-with-dashes": "value1",
  "field_with_underscores": "value2",
  "fieldWithSpecial@Chars!": "value3",
  "field with spaces": "value4",
  "camelCaseField": "value5",
  "PascalCaseField": "value6"
}
```

**What to Verify:**
- ✅ All fields are parsed correctly
- ✅ Labels are generated properly (special chars handled)
- ✅ Field names in spec match JSON keys exactly
- ✅ UI renders without errors
- ✅ Forms work with all field types

---

### Edge Case 2: Null, Undefined, and Empty Values
**Purpose:** Test handling of null, undefined, empty strings, zero, and false

**JSON Payload:**
```json
[
  {
    "id": 1,
    "name": "Test",
    "value": null,
    "optional": null,
    "emptyString": "",
    "zero": 0,
    "falseValue": false
  },
  {
    "id": 2,
    "name": "Test 2",
    "value": "has value",
    "optional": "has optional",
    "emptyString": "not empty",
    "zero": 1,
    "falseValue": true
  }
]
```

**What to Verify:**
- ✅ Null values don't break parsing
- ✅ Empty strings are handled as strings
- ✅ Zero is detected as number (not boolean)
- ✅ False is detected as boolean
- ✅ Optional fields are marked correctly
- ✅ Forms handle null/empty values properly

---

### Edge Case 3: Single Object (Not Array)
**Purpose:** Test single object payload handling

**JSON Payload:**
```json
{
  "id": 1,
  "name": "Single Item",
  "status": "active",
  "value": 100
}
```

**What to Verify:**
- ✅ Single object is parsed correctly
- ✅ UI generates from single object
- ✅ Table shows one row
- ✅ CRUD operations work
- ✅ Can create new records

---

### Edge Case 4: Number Edge Cases
**Purpose:** Test various number formats and edge cases

**JSON Payload:**
```json
[
  {
    "id": 1,
    "price": 0.0001,
    "largeNumber": 999999999999,
    "negativeNumber": -100,
    "decimal": 123.456789,
    "zero": 0
  },
  {
    "id": 2,
    "price": 1000000.99,
    "largeNumber": 1234567890123,
    "negativeNumber": -0.5,
    "decimal": 0.001,
    "zero": 0
  }
]
```

**What to Verify:**
- ✅ Very small numbers display correctly
- ✅ Very large numbers display correctly
- ✅ Negative numbers handled properly
- ✅ Decimal precision maintained
- ✅ Zero values work correctly
- ✅ Number filters work with all ranges

---

### Edge Case 5: Enum Detection Threshold (6+ Values)
**Purpose:** Test enum vs string detection with 6+ values

**JSON Payload:**
```json
[
  { "id": 1, "status": "active" },
  { "id": 2, "status": "active" },
  { "id": 3, "status": "active" },
  { "id": 4, "status": "active" },
  { "id": 5, "status": "active" },
  { "id": 6, "status": "inactive" }
]
```

**What to Verify:**
- ✅ Status should be detected as **string** (not enum) because >5 distinct values
- ✅ Filter should be text search (not dropdown)
- ✅ Enum threshold logic works correctly

---

### Edge Case 6: Enum Detection Threshold (Exactly 5 Values)
**Purpose:** Test enum detection with exactly 5 values

**JSON Payload:**
```json
[
  { "id": 1, "priority": "option1" },
  { "id": 2, "priority": "option2" },
  { "id": 3, "priority": "option3" },
  { "id": 4, "priority": "option4" },
  { "id": 5, "priority": "option5" }
]
```

**What to Verify:**
- ✅ Priority should be detected as **enum** (exactly 5 values)
- ✅ Filter should be dropdown with 5 options
- ✅ Form should have select dropdown with options

---

### Edge Case 7: Very Long Text Fields
**Purpose:** Test layout with very long text content

**JSON Payload:**
```json
[
  {
    "id": 1,
    "name": "Item with very long name that should still display correctly in the table without breaking the layout",
    "description": "This is a very long description that might cause layout issues if not handled properly. It should wrap or truncate nicely in the table cells. The description continues here with more text to test how the UI handles long content.",
    "short": "OK"
  },
  {
    "id": 2,
    "name": "Another item with a long name here",
    "description": "Another description that is also quite long",
    "short": "OK"
  }
]
```

**What to Verify:**
- ✅ Long text wraps or truncates properly
- ✅ Table layout doesn't break
- ✅ Forms handle long text correctly
- ✅ No horizontal scrolling issues

---

### Edge Case 8: Unicode, Emoji, and Special Characters
**Purpose:** Test international characters and special symbols

**JSON Payload:**
```json
[
  {
    "id": 1,
    "unicode": "测试",
    "emoji": "🚀",
    "special": "Special chars: !@#$%^&*()",
    "mixed": "Mix 测试 🚀 !@#"
  },
  {
    "id": 2,
    "unicode": "日本語",
    "emoji": "✅",
    "special": "More: <>?{}[]",
    "mixed": "More 日本語 ✅ <>?"
  }
]
```

**What to Verify:**
- ✅ Unicode characters display correctly
- ✅ Emojis render properly
- ✅ Special characters don't break parsing
- ✅ Forms handle all character types
- ✅ Filters work with Unicode

---

### Edge Case 9: Deeply Nested Objects
**Purpose:** Test nested object flattening (6+ levels)

**JSON Payload:**
```json
[
  {
    "id": 1,
    "deeply": {
      "nested": {
        "object": {
          "with": {
            "many": {
              "levels": "value1"
            }
          }
        }
      }
    }
  },
  {
    "id": 2,
    "deeply": {
      "nested": {
        "object": {
          "with": {
            "many": {
              "levels": "value2"
            }
          }
        }
      }
    }
  }
]
```

**What to Verify:**
- ✅ Nested objects are flattened correctly
- ✅ Field names use dot notation (e.g., "deeply.nested.object.with.many.levels")
- ✅ Labels are generated properly from nested paths
- ✅ All flattened fields appear in table/form
- ✅ CRUD operations work with flattened fields

---

### Edge Case 10: Boolean Type Confusion
**Purpose:** Test boolean vs string/number confusion

**JSON Payload:**
```json
[
  {
    "id": 1,
    "booleanTrue": true,
    "booleanFalse": false,
    "stringTrue": "true",
    "stringFalse": "false",
    "numberOne": 1,
    "numberZero": 0
  },
  {
    "id": 2,
    "booleanTrue": false,
    "booleanFalse": true,
    "stringTrue": "false",
    "stringFalse": "true",
    "numberOne": 0,
    "numberZero": 1
  }
]
```

**What to Verify:**
- ✅ booleanTrue/booleanFalse are detected as **boolean** type
- ✅ stringTrue/stringFalse are detected as **string** type
- ✅ numberOne/numberZero are detected as **number** type
- ✅ Boolean fields show as switches/badges
- ✅ String fields show as text inputs
- ✅ Number fields show as number inputs

---

### Edge Case 11: Date/Time Formats
**Purpose:** Test various date representations (should be strings)

**JSON Payload:**
```json
[
  {
    "id": 1,
    "date": "2024-01-01",
    "datetime": "2024-01-01T12:00:00Z",
    "timestamp": 1704110400000,
    "dateString": "January 1, 2024"
  },
  {
    "id": 2,
    "date": "2024-12-31",
    "datetime": "2024-12-31T23:59:59Z",
    "timestamp": 1735689599000,
    "dateString": "December 31, 2024"
  }
]
```

**What to Verify:**
- ✅ All date fields are detected as **string** type (not date)
- ✅ Timestamp (number) is detected as **number** type
- ✅ Date strings display correctly
- ✅ Forms handle date strings as text inputs
- ✅ Filters work with date strings

---

### Edge Case 12: Empty Structures
**Purpose:** Test empty objects and arrays within payload

**JSON Payload:**
```json
[
  {
    "id": 1,
    "emptyObject": {},
    "emptyArray": [],
    "nullValue": null,
    "normalField": "value"
  },
  {
    "id": 2,
    "emptyObject": {},
    "emptyArray": [],
    "nullValue": null,
    "normalField": "another value"
  }
]
```

**What to Verify:**
- ✅ Empty objects don't break parsing
- ✅ Empty arrays don't break parsing
- ✅ Null values are handled
- ✅ Normal fields still work
- ✅ UI renders correctly

---

### Edge Case 13: Mixed Types in Same Field (Invalid Data)
**Purpose:** Test handling of inconsistent types (edge case)

**JSON Payload:**
```json
[
  {
    "id": 1,
    "mixedField": "string value"
  },
  {
    "id": 2,
    "mixedField": 123
  },
  {
    "id": 3,
    "mixedField": true
  }
]
```

**What to Verify:**
- ✅ Parser handles mixed types (uses first non-null value type)
- ✅ Type inference works correctly
- ✅ UI renders without errors
- ✅ Forms handle the detected type

---

### Edge Case 14: Very Large Array
**Purpose:** Test performance with larger datasets

**JSON Payload:**
```json
[
  {"id": 1, "name": "Item 1", "value": 10},
  {"id": 2, "name": "Item 2", "value": 20},
  {"id": 3, "name": "Item 3", "value": 30},
  {"id": 4, "name": "Item 4", "value": 40},
  {"id": 5, "name": "Item 5", "value": 50},
  {"id": 6, "name": "Item 6", "value": 60},
  {"id": 7, "name": "Item 7", "value": 70},
  {"id": 8, "name": "Item 8", "value": 80},
  {"id": 9, "name": "Item 9", "value": 90},
  {"id": 10, "name": "Item 10", "value": 100}
]
```

**What to Verify:**
- ✅ Large arrays parse correctly
- ✅ Table renders all rows
- ✅ Performance is acceptable
- ✅ Filtering works with large datasets
- ✅ Sorting works correctly

---

### Edge Case 15: Missing Fields Across Records
**Purpose:** Test optional fields that don't exist in all records

**JSON Payload:**
```json
[
  {
    "id": 1,
    "name": "Item 1",
    "optional": "present"
  },
  {
    "id": 2,
    "name": "Item 2"
  },
  {
    "id": 3,
    "name": "Item 3",
    "optional": "also present"
  }
]
```

**What to Verify:**
- ✅ Optional fields are detected correctly
- ✅ Fields missing in some records are marked as optional
- ✅ Forms handle optional fields properly
- ✅ Table displays empty cells for missing values
- ✅ CRUD operations work with optional fields

---

## ✅ Testing Checklist

For each edge case, verify:

1. **Parsing:**
   - ✅ JSON parses without errors
   - ✅ Spec is generated successfully
   - ✅ Field types are inferred correctly
   - ✅ Labels are generated properly

2. **UI Rendering:**
   - ✅ Table displays correctly
   - ✅ All fields appear in table/form
   - ✅ No layout breaking
   - ✅ No console errors

3. **CRUD Operations:**
   - ✅ Create new record works
   - ✅ Edit existing record works
   - ✅ Delete record works
   - ✅ Data persists correctly

4. **Filters:**
   - ✅ Filters work for all field types
   - ✅ Search works correctly
   - ✅ Number range filters work
   - ✅ Boolean/enum filters work

5. **Forms:**
   - ✅ Form fields render correctly
   - ✅ Validation works
   - ✅ Required fields enforced
   - ✅ Optional fields handled

---

## 🐛 Common Edge Case Issues to Watch For

- **Field Name Sanitization:** Special characters should be handled in labels but names should match JSON keys
- **Type Inference:** Verify types are detected correctly (string vs number vs boolean vs enum)
- **Null Handling:** Null values shouldn't break parsing or rendering
- **Empty Values:** Empty strings, empty objects, empty arrays should be handled gracefully
- **Enum Threshold:** Exactly 5 values = enum, 6+ values = string
- **Nested Objects:** Should flatten with dot notation
- **Unicode:** International characters should display correctly
- **Long Text:** Should wrap/truncate without breaking layout

---

## 🎯 Testing Strategy

1. **Start with Parse JSON:** Test deterministic parsing first
2. **Then Test AI:** Verify AI handles edge cases correctly
3. **Compare Results:** See if AI improves on deterministic parsing
4. **Test CRUD:** Verify all operations work with edge case data
5. **Test Filters:** Ensure filtering works with edge case values

---

Happy Edge Case Testing! 🚀
