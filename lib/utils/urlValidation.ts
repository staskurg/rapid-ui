/**
 * URL validation for proxy SSRF protection.
 * Rejects localhost, private IPs, and non-http(s) URLs.
 */

export function validateProxyUrl(
  urlString: string
): { valid: boolean; error?: string } {
  try {
    const url = new URL(urlString);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { valid: false, error: "Only http and https URLs are allowed" };
    }
    const hostname = url.hostname.toLowerCase();
    // IPv6 localhost: URL parser normalizes [::1] to ::1
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]" ||
      hostname.endsWith(".localhost")
    ) {
      return { valid: false, error: "Localhost URLs are not allowed" };
    }
    // Reject private IP ranges (IPv4)
    const parts = hostname.split(".");
    if (parts.length === 4) {
      const a = parseInt(parts[0], 10);
      const b = parseInt(parts[1], 10);
      if (a === 10)
        return { valid: false, error: "Private IP ranges not allowed" };
      if (a === 172 && b >= 16 && b <= 31)
        return { valid: false, error: "Private IP ranges not allowed" };
      if (a === 192 && b === 168)
        return { valid: false, error: "Private IP ranges not allowed" };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid URL" };
  }
}
