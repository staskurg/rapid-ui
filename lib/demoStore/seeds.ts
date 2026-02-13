/**
 * Immutable seed data per resource and version.
 * Used for getSample() — never uses live session data.
 */

export type DemoVersion = 1 | 2 | 3;

export type SeedMap = Record<string, Record<DemoVersion, Record<string, unknown>[]>>;

const usersV1 = [
  { id: 1, firstName: "Alice", lastName: "Johnson", email: "alice@example.com", role: "admin", active: true, createdAt: "2024-01-15" },
  { id: 2, firstName: "Bob", lastName: "Smith", email: "bob@example.com", role: "user", active: true, createdAt: "2024-02-01" },
  { id: 3, firstName: "Charlie", lastName: "Brown", email: "charlie@example.com", role: "user", active: false, createdAt: "2024-01-20" },
];

const usersV2 = [
  { id: 1, firstName: "Alice", lastName: "Johnson", email: "alice@example.com", role: "admin", active: true, createdAt: "2024-01-15", department: "Engineering" },
  { id: 2, firstName: "Bob", lastName: "Smith", email: "bob@example.com", role: "user", active: true, createdAt: "2024-02-01", department: "Sales" },
  { id: 3, firstName: "Charlie", lastName: "Brown", email: "charlie@example.com", role: "user", active: false, createdAt: "2024-01-20", department: "Support" },
];

const usersV3 = [
  { id: 1, fullName: "Alice Johnson", email: "alice@example.com", role: "admin", active: true, createdAt: "2024-01-15" },
  { id: 2, fullName: "Bob Smith", email: "bob@example.com", role: "user", active: true, createdAt: "2024-02-01" },
  { id: 3, fullName: "Charlie Brown", email: "charlie@example.com", role: "user", active: false, createdAt: "2024-01-20" },
];

const productsV1 = [
  { id: 1, name: "Wireless Mouse", price: 29.99, inStock: true, category: "electronics" },
  { id: 2, name: "USB Keyboard", price: 49.99, inStock: false, category: "electronics" },
  { id: 3, name: "Monitor Stand", price: 79.99, inStock: true, category: "furniture" },
];

const productsV2 = [
  { id: 1, name: "Wireless Mouse", price: 29.99, inStock: true, category: "electronics", sku: "WM-001" },
  { id: 2, name: "USB Keyboard", price: 49.99, inStock: false, category: "electronics", sku: "UK-002" },
  { id: 3, name: "Monitor Stand", price: 79.99, inStock: true, category: "furniture", sku: "MS-003" },
];

const productsV3 = [
  { id: 1, productName: "Wireless Mouse", price: 29.99, inStock: true, category: "electronics" },
  { id: 2, productName: "USB Keyboard", price: 49.99, inStock: false, category: "electronics" },
  { id: 3, productName: "Monitor Stand", price: 79.99, inStock: true, category: "furniture" },
];

const tasksV1 = [
  { taskId: 1, title: "Implement user authentication", description: "Add login and signup functionality", priority: "high", status: "in-progress", assignee: "Alice", dueDate: "2024-03-15", estimatedHours: 8 },
  { taskId: 2, title: "Design dashboard UI", description: "Create mockups for admin dashboard", priority: "medium", status: "todo", assignee: "Bob", dueDate: "2024-03-20", estimatedHours: 12 },
  { taskId: 3, title: "Write API documentation", description: "Document all endpoints", priority: "low", status: "done", assignee: "Charlie", dueDate: "2024-03-10", estimatedHours: 4 },
];

const tasksV2 = [
  { taskId: 1, title: "Implement user authentication", description: "Add login and signup functionality", priority: "high", status: "in-progress", assignee: "Alice", dueDate: "2024-03-15", estimatedHours: 8, tags: ["auth", "security"] },
  { taskId: 2, title: "Design dashboard UI", description: "Create mockups for admin dashboard", priority: "medium", status: "todo", assignee: "Bob", dueDate: "2024-03-20", estimatedHours: 12, tags: ["ui", "design"] },
  { taskId: 3, title: "Write API documentation", description: "Document all endpoints", priority: "low", status: "done", assignee: "Charlie", dueDate: "2024-03-10", estimatedHours: 4, tags: ["docs"] },
];

const tasksV3 = [
  { taskId: 1, title: "Implement user authentication", description: "Add login and signup functionality", priority: "high", status: "in-progress", assignee: "Alice", dueDate: "2024-03-15", estimatedHours: 8 },
  { taskId: 2, title: "Design dashboard UI", description: "Create mockups for admin dashboard", priority: "medium", status: "todo", assignee: "Bob", dueDate: "2024-03-20", estimatedHours: 12 },
  { taskId: 3, title: "Write API documentation", description: "Document all endpoints", priority: "low", status: "done", assignee: "Charlie", dueDate: "2024-03-10", estimatedHours: 4 },
];

const ordersV1 = [
  { orderId: "ORD-001", customerName: "John Doe", product: "Laptop", quantity: 1, price: 1299.99, status: "pending", orderDate: "2024-03-01" },
  { orderId: "ORD-002", customerName: "Jane Smith", product: "Mouse", quantity: 2, price: 59.98, status: "shipped", orderDate: "2024-03-02" },
  { orderId: "ORD-003", customerName: "Bob Wilson", product: "Keyboard", quantity: 1, price: 89.99, status: "delivered", orderDate: "2024-02-28" },
];

const ordersV2 = [
  { orderId: "ORD-001", customerName: "John Doe", product: "Laptop", quantity: 1, price: 1299.99, status: "pending", orderDate: "2024-03-01", shippingAddress: "123 Main St" },
  { orderId: "ORD-002", customerName: "Jane Smith", product: "Mouse", quantity: 2, price: 59.98, status: "shipped", orderDate: "2024-03-02", shippingAddress: "456 Oak Ave" },
  { orderId: "ORD-003", customerName: "Bob Wilson", product: "Keyboard", quantity: 1, price: 89.99, status: "delivered", orderDate: "2024-02-28", shippingAddress: "789 Pine Rd" },
];

const ordersV3 = [
  { orderId: "ORD-001", customer: "John Doe", product: "Laptop", quantity: 1, total: 1299.99, status: "pending", orderDate: "2024-03-01" },
  { orderId: "ORD-002", customer: "Jane Smith", product: "Mouse", quantity: 2, total: 59.98, status: "shipped", orderDate: "2024-03-02" },
  { orderId: "ORD-003", customer: "Bob Wilson", product: "Keyboard", quantity: 1, total: 89.99, status: "delivered", orderDate: "2024-02-28" },
];

const blogV1 = [
  { id: 1, title: "Getting Started with React", author: "Alice", category: "tutorial", published: true, views: 1250, publishedDate: "2024-01-10" },
  { id: 2, title: "Advanced TypeScript Patterns", author: "Bob", category: "tutorial", published: false, views: 0, publishedDate: null },
  { id: 3, title: "Building REST APIs", author: "Alice", category: "guide", published: true, views: 890, publishedDate: "2024-02-15" },
];

const blogV2 = [
  { id: 1, title: "Getting Started with React", author: "Alice", category: "tutorial", published: true, views: 1250, publishedDate: "2024-01-10", readTime: 5 },
  { id: 2, title: "Advanced TypeScript Patterns", author: "Bob", category: "tutorial", published: false, views: 0, publishedDate: null, readTime: 12 },
  { id: 3, title: "Building REST APIs", author: "Alice", category: "guide", published: true, views: 890, publishedDate: "2024-02-15", readTime: 8 },
];

const blogV3 = [
  { id: 1, title: "Getting Started with React", author: "Alice", category: "tutorial", published: true, views: 1250, publishedDate: "2024-01-10" },
  { id: 2, title: "Advanced TypeScript Patterns", author: "Bob", category: "tutorial", published: false, views: 0, publishedDate: null },
  { id: 3, title: "Building REST APIs", author: "Alice", category: "guide", published: true, views: 890, publishedDate: "2024-02-15" },
];

const inventoryV1 = [
  { sku: "SKU-001", productName: "Widget A", warehouse: "NYC", quantity: 150, reorderLevel: 50, unitPrice: 12.99, supplier: "Supplier A" },
  { sku: "SKU-002", productName: "Widget B", warehouse: "LA", quantity: 25, reorderLevel: 50, unitPrice: 15.99, supplier: "Supplier B" },
  { sku: "SKU-003", productName: "Widget C", warehouse: "NYC", quantity: 200, reorderLevel: 100, unitPrice: 8.99, supplier: "Supplier A" },
];

const inventoryV2 = [
  { sku: "SKU-001", productName: "Widget A", warehouse: "NYC", quantity: 150, reorderLevel: 50, unitPrice: 12.99, supplier: "Supplier A", lastRestocked: "2024-02-01" },
  { sku: "SKU-002", productName: "Widget B", warehouse: "LA", quantity: 25, reorderLevel: 50, unitPrice: 15.99, supplier: "Supplier B", lastRestocked: "2024-01-15" },
  { sku: "SKU-003", productName: "Widget C", warehouse: "NYC", quantity: 200, reorderLevel: 100, unitPrice: 8.99, supplier: "Supplier A", lastRestocked: "2024-02-10" },
];

const inventoryV3 = [
  { sku: "SKU-001", name: "Widget A", location: "NYC", quantity: 150, reorderLevel: 50, unitPrice: 12.99, supplier: "Supplier A" },
  { sku: "SKU-002", name: "Widget B", location: "LA", quantity: 25, reorderLevel: 50, unitPrice: 15.99, supplier: "Supplier B" },
  { sku: "SKU-003", name: "Widget C", location: "NYC", quantity: 200, reorderLevel: 100, unitPrice: 8.99, supplier: "Supplier A" },
];

const nestedV1 = [
  { id: 1, user: { name: "Alice", email: "alice@example.com" }, order: { total: 99.99, items: 3 }, status: "completed" },
  { id: 2, user: { name: "Bob", email: "bob@example.com" }, order: { total: 149.99, items: 5 }, status: "pending" },
];

const nestedV2 = [
  { id: 1, user: { name: "Alice", email: "alice@example.com", role: "admin" }, order: { total: 99.99, items: 3 }, status: "completed" },
  { id: 2, user: { name: "Bob", email: "bob@example.com", role: "user" }, order: { total: 149.99, items: 5 }, status: "pending" },
];

const nestedV3 = [
  { id: 1, customer: { name: "Alice", email: "alice@example.com" }, order: { total: 99.99, items: 3 }, status: "completed" },
  { id: 2, customer: { name: "Bob", email: "bob@example.com" }, order: { total: 149.99, items: 5 }, status: "pending" },
];

export const SEEDS: Record<string, Record<DemoVersion, Record<string, unknown>[]>> = {
  users: { 1: usersV1, 2: usersV2, 3: usersV3 },
  products: { 1: productsV1, 2: productsV2, 3: productsV3 },
  tasks: { 1: tasksV1, 2: tasksV2, 3: tasksV3 },
  orders: { 1: ordersV1, 2: ordersV2, 3: ordersV3 },
  blog: { 1: blogV1, 2: blogV2, 3: blogV3 },
  inventory: { 1: inventoryV1, 2: inventoryV2, 3: inventoryV3 },
  nested: { 1: nestedV1, 2: nestedV2, 3: nestedV3 },
};

export function getSeedSample(resource: string, version: DemoVersion): Record<string, unknown>[] {
  const resourceSeeds = SEEDS[resource];
  if (!resourceSeeds) {
    return [];
  }
  const versionSeeds = resourceSeeds[version] ?? resourceSeeds[1];
  return versionSeeds.map((r) => ({ ...r })); // shallow copy
}
