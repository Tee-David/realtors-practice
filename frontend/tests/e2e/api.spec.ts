import { test, expect } from "@playwright/test";

const API = "http://localhost:5000";

test.describe("Backend API", () => {
  test("health check returns OK", async ({ request }) => {
    const res = await request.get(`${API}/health`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.status).toBe("OK");
    expect(body.database).toBe("connected");
  });

  test("search endpoint works", async ({ request }) => {
    const res = await request.get(`${API}/api/search/natural?q=lagos`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("analytics KPIs return data", async ({ request }) => {
    const res = await request.get(`${API}/api/analytics/kpis`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("unknown API route returns 404 JSON", async ({ request }) => {
    const res = await request.get(`${API}/api/nonexistent-route-xyz`);
    expect(res.status()).toBe(404);
  });

  test("internal endpoint without key returns 403", async ({ request }) => {
    const res = await request.post(`${API}/api/internal/scrape-progress`, {
      data: { jobId: "test", processed: 0, total: 0 },
    });
    expect(res.status()).toBe(403);
  });

  test("large payload returns 413", async ({ request }) => {
    const bigPayload = "x".repeat(11 * 1024 * 1024); // 11MB
    const res = await request.post(`${API}/api/properties`, {
      data: { title: bigPayload },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(413);
  });

  test("invalid JWT returns 401", async ({ request }) => {
    const res = await request.get(`${API}/api/properties`, {
      headers: { Authorization: "Bearer invalid-token-here" },
    });
    expect(res.status()).toBe(401);
  });

  test("security headers present", async ({ request }) => {
    const res = await request.get(`${API}/health`);
    const headers = res.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
  });

  test("CORS rejects unknown origin", async ({ request }) => {
    const res = await request.get(`${API}/health`, {
      headers: { Origin: "https://evil.com" },
    });
    // Should not have CORS allow header for evil.com
    const corsHeader = res.headers()["access-control-allow-origin"];
    expect(corsHeader).not.toBe("https://evil.com");
  });
});
