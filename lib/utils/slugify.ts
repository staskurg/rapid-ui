/**
 * Slugify: resource name → URL slug.
 * Lowercase, replace spaces with -, strip non-alphanumeric.
 * e.g. "Users" → "users", "My Resource" → "my-resource"
 */
export function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "resource";
}
