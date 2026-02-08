// Example JSON payloads and their associated prompts
export interface Example {
  json: string;
  prompts: string[]; // Array of prompt examples for this JSON payload
}

export const examples: Example[] = [
  {
    json: JSON.stringify([
      {
        id: 1,
        name: "Wireless Mouse",
        price: 29.99,
        inStock: true,
        category: "electronics"
      },
      {
        id: 2,
        name: "USB Keyboard",
        price: 49.99,
        inStock: false,
        category: "electronics"
      },
      {
        id: 3,
        name: "Monitor Stand",
        price: 79.99,
        inStock: true,
        category: "furniture"
      }
    ], null, 2),
    prompts: [
      "Hide id from table, make name and price searchable, show category in filters",
      "Make name searchable and show inStock status as a badge",
      "Show price and category in filters, hide id from table view",
      "Display all fields except id in table, make name searchable"
    ]
  },
  {
    json: JSON.stringify([
      {
        id: 1,
        firstName: "Alice",
        lastName: "Johnson",
        email: "alice@example.com",
        role: "admin",
        active: true,
        createdAt: "2024-01-15"
      },
      {
        id: 2,
        firstName: "Bob",
        lastName: "Smith",
        email: "bob@example.com",
        role: "user",
        active: true,
        createdAt: "2024-02-01"
      },
      {
        id: 3,
        firstName: "Charlie",
        lastName: "Brown",
        email: "charlie@example.com",
        role: "user",
        active: false,
        createdAt: "2024-01-20"
      }
    ], null, 2),
    prompts: [
      "Make firstName, lastName, and email searchable. Hide createdAt from table but keep it in the form. Show role and active in filters.",
      "Hide id from table, make email searchable, show role as filter",
      "Make firstName and lastName searchable, show active status in filters",
      "Display role and active in filters, hide createdAt from table view"
    ]
  },
  {
    json: JSON.stringify([
      {
        taskId: 1,
        title: "Implement user authentication",
        description: "Add login and signup functionality",
        priority: "high",
        status: "in-progress",
        assignee: "Alice",
        dueDate: "2024-03-15",
        estimatedHours: 8
      },
      {
        taskId: 2,
        title: "Design dashboard UI",
        description: "Create mockups for admin dashboard",
        priority: "medium",
        status: "todo",
        assignee: "Bob",
        dueDate: "2024-03-20",
        estimatedHours: 12
      },
      {
        taskId: 3,
        title: "Write API documentation",
        description: "Document all endpoints",
        priority: "low",
        status: "done",
        assignee: "Charlie",
        dueDate: "2024-03-10",
        estimatedHours: 4
      }
    ], null, 2),
    prompts: [
      "Make title and assignee searchable. Show priority and status as filters. Hide taskId from table. Keep description in form but not in table.",
      "Hide taskId from table, make title searchable, show status in filters",
      "Make assignee searchable, show priority and status as filters",
      "Display priority and status in filters, hide taskId from table view"
    ]
  },
  {
    json: JSON.stringify([
      {
        orderId: "ORD-001",
        customerName: "John Doe",
        product: "Laptop",
        quantity: 1,
        price: 1299.99,
        status: "pending",
        orderDate: "2024-03-01"
      },
      {
        orderId: "ORD-002",
        customerName: "Jane Smith",
        product: "Mouse",
        quantity: 2,
        price: 59.98,
        status: "shipped",
        orderDate: "2024-03-02"
      },
      {
        orderId: "ORD-003",
        customerName: "Bob Wilson",
        product: "Keyboard",
        quantity: 1,
        price: 89.99,
        status: "delivered",
        orderDate: "2024-02-28"
      }
    ], null, 2),
    prompts: [
      "Make customerName and product searchable. Show status in filters. Display orderId, customerName, product, quantity, price, and status in table.",
      "Make customerName searchable, show status in filters",
      "Show product and status in filters, make customerName searchable",
      "Display status in filters, make customerName and product searchable"
    ]
  },
  {
    json: JSON.stringify([
      {
        id: 1,
        title: "Getting Started with React",
        author: "Alice",
        category: "tutorial",
        published: true,
        views: 1250,
        publishedDate: "2024-01-10"
      },
      {
        id: 2,
        title: "Advanced TypeScript Patterns",
        author: "Bob",
        category: "tutorial",
        published: false,
        views: 0,
        publishedDate: null
      },
      {
        id: 3,
        title: "Building REST APIs",
        author: "Alice",
        category: "guide",
        published: true,
        views: 890,
        publishedDate: "2024-02-15"
      }
    ], null, 2),
    prompts: [
      "Hide id from table. Make title and author searchable. Show category and published status in filters. Keep views visible in table.",
      "Make title and author searchable, show category in filters",
      "Hide id from table, show published status in filters",
      "Make title searchable, show category and published in filters"
    ]
  },
  {
    json: JSON.stringify([
      {
        sku: "SKU-001",
        productName: "Widget A",
        warehouse: "NYC",
        quantity: 150,
        reorderLevel: 50,
        unitPrice: 12.99,
        supplier: "Supplier A"
      },
      {
        sku: "SKU-002",
        productName: "Widget B",
        warehouse: "LA",
        quantity: 25,
        reorderLevel: 50,
        unitPrice: 15.99,
        supplier: "Supplier B"
      },
      {
        sku: "SKU-003",
        productName: "Widget C",
        warehouse: "NYC",
        quantity: 200,
        reorderLevel: 100,
        unitPrice: 8.99,
        supplier: "Supplier A"
      }
    ], null, 2),
    prompts: [
      "Make productName and supplier searchable. Show warehouse in filters. Display all fields except reorderLevel in the table (keep reorderLevel in form only).",
      "Make productName searchable, show warehouse in filters",
      "Show supplier and warehouse in filters, make productName searchable",
      "Display warehouse in filters, hide reorderLevel from table"
    ]
  },
  {
    json: JSON.stringify([
      {
        name: "John Doe",
        email: "john@example.com",
        phone: "555-0101",
        company: "Acme Corp",
        active: true
      },
      {
        name: "Jane Smith",
        email: "jane@example.com",
        phone: "555-0102",
        company: "Tech Inc",
        active: true
      }
    ], null, 2),
    prompts: [
      "Make name and email searchable, show active status in filters",
      "Make email searchable, show company in filters",
      "Show active status in filters, make name searchable",
      "Make name and email searchable"
    ]
  },
  {
    json: JSON.stringify([
      {
        id: 1,
        user: {
          name: "Alice",
          email: "alice@example.com"
        },
        order: {
          total: 99.99,
          items: 3
        },
        status: "completed"
      },
      {
        id: 2,
        user: {
          name: "Bob",
          email: "bob@example.com"
        },
        order: {
          total: 149.99,
          items: 5
        },
        status: "pending"
      }
    ], null, 2),
    prompts: [
      "Flatten nested objects. Make user.name and user.email searchable. Show status in filters.",
      "Flatten nested objects, make user.name searchable",
      "Show status in filters, flatten nested objects",
      "Make user.email searchable, flatten nested objects"
    ]
  }
];

export function getRandomExample(): Example {
  return examples[Math.floor(Math.random() * examples.length)];
}

export function getRandomPrompt(example: Example): string {
  // Returns a random prompt from the example's prompts array
  return example.prompts[Math.floor(Math.random() * example.prompts.length)];
}

export function findExampleByJson(json: string): Example | null {
  const normalizedJson = json.trim();
  return examples.find(ex => ex.json.trim() === normalizedJson) || null;
}
