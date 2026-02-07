import { UISpecSchema, type UISpec } from "./schema";

/**
 * Sample UI spec for "User" entity - used for testing and demo
 */
export const sampleSpec: UISpec = {
  entity: "User",
  fields: [
    {
      name: "id",
      label: "ID",
      type: "number",
      required: true,
    },
    {
      name: "name",
      label: "Name",
      type: "string",
      required: true,
    },
    {
      name: "email",
      label: "Email",
      type: "string",
      required: true,
    },
    {
      name: "role",
      label: "Role",
      type: "enum",
      required: true,
      options: ["admin", "user"],
    },
    {
      name: "active",
      label: "Active",
      type: "boolean",
      required: false,
    },
  ],
  table: {
    columns: ["id", "name", "email", "role", "active"],
  },
  form: {
    fields: ["name", "email", "role", "active"],
  },
  filters: ["name", "email", "role", "active"],
};

/**
 * Sample data matching the User spec
 */
export const sampleData: Record<string, unknown>[] = [
  {
    id: 1,
    name: "Alice Johnson",
    email: "alice@example.com",
    role: "admin",
    active: true,
  },
  {
    id: 2,
    name: "Bob Smith",
    email: "bob@example.com",
    role: "user",
    active: true,
  },
  {
    id: 3,
    name: "Charlie Brown",
    email: "charlie@example.com",
    role: "user",
    active: false,
  },
  {
    id: 4,
    name: "Diana Prince",
    email: "diana@example.com",
    role: "admin",
    active: true,
  },
  {
    id: 5,
    name: "Eve Wilson",
    email: "eve@example.com",
    role: "user",
    active: false,
  },
];

/**
 * Validate the sample spec against the schema
 * This ensures the sample spec is always valid
 */
export function validateSampleSpec(): boolean {
  try {
    UISpecSchema.parse(sampleSpec);
    return true;
  } catch (error) {
    console.error("Sample spec validation failed:", error);
    return false;
  }
}
