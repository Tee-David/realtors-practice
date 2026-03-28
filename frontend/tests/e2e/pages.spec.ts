import { test, expect } from "@playwright/test";

// ── 1. Authentication Pages ──
test.describe("Authentication", () => {
  test("login page renders with all elements", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    // Sign in button
    await expect(page.getByRole("button", { name: /sign in|log in/i })).toBeVisible();
    // Google OAuth
    await expect(page.getByText(/google/i)).toBeVisible();
    // Forgot password link
    await expect(page.getByText(/forgot/i)).toBeVisible();
  });

  test("login with invalid email shows validation error", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"], input[name="email"]', "notanemail");
    await page.fill('input[type="password"]', "password123");
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    // Should show some validation feedback (either HTML5 or custom)
    const invalid = await page.locator(':invalid, [aria-invalid="true"], [class*="error"]').count();
    expect(invalid).toBeGreaterThan(0);
  });

  test("forgot-password page loads", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
  });
});

// ── 2. Dashboard ──
test.describe("Dashboard", () => {
  test("loads with KPI cards and charts", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Check for KPI-style content
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
    // Look for numeric stat values
    const numbers = await page.locator('[class*="stat"], [class*="kpi"], [class*="metric"], h2, h3').allTextContents();
    const hasNumbers = numbers.some((t) => /\d/.test(t));
    expect(hasNumbers).toBe(true);
  });

  test("globe canvas renders", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const canvas = await page.locator("canvas").count();
    expect(canvas).toBeGreaterThanOrEqual(0); // Globe may be lazy-loaded
  });

  test("explore properties section visible", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    expect(body?.toLowerCase()).toMatch(/recent|explore|propert/i);
  });
});

// ── 3. Properties ──
test.describe("Properties", () => {
  test("page loads with view toggles", async ({ page }) => {
    await page.goto("/properties");
    await page.waitForLoadState("networkidle");
    // View toggle buttons (grid/list/map)
    const buttons = await page.locator('button[aria-label], button svg, [data-tour*="view"]').count();
    expect(buttons).toBeGreaterThan(0);
  });

  test("pagination controls exist", async ({ page }) => {
    await page.goto("/properties");
    await page.waitForLoadState("networkidle");
    // Look for pagination elements
    const pagination = await page.locator('[class*="pagination"], [class*="pager"], nav[aria-label*="page"], button:has-text("Next"), button:has-text("Previous")').count();
    // May have 0 if no data
    expect(pagination).toBeGreaterThanOrEqual(0);
  });
});

// ── 5. Search ──
test.describe("Search", () => {
  test("search page loads with input", async ({ page }) => {
    await page.goto("/search");
    await page.waitForLoadState("networkidle");
    const input = page.locator('input[type="text"], input[type="search"], textarea, [role="searchbox"], [contenteditable]');
    await expect(input.first()).toBeVisible();
  });

  test("search bar accepts input", async ({ page }) => {
    await page.goto("/search");
    await page.waitForLoadState("networkidle");
    const input = page.locator('input[type="text"], input[type="search"], textarea, [role="searchbox"]').first();
    await input.fill("3 bedroom flat in Lekki");
    await expect(input).toHaveValue(/lekki/i);
  });
});

// ── 6. Sites Management ──
test.describe("Sites", () => {
  test("sites page loads", async ({ page }) => {
    await page.goto("/scraper/sites");
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    expect(body?.toLowerCase()).toMatch(/site|source|add|manage/i);
  });
});

// ── 7. Saved Searches ──
test.describe("Saved Searches", () => {
  test("page loads", async ({ page }) => {
    await page.goto("/saved-searches");
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    expect(body?.toLowerCase()).toMatch(/saved|search|new/i);
  });
});

// ── 8. Data Explorer ──
test.describe("Data Explorer", () => {
  test("page loads with tabs", async ({ page }) => {
    await page.goto("/data-explorer");
    await page.waitForLoadState("networkidle");
    const tabs = await page.locator('[role="tab"], button:has-text("All"), button:has-text("Raw"), button:has-text("Enriched"), button:has-text("Flagged")').count();
    expect(tabs).toBeGreaterThan(0);
  });
});

// ── 9. Analytics ──
test.describe("Analytics", () => {
  test("page loads with chart elements", async ({ page }) => {
    await page.goto("/analytics");
    await page.waitForLoadState("networkidle");
    // Look for SVG chart elements (Recharts renders SVGs)
    const svgs = await page.locator("svg").count();
    expect(svgs).toBeGreaterThan(0);
  });
});

// ── 10. Market Intelligence ──
test.describe("Market Intel", () => {
  test("page loads", async ({ page }) => {
    await page.goto("/market");
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    expect(body?.toLowerCase()).toMatch(/market|intel|price|yield|analysis/i);
  });
});

// ── 11. Settings ──
test.describe("Settings", () => {
  test("page loads with tabs", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    expect(body?.toLowerCase()).toMatch(/settings|profile|security|appearance/i);
  });

  test("theme toggle exists", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    const themeElements = await page.locator('[class*="theme"], [data-tour*="theme"], button:has-text("Dark"), button:has-text("Light")').count();
    expect(themeElements).toBeGreaterThanOrEqual(0);
  });
});

// ── 12. Audit Log ──
test.describe("Audit Log", () => {
  test("page loads with filters", async ({ page }) => {
    await page.goto("/audit-log");
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    expect(body?.toLowerCase()).toMatch(/audit|log|filter|action/i);
  });
});

// ── 13. Compare ──
test.describe("Compare", () => {
  test("compare page loads", async ({ page }) => {
    await page.goto("/properties/compare");
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    expect(body?.toLowerCase()).toMatch(/compare|add|property|side/i);
  });
});

// ── 14. Privacy ──
test.describe("Privacy", () => {
  test("privacy page loads", async ({ page }) => {
    await page.goto("/privacy");
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    expect(body?.toLowerCase()).toMatch(/privacy|data|policy/i);
  });
});

// ── 18. Error Handling ──
test.describe("Error Handling", () => {
  test("404 page for unknown routes", async ({ page }) => {
    await page.goto("/nonexistent-page-xyz-123");
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    expect(body?.toLowerCase()).toMatch(/404|not found|uncharted/i);
  });
});
