import { test, expect } from '@playwright/test';
import { createChannel, deleteChannel, getChannels } from '../helpers/api';

test.describe('Sidebar search/filter', () => {
  const suffix = Date.now().toString().slice(-6);
  const nameA = `#alpha${suffix}`;
  const nameB = `#bravo${suffix}`;
  let keyA = '';
  let keyB = '';

  test.beforeAll(async () => {
    const chA = await createChannel(nameA);
    const chB = await createChannel(nameB);
    keyA = chA.key;
    keyB = chB.key;
  });

  test.afterAll(async () => {
    for (const key of [keyA, keyB]) {
      try {
        await deleteChannel(key);
      } catch {
        // Best-effort cleanup
      }
    }
  });

  test('search filters conversations by name', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('status', { name: 'Radio OK' })).toBeVisible();

    // Both channels should be visible
    await expect(page.getByText(nameA, { exact: true })).toBeVisible();
    await expect(page.getByText(nameB, { exact: true })).toBeVisible();

    // Type partial name to filter
    const searchInput = page.getByPlaceholder('Search...');
    await searchInput.fill(`alpha${suffix}`);

    // Only nameA should be visible
    await expect(page.getByText(nameA, { exact: true })).toBeVisible();
    await expect(page.getByText(nameB, { exact: true })).not.toBeVisible();

    // Clear search
    await page.getByTitle('Clear search').click();

    // Both should return
    await expect(page.getByText(nameA, { exact: true })).toBeVisible();
    await expect(page.getByText(nameB, { exact: true })).toBeVisible();
  });
});
