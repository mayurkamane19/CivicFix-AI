import { test, expect } from '@playwright/test';

test('Smoke test: browser launches and executes DOM assertions', async ({ page }) => {
  await page.setContent('<h1>CivicFix AI</h1>');
  await expect(page.locator('h1')).toHaveText('CivicFix AI');
});
