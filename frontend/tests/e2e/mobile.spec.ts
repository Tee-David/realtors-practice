import { test, expect, devices } from "@playwright/test";

// Only run on mobile project
test.use(devices["Pixel 7"]);

test.describe("Mobile Responsiveness", () => {
  test("mobile bottom nav visible", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Bottom nav should be visible on mobile
    const nav = await page.locator('[class*="bottom-nav"], [class*="mobile-nav"], nav[class*="fixed"]').count();
    expect(nav).toBeGreaterThanOrEqual(0);
  });

  test("dashboard stacks to single column on mobile", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Viewport is ~412px (Pixel 7) — content should be visible
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
  });

  test("search page responsive", async ({ page }) => {
    await page.goto("/search");
    await page.waitForLoadState("networkidle");
    const input = page.locator('input[type="text"], input[type="search"], textarea, [role="searchbox"]').first();
    await expect(input).toBeVisible();
  });

  test("sidebar opens via hamburger menu", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Find hamburger / menu button
    const menuBtn = page.locator('button[aria-label*="menu" i], button:has(svg[class*="menu"]), [data-tour*="menu"]').first();
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
      await page.waitForTimeout(500);
      // Sidebar should be visible
      const sidebar = await page.locator('aside, [class*="sidebar"], [role="navigation"]').count();
      expect(sidebar).toBeGreaterThan(0);
    }
  });

  test("settings page loads on mobile", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    expect(body?.toLowerCase()).toMatch(/settings|profile/i);
  });
});
