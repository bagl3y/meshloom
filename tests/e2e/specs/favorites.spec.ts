import { test, expect } from '@playwright/test';
import {
  createChannel,
  deleteChannel,
  getSettings,
  updateSettings,
  type Favorite,
} from '../helpers/api';

test.describe('Favorites persistence', () => {
  let originalFavorites: Favorite[] = [];
  let channelName = '';
  let channelKey = '';

  test.beforeAll(async () => {
    const settings = await getSettings();
    originalFavorites = settings.favorites ?? [];

    // Start deterministic: no favorites
    await updateSettings({ favorites: [] });

    channelName = `#e2efav${Date.now().toString().slice(-6)}`;
    const channel = await createChannel(channelName);
    channelKey = channel.key;
  });

  test.afterAll(async () => {
    try {
      await deleteChannel(channelKey);
    } catch {
      // Best-effort cleanup
    }
    try {
      await updateSettings({ favorites: originalFavorites });
    } catch {
      // Best-effort cleanup
    }
  });

  test('add and remove favorite channel with persistence across reload', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('status', { name: 'Radio OK' })).toBeVisible();

    await page.getByText(channelName, { exact: true }).first().click();

    const addFavoriteButton = page.getByTitle('Add to favorites');
    await expect(addFavoriteButton).toBeVisible();
    await addFavoriteButton.click();

    await expect(page.getByTitle('Remove from favorites')).toBeVisible();
    await expect(page.getByText('Favorites')).toBeVisible();
    await expect
      .poll(async () => {
        const settings = await getSettings();
        return settings.favorites.some((f) => f.type === 'channel' && f.id === channelKey);
      })
      .toBe(true);

    await page.reload();
    await expect(page.getByRole('status', { name: 'Radio OK' })).toBeVisible();
    await page.getByText(channelName, { exact: true }).first().click();
    await expect(page.getByTitle('Remove from favorites')).toBeVisible();
    await expect(page.getByText('Favorites')).toBeVisible();

    await page.getByTitle('Remove from favorites').click();
    await expect(page.getByTitle('Add to favorites')).toBeVisible();
    await expect
      .poll(async () => {
        const settings = await getSettings();
        return settings.favorites.some((f) => f.type === 'channel' && f.id === channelKey);
      })
      .toBe(false);
    await expect(page.getByText('Favorites')).not.toBeVisible();
  });
});
