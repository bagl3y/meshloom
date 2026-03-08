import { test, expect } from '@playwright/test';
import { randomBytes } from 'crypto';
import { createChannel, createContact, deleteChannel, deleteContact } from '../helpers/api';

function randomHex(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}

function makeKeyWithPrefix(prefix: string): string {
  return `${prefix}${randomHex(26)}`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test.describe('Hash routing and conversation identity', () => {
  let channelName = '';
  let channelKey = '';
  let contactAKey = '';
  let contactAName = '';
  let contactBKey = '';
  let contactBName = '';

  test.beforeAll(async () => {
    channelName = `#e2ehash${Date.now().toString().slice(-6)}`;
    const createdChannel = await createChannel(channelName);
    channelKey = createdChannel.key;

    const sharedPrefix = randomHex(6);
    contactAKey = makeKeyWithPrefix(sharedPrefix);
    contactBKey = makeKeyWithPrefix(sharedPrefix);
    contactAName = `E2E Hash A ${Date.now().toString().slice(-5)}`;
    contactBName = `E2E Hash B ${Date.now().toString().slice(-5)}`;

    await createContact(contactAKey, contactAName);
    await createContact(contactBKey, contactBName);
  });

  test.afterAll(async () => {
    try {
      await deleteChannel(channelKey);
    } catch {
      // Best-effort cleanup
    }
    try {
      await deleteContact(contactAKey);
    } catch {
      // Best-effort cleanup
    }
    try {
      await deleteContact(contactBKey);
    } catch {
      // Best-effort cleanup
    }
  });

  test('legacy channel-name hash resolves and rewrites to stable channel-key hash', async ({
    page,
  }) => {
    const legacyToken = channelName.slice(1); // no leading '#'
    await page.goto(`/#channel/${encodeURIComponent(legacyToken)}`);

    await expect(page.getByRole('status', { name: 'Radio OK' })).toBeVisible();
    await expect(
      page.getByPlaceholder(new RegExp(`message\\s+${escapeRegex(channelName)}`, 'i'))
    ).toBeVisible();

    await expect.poll(() => page.url()).toContain(`#channel/${encodeURIComponent(channelKey)}/`);
  });

  test('full-key contact hash selects the exact contact even with shared prefixes', async ({ page }) => {
    await page.goto(`/#contact/${contactBKey}`);

    await expect(page.getByRole('status', { name: 'Radio OK' })).toBeVisible();
    await expect(
      page.getByPlaceholder(new RegExp(`message\\s+${escapeRegex(contactBName)}`, 'i'))
    ).toBeVisible();
    await expect(page.getByText(contactBKey, { exact: true })).toBeVisible();

    await expect.poll(() => page.url()).toContain(`#contact/${encodeURIComponent(contactBKey)}/`);
  });

  test('legacy contact-name hash resolves and rewrites to stable full-key hash', async ({ page }) => {
    await page.goto(`/#contact/${encodeURIComponent(contactAName)}`);

    await expect(page.getByRole('status', { name: 'Radio OK' })).toBeVisible();
    await expect(
      page.getByPlaceholder(new RegExp(`message\\s+${escapeRegex(contactAName)}`, 'i'))
    ).toBeVisible();
    await expect(page.getByText(contactAKey, { exact: true })).toBeVisible();

    await expect.poll(() => page.url()).toContain(`#contact/${encodeURIComponent(contactAKey)}/`);
  });
});
