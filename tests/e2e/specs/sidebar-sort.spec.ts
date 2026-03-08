import { test, expect } from '@playwright/test';

test.describe('Sidebar sort toggle', () => {
  test('toggle sort order between A-Z and recent', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('status', { name: 'Radio OK' })).toBeVisible();

    // There are multiple sort toggles (Channels, Contacts, Repeaters sections).
    // Use .first() to target the Channels sort toggle.
    // When sort is 'alpha', button text is "A-Z" and title is "Sort by recent".
    // When sort is 'recent', button text is "⏱" and title is "Sort alphabetically".
    const sortByRecent = page.getByTitle('Sort by recent').first();
    const sortAlpha = page.getByTitle('Sort alphabetically').first();

    // Wait for at least one sort button to appear
    await expect(sortByRecent.or(sortAlpha)).toBeVisible({ timeout: 10_000 });

    const isAlpha = await sortByRecent.isVisible();

    if (isAlpha) {
      // Currently A-Z, clicking should switch to recent
      await sortByRecent.click();
      await expect(sortAlpha).toBeVisible({ timeout: 5_000 });

      // Click again to revert
      await sortAlpha.click();
      await expect(sortByRecent).toBeVisible({ timeout: 5_000 });
    } else {
      // Currently recent, clicking should switch to A-Z
      await sortAlpha.click();
      await expect(sortByRecent).toBeVisible({ timeout: 5_000 });

      // Click again to revert
      await sortByRecent.click();
      await expect(sortAlpha).toBeVisible({ timeout: 5_000 });
    }
  });
});
