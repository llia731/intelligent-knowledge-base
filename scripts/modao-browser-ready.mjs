/** Wait for the actual React shell and persisted state; networkidle alone is not hydration readiness. */
export async function waitForAppReady(page) {
  await page.locator('.shell[data-app-ready="true"]').waitFor({ state: "visible", timeout: 30000 });
}
