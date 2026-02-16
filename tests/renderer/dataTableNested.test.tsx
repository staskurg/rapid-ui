/**
 * Test DataTable with nested data and camelCase spec (userName -> user.name)
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataTable } from "@/components/renderer/DataTable";
import type { UISpec } from "@/lib/spec/types";

const nestedData: Record<string, unknown>[] = [
  {
    id: 1,
    user: { name: "Alice", email: "alice@example.com" },
    order: { total: 99.99, items: 3 },
    status: "completed",
  },
  {
    id: 2,
    user: { name: "Bob", email: "bob@example.com" },
    order: { total: 149.99, items: 5 },
    status: "pending",
  },
];

const nestedSpec: UISpec = {
  entity: "Order",
  fields: [
    { name: "id", label: "ID", type: "number", required: true },
    { name: "userName", label: "User Name", type: "string", required: true },
    { name: "userEmail", label: "User Email", type: "string", required: true },
    { name: "orderTotal", label: "Order Total", type: "number", required: true },
    { name: "orderItems", label: "Order Items", type: "number", required: true },
    {
      name: "status",
      label: "Status",
      type: "enum",
      required: true,
      options: ["completed", "pending"],
    },
  ],
  table: {
    columns: ["id", "userName", "userEmail", "orderTotal", "orderItems", "status"],
  },
  form: { fields: ["userName", "userEmail", "orderTotal", "orderItems", "status"] },
  filters: ["userName", "userEmail", "status"],
  idField: "id",
};

describe("DataTable with nested data and camelCase spec", () => {
  it("displays nested values when spec uses camelCase (userName -> user.name)", () => {
    render(
      <DataTable data={nestedData} spec={nestedSpec} />
    );

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    expect(screen.getByText("99.99")).toBeInTheDocument();
    expect(screen.getByText("149.99")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("completed")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
  });
});
