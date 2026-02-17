/**
 * Demo store + seeds + session isolation
 */

import { describe, it, expect } from "vitest";
import { createSessionId } from "../lib/session";
import { getResourceBySlug, isValidResource, RESOURCES } from "../lib/demoStore/resources";
import { getSeedSample, type DemoVersion } from "../lib/demoStore/seeds";
import {
  getRecords,
  getRecordById,
  createRecord,
  updateRecord,
  deleteRecord,
  resetSession,
} from "../lib/demoStore/store";

describe("createSessionId", () => {
  it("returns a UUID string", () => {
    const id = createSessionId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
    expect(/^[0-9a-f-]{36}$/i.test(id)).toBe(true);
  });
});

describe("resources", () => {
  it("has all 7 demo resources", () => {
    expect(RESOURCES.length).toBeGreaterThanOrEqual(7);
  });
  it("validates resource slugs", () => {
    expect(isValidResource("users")).toBe(true);
    expect(isValidResource("unknown")).toBe(false);
  });
  it("returns correct idField per resource", () => {
    expect(getResourceBySlug("users")?.idField).toBe("id");
    expect(getResourceBySlug("tasks")?.idField).toBe("taskId");
  });
});

describe("seeds", () => {
  it("returns array of records for users v1", () => {
    const v1 = getSeedSample("users", 1);
    expect(Array.isArray(v1)).toBe(true);
    expect(v1.length).toBeGreaterThanOrEqual(2);
    expect(v1[0].id).toBeDefined();
  });
  it("v2 has added fields", () => {
    const v2 = getSeedSample("users", 2);
    expect(v2[0].department).toBeDefined();
  });
  it("tasks use taskId, orders use orderId", () => {
    const tasks = getSeedSample("tasks", 1);
    expect(tasks[0].taskId).toBeDefined();
    const orders = getSeedSample("orders", 1);
    expect(typeof orders[0].orderId).toBe("string");
  });
});

describe("store", () => {
  it("getRecords initializes from seeds", () => {
    const sessionId = createSessionId();
    const initial = getRecords(sessionId, "users", 1);
    expect(initial.length).toBeGreaterThanOrEqual(2);
  });
  it("create, read, update, delete, reset work", () => {
    const sessionId = createSessionId();
    const version: DemoVersion = 1;
    const initial = getRecords(sessionId, "users", version);

    const created = createRecord(sessionId, "users", version, {
      firstName: "New",
      lastName: "User",
      email: "new@example.com",
      role: "user",
      active: true,
      createdAt: "2024-01-01",
    });
    expect(created.id).toBeDefined();
    const createdId = created.id as string | number;

    expect(getRecords(sessionId, "users", version).length).toBe(initial.length + 1);

    const one = getRecordById(sessionId, "users", version, createdId);
    expect(one).toBeDefined();
    expect(one?.firstName).toBe("New");

    const updated = updateRecord(sessionId, "users", version, createdId, { firstName: "Updated" });
    expect(updated?.firstName).toBe("Updated");

    const deleted = deleteRecord(sessionId, "users", version, createdId);
    expect(deleted).toBe(true);
    expect(getRecords(sessionId, "users", version).length).toBe(initial.length);

    resetSession(sessionId, "users", version);
    expect(getRecords(sessionId, "users", version).length).toBe(initial.length);
  });
  it("sessions are isolated", () => {
    const sessionId = createSessionId();
    const otherSession = createSessionId();
    const initial = getRecords(sessionId, "users", 1);
    expect(getRecords(otherSession, "users", 1).length).toBe(initial.length);
  });
});

describe("version isolation", () => {
  it("v1 and v2 do not share records", () => {
    const sessionId = createSessionId();
    const v1 = getRecords(sessionId, "users", 1);
    const v2 = getRecords(sessionId, "users", 2);
    expect(v1[0].department).toBeUndefined();
    expect(v2[0].department).toBeDefined();

    createRecord(sessionId, "users", 1, {
      firstName: "V1Only",
      lastName: "User",
      email: "v1@example.com",
      role: "user",
      active: true,
      createdAt: "2024-01-01",
    });
    const v1After = getRecords(sessionId, "users", 1);
    const v2After = getRecords(sessionId, "users", 2);
    expect(v1After.length).toBeGreaterThan(v2After.length);
  });
});
