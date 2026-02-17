/**
 * Proxy URL validation — SSRF protection
 */

import { describe, it, expect } from "vitest";
import { validateProxyUrl } from "@/lib/utils/urlValidation";

describe("validateProxyUrl", () => {
  it("allows valid public https URLs", () => {
    expect(validateProxyUrl("https://api.example.com/users")).toEqual({
      valid: true,
    });
    expect(validateProxyUrl("https://jsonplaceholder.typicode.com/users")).toEqual(
      { valid: true }
    );
  });

  it("allows valid public http URLs", () => {
    expect(validateProxyUrl("http://api.example.com/data")).toEqual({
      valid: true,
    });
  });

  it("rejects localhost", () => {
    expect(validateProxyUrl("http://localhost/users")).toEqual({
      valid: false,
      error: "Localhost URLs are not allowed",
    });
    expect(validateProxyUrl("https://localhost:3000/api")).toEqual({
      valid: false,
      error: "Localhost URLs are not allowed",
    });
  });

  it("rejects 127.0.0.1", () => {
    expect(validateProxyUrl("http://127.0.0.1/users")).toEqual({
      valid: false,
      error: "Localhost URLs are not allowed",
    });
    expect(validateProxyUrl("http://127.0.0.1:8080/api")).toEqual({
      valid: false,
      error: "Localhost URLs are not allowed",
    });
  });

  it("rejects ::1 (IPv6 localhost)", () => {
    expect(validateProxyUrl("http://[::1]/users")).toEqual({
      valid: false,
      error: "Localhost URLs are not allowed",
    });
  });

  it("rejects .localhost subdomains", () => {
    expect(validateProxyUrl("http://foo.localhost/api")).toEqual({
      valid: false,
      error: "Localhost URLs are not allowed",
    });
  });

  it("rejects 10.x.x.x (private class A)", () => {
    expect(validateProxyUrl("http://10.0.0.1/api")).toEqual({
      valid: false,
      error: "Private IP ranges not allowed",
    });
    expect(validateProxyUrl("http://10.255.255.255/data")).toEqual({
      valid: false,
      error: "Private IP ranges not allowed",
    });
  });

  it("rejects 172.16-31.x.x (private class B)", () => {
    expect(validateProxyUrl("http://172.16.0.1/api")).toEqual({
      valid: false,
      error: "Private IP ranges not allowed",
    });
    expect(validateProxyUrl("http://172.31.255.255/data")).toEqual({
      valid: false,
      error: "Private IP ranges not allowed",
    });
  });

  it("rejects 192.168.x.x (private class C)", () => {
    expect(validateProxyUrl("http://192.168.0.1/api")).toEqual({
      valid: false,
      error: "Private IP ranges not allowed",
    });
    expect(validateProxyUrl("http://192.168.1.100/data")).toEqual({
      valid: false,
      error: "Private IP ranges not allowed",
    });
  });

  it("allows 172.15 and 172.32 (outside private range)", () => {
    expect(validateProxyUrl("http://172.15.0.1/api")).toEqual({ valid: true });
    expect(validateProxyUrl("http://172.32.0.1/api")).toEqual({ valid: true });
  });

  it("rejects non-http(s) protocols", () => {
    expect(validateProxyUrl("ftp://files.example.com/data")).toEqual({
      valid: false,
      error: "Only http and https URLs are allowed",
    });
    expect(validateProxyUrl("file:///etc/passwd")).toEqual({
      valid: false,
      error: "Only http and https URLs are allowed",
    });
  });

  it("rejects invalid URLs", () => {
    expect(validateProxyUrl("not-a-url")).toEqual({
      valid: false,
      error: "Invalid URL",
    });
    expect(validateProxyUrl("")).toEqual({
      valid: false,
      error: "Invalid URL",
    });
  });
});
