import { test, expect } from '@playwright/test';
import { seedChannelUnread } from '../helpers/seed';

const CHANNEL_NAME = '#unread-e2e';

test.describe('Unread badge/pip', () => {
  test('unread badge appears for channel with new messages', async ({ page }) => {
    // Seed unread messages for the channel
    seedChannelUnread({ channelName: CHANNEL_NAME, unreadCount: 3 });

    await page.goto('/');
    await expect(page.getByRole('status', { name: 'Radio OK' })).toBeVisible();

    // Find the channel in the sidebar
    const channelRow = page.getByText(CHANNEL_NAME, { exact: true }).first();
    await expect(channelRow).toBeVisible({ timeout: 15_000 });

    // Verify unread badge (rounded-full pip) is visible within the channel's sidebar row
    const sidebarRow = channelRow.locator('xpath=ancestor::div[contains(@class,"cursor-pointer")][1]');
    const unreadBadge = sidebarRow.locator('span.rounded-full');
    await expect(unreadBadge).toBeVisible();
  });
});
