import { test, expect } from '@playwright/test';
import { createChannel, deleteChannel, getChannels } from '../helpers/api';

test.describe('Favorites persistence', () => {
  let channelName = '';
  let channelKey = '';

  test.beforeAll(async () => {
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
        const channels = await getChannels();
        return channels.some((c) => c.key === channelKey && c.favorite);
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
        const channels = await getChannels();
        return channels.some((c) => c.key === channelKey && c.favorite);
      })
      .toBe(false);
    await expect(page.getByText('Favorites')).not.toBeVisible();
  });
});
