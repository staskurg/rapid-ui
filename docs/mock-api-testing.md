# Mock API — Manual Testing Guide

The Mock API powers CRUD for generated UIs. Compile an OpenAPI spec first, then use the compilation ID and resource slug to test the endpoints.

## Prerequisites

1. Dev server running: `npm run dev`
2. Base URL: `http://localhost:3000`
3. A compiled spec: Upload an OpenAPI file or use **Demo specs** → **Golden Users** or **Golden Products**
4. Compilation ID: From the URL after compile (`?spec=abc123`) or from the spec list
5. Resource slug: From the compiled spec (e.g. `users`, `products`)

## Getting Compilation ID and Resource

After compiling:
- **URL**: `/?spec=abc123` — the `abc123` part is the compilation ID
- **Resource slugs**: Shown in the UI (e.g. "Users" → slug `users`, "Products" → slug `products`)

For Golden Users: `users`  
For Golden Products: `products`  
For Demo v1/v2/v3: `users`, `tasks`

---

## 1. List Records

```bash
COMPILATION_ID="your-compilation-id"
RESOURCE="users"

curl "http://localhost:3000/api/mock/${COMPILATION_ID}/${RESOURCE}"
```

**Expected:** JSON array of records (seeded for predefined specs, empty for custom).

---

## 2. Create Record

```bash
# Example for Golden Users (nested profile)
curl -X POST "http://localhost:3000/api/mock/${COMPILATION_ID}/${RESOURCE}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane@example.com",
    "status": "active",
    "profile": { "firstName": "Jane", "lastName": "Doe" }
  }'
```

**Expected:** `200` with created record (includes auto-generated `id` or `idField` from spec). Request body must match the OpenAPI schema for that resource.

---

## 3. Get Single Record

```bash
# Replace RECORD_ID with the id from the create response
RECORD_ID="gen-1234567890-abc123"

curl "http://localhost:3000/api/mock/${COMPILATION_ID}/${RESOURCE}/${RECORD_ID}"
```

**Expected:** Single record object or `404` if not found.

---

## 4. Update Record (PATCH)

```bash
# Example for Golden Users (nested profile)
curl -X PATCH "http://localhost:3000/api/mock/${COMPILATION_ID}/${RESOURCE}/${RECORD_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane.smith@example.com",
    "status": "active",
    "profile": { "firstName": "Jane", "lastName": "Smith" }
  }'
```

**Expected:** Updated record.

---

## 5. Delete Record

```bash
curl -X DELETE "http://localhost:3000/api/mock/${COMPILATION_ID}/${RESOURCE}/${RECORD_ID}"
```

**Expected:** `204` No Content.

---

## Full Flow Example

```bash
COMPILATION_ID="abc123"
RESOURCE="users"

# 1. List
curl -s "http://localhost:3000/api/mock/${COMPILATION_ID}/${RESOURCE}" | head -c 300

# 2. Create (Golden Users schema)
CREATED=$(curl -s -X POST "http://localhost:3000/api/mock/${COMPILATION_ID}/${RESOURCE}" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","status":"active","profile":{"firstName":"Test","lastName":"User"}}')
echo $CREATED

# 3. Extract id (requires jq)
ID=$(echo $CREATED | jq -r '.id')
echo "Created id: $ID"

# 4. Get one
curl -s "http://localhost:3000/api/mock/${COMPILATION_ID}/${RESOURCE}/${ID}"

# 5. Update (Golden Users schema)
curl -s -X PATCH "http://localhost:3000/api/mock/${COMPILATION_ID}/${RESOURCE}/${ID}" \
  -H "Content-Type: application/json" \
  -d '{"email":"updated@example.com","status":"active","profile":{"firstName":"Updated","lastName":"User"}}'

# 6. Delete
curl -s -X DELETE "http://localhost:3000/api/mock/${COMPILATION_ID}/${RESOURCE}/${ID}" -w "%{http_code}"
```

---

## ID Field

The identifier field is defined in the UISpec (`idField`). Default is `id`. For specs like Tasks it may be `taskId`, for Orders `orderId`. The mock store uses this to match records.

---

## Error Cases

```bash
# Compilation not found
curl "http://localhost:3000/api/mock/nonexistent/users"
# Expected: 404 "Compilation not found"

# Resource not found
curl "http://localhost:3000/api/mock/${COMPILATION_ID}/unknown"
# Expected: 404 "Resource not found"

# Record not found (get/update/delete)
curl "http://localhost:3000/api/mock/${COMPILATION_ID}/${RESOURCE}/99999"
# Expected: 404 "Not found"

# Invalid JSON
curl -X POST "http://localhost:3000/api/mock/${COMPILATION_ID}/${RESOURCE}" \
  -H "Content-Type: application/json" \
  -d 'invalid'
# Expected: 400 "Invalid JSON body"
```

---

## Data Persistence

- **Predefined specs** (Golden Users, Golden Products, Demo v1/v2/v3): Data is shared per account. Same spec type = same data across compilations.
- **Custom specs**: Data is keyed by compilation ID. Deleting a compilation clears its mock data.
- **In-memory**: Mock store is in-memory; server restart resets all data.
