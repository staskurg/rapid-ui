# Demo API — Manual Testing Guide

Test the demo API endpoints. Ensure the dev server is running:

```bash
npm run dev
```

Base URL: `http://localhost:3000`

---

## Prerequisites

Generate a session ID (or use any UUID):

```bash
# macOS / Linux
SESSION_ID=$(uuidgen)

# Or use a fixed value for repeatable tests
SESSION_ID="test-session-123"
```

---

## 1. Get Seed Sample (no session)

Returns immutable seed data for spec generation. Does not require a session.

```bash
# Users v1
curl "http://localhost:3000/api/demo/users/sample?v=1"

# Users v2 (added department field)
curl "http://localhost:3000/api/demo/users/sample?v=2"

# Tasks (uses taskId)
curl "http://localhost:3000/api/demo/tasks/sample?v=1"

# Orders (uses orderId string)
curl "http://localhost:3000/api/demo/orders/sample?v=1"

# Inventory (uses sku)
curl "http://localhost:3000/api/demo/inventory/sample?v=1"
```

**Expected:** JSON array of 2–3 records.

---

## 2. List Records

Returns session-scoped data. Initializes from seeds on first access.

```bash
curl "http://localhost:3000/api/demo/users?session=${SESSION_ID}&v=1"
```

**Expected:** JSON array (same as seed for fresh session).

---

## 3. Create Record

```bash
curl -X POST "http://localhost:3000/api/demo/users?session=${SESSION_ID}&v=1" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@example.com",
    "role": "user",
    "active": true,
    "createdAt": "2024-02-13"
  }'
```

**Expected:** `201` with created record (includes auto-generated `id`).

---

## 4. Get Single Record

```bash
# Replace 4 with the id from the create response
curl "http://localhost:3000/api/demo/users/4?session=${SESSION_ID}&v=1"
```

**Expected:** Single record object or `404` if not found.

---

## 5. Update Record (PUT)

```bash
curl -X PUT "http://localhost:3000/api/demo/users/4?session=${SESSION_ID}&v=1" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane.smith@example.com",
    "role": "admin",
    "active": true,
    "createdAt": "2024-02-13"
  }'
```

**Expected:** Updated record.

---

## 6. Delete Record

```bash
curl -X DELETE "http://localhost:3000/api/demo/users/4?session=${SESSION_ID}&v=1"
```

**Expected:** `204` No Content.

---

## 7. Reset Session

Restores session data to seed state.

```bash
curl -X POST "http://localhost:3000/api/demo/users/reset?session=${SESSION_ID}&v=1"
```

**Expected:** `204` No Content. List again to see seed data restored.

---

## Full Flow Example

```bash
SESSION_ID=$(uuidgen)

# 1. List (gets seeds)
curl -s "http://localhost:3000/api/demo/users?session=${SESSION_ID}&v=1" | head -c 200

# 2. Create
CREATED=$(curl -s -X POST "http://localhost:3000/api/demo/users?session=${SESSION_ID}&v=1" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"User","email":"test@example.com","role":"user","active":true,"createdAt":"2024-01-01"}')
echo $CREATED

# 3. Extract id (requires jq)
ID=$(echo $CREATED | jq -r '.id')
echo "Created id: $ID"

# 4. Get one
curl -s "http://localhost:3000/api/demo/users/${ID}?session=${SESSION_ID}&v=1"

# 5. Reset
curl -s -X POST "http://localhost:3000/api/demo/users/reset?session=${SESSION_ID}&v=1" -w "%{http_code}"

# 6. List again (back to seeds)
curl -s "http://localhost:3000/api/demo/users?session=${SESSION_ID}&v=1" | jq length
```

---

## Resources & Versions

| Resource   | Slug      | idField | Versions |
| ---------- | --------- | ------- | -------- |
| Users      | `users`   | id      | v1, v2, v3 |
| Products   | `products`| id      | v1, v2, v3 |
| Tasks      | `tasks`   | taskId  | v1, v2, v3 |
| Orders     | `orders`  | orderId | v1, v2, v3 |
| Blog       | `blog`   | id      | v1, v2, v3 |
| Inventory  | `inventory`| sku   | v1, v2, v3 |
| Nested     | `nested` | id      | v1, v2, v3 |

---

## Error Cases

```bash
# Missing session (list)
curl "http://localhost:3000/api/demo/users?v=1"
# Expected: 400 "Missing session parameter"

# Unknown resource
curl "http://localhost:3000/api/demo/unknown?session=${SESSION_ID}&v=1"
# Expected: 404 "Unknown resource"

# Not found (get/put/delete)
curl "http://localhost:3000/api/demo/users/99999?session=${SESSION_ID}&v=1"
# Expected: 404 "Not found"
```
