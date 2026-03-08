import { test, expect } from '@playwright/test';
import {
  createChannel,
  deleteChannel,
  sendChannelMessage,
  getChannels,
} from '../helpers/api';

test.describe('Channel message persistence across delete/re-add', () => {
  const suffix = Date.now().toString().slice(-6);
  const channelName = `#persist${suffix}`;
  let channelKey = '';

  test.afterAll(async () => {
    // Cleanup
    if (channelKey) {
      try {
        await deleteChannel(channelKey);
      } catch {
        // Best-effort
      }
    }
  });

  test('messages persist after channel delete and re-create', async ({ page }) => {
    // Create channel via API
    const channel = await createChannel(channelName);
    channelKey = channel.key;

    // Send a message via API
    const testMessage = `persist-test-${Date.now()}`;
    await sendChannelMessage(channelKey, testMessage);

    // Verify message appears in UI
    await page.goto('/');
    await expect(page.getByRole('status', { name: 'Radio OK' })).toBeVisible();
    await page.getByText(channelName, { exact: true }).first().click();
    await expect(page.getByText(testMessage)).toBeVisible({ timeout: 15_000 });

    // Delete channel via API (only removes channels row, messages remain)
    await deleteChannel(channelKey);

    // Verify channel is gone from sidebar
    await page.reload();
    await expect(page.getByRole('status', { name: 'Radio OK' })).toBeVisible();
    await expect(page.getByText(channelName, { exact: true })).not.toBeVisible({ timeout: 10_000 });

    // Re-create the same hashtag channel (derives same key)
    const recreated = await createChannel(channelName);
    channelKey = recreated.key;

    // Navigate to it
    await page.reload();
    await expect(page.getByRole('status', { name: 'Radio OK' })).toBeVisible();
    await page.getByText(channelName, { exact: true }).first().click();

    // Verify original message is still visible as outgoing
    await expect(page.getByText(testMessage)).toBeVisible({ timeout: 15_000 });
  });
});
