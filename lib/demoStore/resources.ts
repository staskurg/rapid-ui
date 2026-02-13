/**
 * Resource registry for demo API.
 * Defines label, slug, and idField per resource.
 */

export interface ResourceDef {
  label: string;
  slug: string;
  idField: string;
}

export const RESOURCES: ResourceDef[] = [
  { label: "Users", slug: "users", idField: "id" },
  { label: "Products", slug: "products", idField: "id" },
  { label: "Tasks", slug: "tasks", idField: "taskId" },
  { label: "Orders", slug: "orders", idField: "orderId" },
  { label: "Blog", slug: "blog", idField: "id" },
  { label: "Inventory", slug: "inventory", idField: "sku" },
  { label: "Nested", slug: "nested", idField: "id" },
];

export function getResourceBySlug(slug: string): ResourceDef | undefined {
  return RESOURCES.find((r) => r.slug === slug);
}

export function isValidResource(slug: string): boolean {
  return RESOURCES.some((r) => r.slug === slug);
}
