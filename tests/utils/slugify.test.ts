import { describe, it, expect } from "vitest";
import { slugify } from "@/lib/utils/slugify";

describe("slugify", () => {
  it("lowercases and strips non-alphanumeric", () => {
    expect(slugify("Users")).toBe("users");
    expect(slugify("Products")).toBe("products");
  });

  it("replaces spaces with hyphens", () => {
    expect(slugify("My Resource")).toBe("my-resource");
    expect(slugify("User  Management")).toBe("user-management");
  });

  it("strips leading/trailing hyphens", () => {
    expect(slugify("  Users  ")).toBe("users");
    expect(slugify("---Users---")).toBe("users");
  });

  it("returns resource for empty or non-alphanumeric input", () => {
    expect(slugify("")).toBe("resource");
    expect(slugify("   ")).toBe("resource");
    expect(slugify("---")).toBe("resource");
  });
});
