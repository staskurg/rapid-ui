# Test Examples for AI Generation

Use these examples to test the AI generation feature. Copy and paste them into the JSON Payload field, optionally add an Intent, and click "Generate with AI".

## 🎯 Quick Test Examples

### Example 1: Simple Product Catalog
**JSON Payload:**
```json
[
  {
    "id": 1,
    "name": "Wireless Mouse",
    "price": 29.99,
    "inStock": true,
    "category": "electronics"
  },
  {
    "id": 2,
    "name": "USB Keyboard",
    "price": 49.99,
    "inStock": false,
    "category": "electronics"
  },
  {
    "id": 3,
    "name": "Monitor Stand",
    "price": 79.99,
    "inStock": true,
    "category": "furniture"
  }
]
```

**Intent (Optional):**
```
Hide id from table, make name and price searchable, show category in filters
```

**Expected Result:**
- Entity: "Product"
- Table shows: name, price, inStock, category (no id)
- Filters: name, price, category
- Enum: category with options ["electronics", "furniture"]

---

### Example 2: User Management with Roles
**JSON Payload:**
```json
[
  {
    "id": 1,
    "firstName": "Alice",
    "lastName": "Johnson",
    "email": "alice@example.com",
    "role": "admin",
    "active": true,
    "createdAt": "2024-01-15"
  },
  {
    "id": 2,
    "firstName": "Bob",
    "lastName": "Smith",
    "email": "bob@example.com",
    "role": "user",
    "active": true,
    "createdAt": "2024-02-01"
  },
  {
    "id": 3,
    "firstName": "Charlie",
    "lastName": "Brown",
    "email": "charlie@example.com",
    "role": "user",
    "active": false,
    "createdAt": "2024-01-20"
  }
]
```

**Intent (Optional):**
```
Make firstName, lastName, and email searchable. Hide createdAt from table but keep it in the form. Show role and active in filters.
```

**Expected Result:**
- Entity: "User"
- Table shows: firstName, lastName, email, role, active (no createdAt, no id)
- Filters: firstName, lastName, email, role, active
- Enum: role with options ["admin", "user"]

---

### Example 3: Task Management System
**JSON Payload:**
```json
[
  {
    "taskId": 1,
    "title": "Implement user authentication",
    "description": "Add login and signup functionality",
    "priority": "high",
    "status": "in-progress",
    "assignee": "Alice",
    "dueDate": "2024-03-15",
    "estimatedHours": 8
  },
  {
    "taskId": 2,
    "title": "Design dashboard UI",
    "description": "Create mockups for admin dashboard",
    "priority": "medium",
    "status": "todo",
    "assignee": "Bob",
    "dueDate": "2024-03-20",
    "estimatedHours": 12
  },
  {
    "taskId": 3,
    "title": "Write API documentation",
    "description": "Document all endpoints",
    "priority": "low",
    "status": "done",
    "assignee": "Charlie",
    "dueDate": "2024-03-10",
    "estimatedHours": 4
  }
]
```

**Intent (Optional):**
```
Make title and assignee searchable. Show priority and status as filters. Hide taskId from table. Keep description in form but not in table.
```

**Expected Result:**
- Entity: "Task"
- Table shows: title, priority, status, assignee, dueDate, estimatedHours
- Filters: title, assignee, priority, status
- Enums: priority ["high", "medium", "low"], status ["in-progress", "todo", "done"]

---

### Example 4: E-commerce Orders
**JSON Payload:**
```json
[
  {
    "orderId": "ORD-001",
    "customerName": "John Doe",
    "product": "Laptop",
    "quantity": 1,
    "price": 1299.99,
    "status": "pending",
    "orderDate": "2024-03-01"
  },
  {
    "orderId": "ORD-002",
    "customerName": "Jane Smith",
    "product": "Mouse",
    "quantity": 2,
    "price": 59.98,
    "status": "shipped",
    "orderDate": "2024-03-02"
  },
  {
    "orderId": "ORD-003",
    "customerName": "Bob Wilson",
    "product": "Keyboard",
    "quantity": 1,
    "price": 89.99,
    "status": "delivered",
    "orderDate": "2024-02-28"
  }
]
```

**Intent (Optional):**
```
Make customerName and product searchable. Show status in filters. Display orderId, customerName, product, quantity, price, and status in table.
```

**Expected Result:**
- Entity: "Order"
- Table shows: orderId, customerName, product, quantity, price, status
- Filters: customerName, product, status
- Enum: status with options ["pending", "shipped", "delivered"]

---

### Example 5: Blog Posts
**JSON Payload:**
```json
[
  {
    "id": 1,
    "title": "Getting Started with React",
    "author": "Alice",
    "category": "tutorial",
    "published": true,
    "views": 1250,
    "publishedDate": "2024-01-10"
  },
  {
    "id": 2,
    "title": "Advanced TypeScript Patterns",
    "author": "Bob",
    "category": "tutorial",
    "published": false,
    "views": 0,
    "publishedDate": null
  },
  {
    "id": 3,
    "title": "Building REST APIs",
    "author": "Alice",
    "category": "guide",
    "published": true,
    "views": 890,
    "publishedDate": "2024-02-15"
  }
]
```

**Intent (Optional):**
```
Hide id from table. Make title and author searchable. Show category and published status in filters. Keep views visible in table.
```

**Expected Result:**
- Entity: "BlogPost" or "Post"
- Table shows: title, author, category, published, views, publishedDate
- Filters: title, author, category, published
- Enum: category with options ["tutorial", "guide"]

---

### Example 6: Inventory Management
**JSON Payload:**
```json
[
  {
    "sku": "SKU-001",
    "productName": "Widget A",
    "warehouse": "NYC",
    "quantity": 150,
    "reorderLevel": 50,
    "unitPrice": 12.99,
    "supplier": "Supplier A"
  },
  {
    "sku": "SKU-002",
    "productName": "Widget B",
    "warehouse": "LA",
    "quantity": 25,
    "reorderLevel": 50,
    "unitPrice": 15.99,
    "supplier": "Supplier B"
  },
  {
    "sku": "SKU-003",
    "productName": "Widget C",
    "warehouse": "NYC",
    "quantity": 200,
    "reorderLevel": 100,
    "unitPrice": 8.99,
    "supplier": "Supplier A"
  }
]
```

**Intent (Optional):**
```
Make productName and supplier searchable. Show warehouse in filters. Display all fields except reorderLevel in the table (keep reorderLevel in form only).
```

**Expected Result:**
- Entity: "Inventory" or "Product"
- Table shows: sku, productName, warehouse, quantity, unitPrice, supplier
- Filters: productName, supplier, warehouse
- Enum: warehouse with options ["NYC", "LA"], supplier with options ["Supplier A", "Supplier B"]

---

### Example 7: Simple Contact List (No Intent)
**JSON Payload:**
```json
[
  {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "555-0101",
    "company": "Acme Corp",
    "active": true
  },
  {
    "name": "Jane Smith",
    "email": "jane@example.com",
    "phone": "555-0102",
    "company": "Tech Inc",
    "active": true
  }
]
```

**Intent:** (Leave empty - test AI's default behavior)

**Expected Result:**
- Entity: "Contact" or "Entity"
- AI will infer reasonable defaults
- All fields shown in table
- String and number fields in filters

---

### Example 8: Complex Nested Object (Test Flattening)
**JSON Payload:**
```json
[
  {
    "id": 1,
    "user": {
      "name": "Alice",
      "email": "alice@example.com"
    },
    "order": {
      "total": 99.99,
      "items": 3
    },
    "status": "completed"
  },
  {
    "id": 2,
    "user": {
      "name": "Bob",
      "email": "bob@example.com"
    },
    "order": {
      "total": 149.99,
      "items": 5
    },
    "status": "pending"
  }
]
```

**Intent (Optional):**
```
Flatten nested objects. Make user.name and user.email searchable. Show status in filters.
```

**Expected Result:**
- Entity: "Order" or similar
- Fields flattened: user.name, user.email, order.total, order.items, status
- Table shows flattened fields
- Filters: user.name, user.email, status
- Enum: status with options ["completed", "pending"]

---

## 🧪 Testing Scenarios

### Test 1: Basic Functionality
1. Copy Example 1 (Product Catalog)
2. Leave Intent empty
3. Click "Generate with AI"
4. Verify: Spec is generated, UI renders correctly

### Test 2: Intent Handling
1. Copy Example 2 (User Management)
2. Add the provided Intent
3. Click "Generate with AI"
4. Verify: id is hidden from table, filters include specified fields

### Test 3: Enum Detection
1. Copy Example 3 (Task Management)
2. Leave Intent empty
3. Click "Generate with AI"
4. Verify: priority and status are detected as enums with options

### Test 4: Complex Intent
1. Copy Example 4 (E-commerce Orders)
2. Add the provided Intent
3. Click "Generate with AI"
4. Verify: All intent requirements are met

### Test 5: Field Visibility
1. Copy Example 5 (Blog Posts)
2. Add the provided Intent
3. Click "Generate with AI"
4. Verify: id is hidden, specified fields are searchable/filterable

### Test 6: Fallback Test (Optional)
1. Use invalid JSON or empty payload
2. Click "Generate with AI"
3. Verify: Fallback parser is used, error message is shown

---

## ✅ What to Verify

For each test, check:

1. **Spec Generation:**
   - ✅ Spec is generated successfully
   - ✅ Source shows "Generated by AI" or "Fallback Parser"
   - ✅ Spec preview shows valid JSON structure

2. **UI Rendering:**
   - ✅ Table displays with correct columns
   - ✅ Filters panel shows correct filter fields
   - ✅ Create/Edit forms work correctly
   - ✅ CRUD operations function properly

3. **Intent Compliance:**
   - ✅ Fields mentioned in intent are hidden/shown correctly
   - ✅ Searchable fields appear in filters
   - ✅ Table columns match intent requirements

4. **Data Types:**
   - ✅ String fields render as text
   - ✅ Number fields render as numbers
   - ✅ Boolean fields render as badges/switches
   - ✅ Enum fields render as select dropdowns with options

---

## 🎨 Tips for Testing

1. **Start Simple:** Begin with Example 1 or 7 (no intent) to verify basic functionality
2. **Add Intent Gradually:** Test with simple intents first, then complex ones
3. **Check Spec Preview:** Always review the generated spec to understand what AI created
4. **Test Edge Cases:** Try empty arrays, single objects, nested structures
5. **Verify CRUD:** After generation, test Create, Read, Update, Delete operations
6. **Test Filters:** Verify that filters work correctly for different field types

---

## 🐛 Common Issues to Watch For

- **Missing Fields:** If a field is missing from table/form, check if it was excluded by intent
- **Invalid References:** If you see errors, check that table/form fields reference existing field names
- **Enum Without Options:** Enum fields should always have an options array
- **Type Mismatches:** Verify field types match the data (string vs number vs boolean)

---

Happy Testing! 🚀
