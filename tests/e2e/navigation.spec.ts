import { test, expect } from '@playwright/test';

test('public navigation and guest library render without hydration errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /hydrat/i.test(message.text())) errors.push(message.text()); });
  await page.goto('/about');
  await expect(page.locator('h1')).toBeVisible();
  await page.getByRole('link', { name: 'My library', exact: true }).click();
  await expect(page.locator('h1')).toContainText('Your stories.');
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('h1')).toContainText('Your stories.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
