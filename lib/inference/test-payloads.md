# Test Payloads for Manual Testing

This file contains various JSON payloads you can use to test the payload inference feature. Copy and paste these into the JSON input field on the main page.

## 1. Simple Object

```json
{
  "name": "John Doe",
  "age": 30,
  "email": "john@example.com",
  "active": true
}
```

**Expected**: Should detect 4 fields (name: string, age: number, email: string, active: boolean)

---

## 2. Array of Objects

```json
[
  {
    "id": 1,
    "name": "Alice Johnson",
    "email": "alice@example.com",
    "age": 28,
    "active": true
  },
  {
    "id": 2,
    "name": "Bob Smith",
    "email": "bob@example.com",
    "age": 35,
    "active": false
  },
  {
    "id": 3,
    "name": "Charlie Brown",
    "email": "charlie@example.com",
    "age": 42,
    "active": true
  }
]
```

**Expected**: Should detect 5 fields and use first record structure

---

## 3. With Enum Fields

```json
[
  {
    "id": 1,
    "name": "Product A",
    "status": "pending",
    "priority": "high",
    "category": "electronics"
  },
  {
    "id": 2,
    "name": "Product B",
    "status": "approved",
    "priority": "medium",
    "category": "electronics"
  },
  {
    "id": 3,
    "name": "Product C",
    "status": "rejected",
    "priority": "low",
    "category": "clothing"
  },
  {
    "id": 4,
    "name": "Product D",
    "status": "pending",
    "priority": "high",
    "category": "electronics"
  }
]
```

**Expected**: Should detect `status`, `priority`, and `category` as enum fields (≤5 unique values)

---

## 4. Nested Objects (Flattening Test)

```json
[
  {
    "id": 1,
    "user": {
      "name": "Alice",
      "email": "alice@example.com",
      "profile": {
        "bio": "Software engineer",
        "location": "San Francisco"
      }
    },
    "role": "admin",
    "active": true
  },
  {
    "id": 2,
    "user": {
      "name": "Bob",
      "email": "bob@example.com",
      "profile": {
        "bio": "Designer",
        "location": "New York"
      }
    },
    "role": "user",
    "active": false
  }
]
```

**Expected**: Should flatten nested objects to `user.name`, `user.email`, `user.profile.bio`, `user.profile.location`

---

## 5. E-commerce Products

```json
[
  {
    "id": 1,
    "name": "Wireless Mouse",
    "price": 29.99,
    "inStock": true,
    "category": "Electronics",
    "rating": 4.5,
    "reviews": 128
  },
  {
    "id": 2,
    "name": "Mechanical Keyboard",
    "price": 149.99,
    "inStock": true,
    "category": "Electronics",
    "rating": 4.8,
    "reviews": 256
  },
  {
    "id": 3,
    "name": "USB-C Cable",
    "price": 12.99,
    "inStock": false,
    "category": "Accessories",
    "rating": 4.2,
    "reviews": 89
  }
]
```

**Expected**: Should detect all fields with proper types (numbers, booleans, strings)

---

## 6. Task Management

```json
[
  {
    "id": 1,
    "title": "Implement user authentication",
    "description": "Add login and signup functionality",
    "status": "in_progress",
    "priority": "high",
    "assignee": "Alice",
    "dueDate": "2026-02-15",
    "completed": false
  },
  {
    "id": 2,
    "title": "Write documentation",
    "description": "Document API endpoints",
    "status": "todo",
    "priority": "medium",
    "assignee": "Bob",
    "dueDate": "2026-02-20",
    "completed": false
  },
  {
    "id": 3,
    "title": "Fix bug in payment flow",
    "description": "Payment processing error",
    "status": "done",
    "priority": "high",
    "assignee": "Charlie",
    "dueDate": "2026-02-10",
    "completed": true
  }
]
```

**Expected**: Should detect `status` and `priority` as enums, `completed` as boolean

---

## 7. User Roles (Enum Detection)

```json
[
  {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "email": "admin@example.com",
    "active": true
  },
  {
    "id": 2,
    "username": "user1",
    "role": "user",
    "email": "user1@example.com",
    "active": true
  },
  {
    "id": 3,
    "username": "user2",
    "role": "user",
    "email": "user2@example.com",
    "active": false
  },
  {
    "id": 4,
    "username": "moderator",
    "role": "moderator",
    "email": "mod@example.com",
    "active": true
  }
]
```

**Expected**: Should detect `role` as enum with options: ["admin", "user", "moderator"]

---

## 8. Minimal Payload

```json
{
  "name": "Test",
  "value": 100
}
```

**Expected**: Simplest test case - 2 fields

---

## 9. Invalid JSON (Error Handling Test)

```json
{
  "name": "Test",
  "value": 100
  // Missing closing brace - invalid JSON
```

**Expected**: Should show error message and use fallback spec

---

## 10. Empty Array (Edge Case)

```json
[]
```

**Expected**: Should use fallback spec (empty array can't be parsed)

---

## Testing Checklist

- [ ] Simple object parses correctly
- [ ] Array of objects uses first element structure
- [ ] Enum fields are detected (≤5 unique values)
- [ ] Nested objects are flattened correctly
- [ ] All field types render correctly in UI
- [ ] Generated UI works with CRUD operations
- [ ] Invalid JSON shows error message
- [ ] Fallback spec is used for invalid payloads
- [ ] Empty payloads handled gracefully
