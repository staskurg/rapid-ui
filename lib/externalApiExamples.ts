/**
 * Known external API examples for the External API tab.
 * One example per domain. Each has url, optional dataPath, and prompt samples.
 */

export interface ExternalApiExample {
  url: string;
  dataPath: string;
  label: string;
  prompts: string[];
}

export const externalApiExamples: ExternalApiExample[] = [
  {
    url: "https://jsonplaceholder.typicode.com/users",
    dataPath: "",
    label: "JSONPlaceholder Users",
    prompts: [
      "Show email and phone in the table",
      "Make name and email searchable",
      "Hide id from table, show company name",
    ],
  },
  {
    url: "https://dummyjson.com/users?limit=20",
    dataPath: "users",
    label: "DummyJSON Users",
    prompts: [
      "Show email and phone in the table",
      "Make firstName and email searchable",
      "Display firstName, lastName, and company name",
    ],
  },
  {
    url: "https://api.github.com/users",
    dataPath: "",
    label: "GitHub Users",
    prompts: [
      "Show login and type in the table",
      "Make login searchable",
      "Display avatar, login, and public repos",
    ],
  },
  {
    url: "https://randomuser.me/api?results=10",
    dataPath: "results",
    label: "RandomUser.me",
    prompts: [
      "Show email and phone in the table",
      "Make name searchable",
      "Display email, gender, and location",
    ],
  },
];

export function getRandomExternalExample(): ExternalApiExample {
  return externalApiExamples[Math.floor(Math.random() * externalApiExamples.length)];
}

export function getRandomExternalPrompt(example: ExternalApiExample): string {
  return example.prompts[Math.floor(Math.random() * example.prompts.length)];
}

export function findExternalExampleByUrl(url: string): ExternalApiExample | null {
  const normalized = url.trim().toLowerCase();
  return (
    externalApiExamples.find(
      (ex) => ex.url.toLowerCase() === normalized
    ) ?? null
  );
}
