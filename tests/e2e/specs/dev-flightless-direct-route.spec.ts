import { test, expect } from '@playwright/test';
import {
  createContact,
  deleteContact,
  getContactByKey,
  getMessages,
  setContactRoutingOverride,
} from '../helpers/api';

const DEV_ONLY_ENV = 'MESHCORE_ENABLE_DEV_FLIGHTLESS_ROUTE_E2E';
const FLIGHTLESS_NAME = 'FlightlessDt🥝';
const FLIGHTLESS_PUBLIC_KEY =
  'ae92577bae6c269a1da3c87b5333e1bdb007e372b66e94204b9f92a6b52a62b1';
const DEVELOPER_ONLY_NOTICE =
  `Developer-only hardware test. This scenario assumes ${FLIGHTLESS_NAME} ` +
  `(${FLIGHTLESS_PUBLIC_KEY.slice(0, 12)}...) is a nearby reachable node for the author's test radio. ` +
  `Set ${DEV_ONLY_ENV}=1 to run it intentionally.`;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test.describe('Developer-only direct-route learning for FlightlessDt🥝', () => {
  test('zero-hop adverts then DM ACK learns a direct route', { tag: '@developer-only' }, async ({
    page,
  }, testInfo) => {
    testInfo.annotations.push({ type: 'notice', description: DEVELOPER_ONLY_NOTICE });
    if (process.env[DEV_ONLY_ENV] !== '1') {
      test.skip(true, DEVELOPER_ONLY_NOTICE);
    }

    test.setTimeout(180_000);
    console.warn(`[developer-only e2e] ${DEVELOPER_ONLY_NOTICE}`);

    try {
      await deleteContact(FLIGHTLESS_PUBLIC_KEY);
    } catch {
      // Best-effort reset; the contact may not exist yet in the temp E2E DB.
    }

    await createContact(FLIGHTLESS_PUBLIC_KEY, FLIGHTLESS_NAME);
    await setContactRoutingOverride(FLIGHTLESS_PUBLIC_KEY, '');

    await expect
      .poll(
        async () => {
          const contact = await getContactByKey(FLIGHTLESS_PUBLIC_KEY);
          return contact?.direct_path_len ?? null;
        },
        {
          timeout: 10_000,
          message: 'Waiting for recreated FlightlessDt contact to start in flood mode',
        }
      )
      .toBe(-1);

    await page.goto('/#settings/radio');
    await expect(page.getByRole('status', { name: 'Radio OK' })).toBeVisible();

    const zeroHopButton = page.getByRole('button', { name: 'Send Zero-Hop Advertisement' });
    await expect(zeroHopButton).toBeVisible();

    await zeroHopButton.click();
    await expect(page.getByText('Zero-hop advertisement sent')).toBeVisible({ timeout: 15_000 });

    await page.waitForTimeout(5_000);

    await zeroHopButton.click();
    await expect(page.getByText('Zero-hop advertisement sent')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /Back to Chat/i }).click();
    await expect(page.getByRole('button', { name: /Back to Chat/i })).toBeHidden({
      timeout: 15_000,
    });

    const searchInput = page.getByLabel('Search conversations');
    await searchInput.fill(FLIGHTLESS_PUBLIC_KEY.slice(0, 12));
    await expect(page.getByText(FLIGHTLESS_NAME, { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByText(FLIGHTLESS_NAME, { exact: true }).click();
    await expect
      .poll(() => page.url(), {
        timeout: 15_000,
        message: 'Waiting for FlightlessDt conversation route to load',
      })
      .toContain(`#contact/${encodeURIComponent(FLIGHTLESS_PUBLIC_KEY)}`);
    await expect(
      page.getByPlaceholder(new RegExp(`message\\s+${escapeRegex(FLIGHTLESS_NAME)}`, 'i'))
    ).toBeVisible({ timeout: 15_000 });

    const text = `dev-flightless-direct-${Date.now()}`;
    const input = page.getByPlaceholder(/message/i);
    await input.fill(text);
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.getByText(text)).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(
        async () => {
          const messages = await getMessages({
            type: 'PRIV',
            conversation_key: FLIGHTLESS_PUBLIC_KEY,
            limit: 25,
          });
          const match = messages.find((message) => message.outgoing && message.text === text);
          return match?.acked ?? 0;
        },
        {
          timeout: 90_000,
          message: 'Waiting for FlightlessDt DM ACK',
        }
      )
      .toBeGreaterThan(0);

    await expect
      .poll(
        async () => {
          const contact = await getContactByKey(FLIGHTLESS_PUBLIC_KEY);
          return contact?.direct_path_len ?? null;
        },
        {
          timeout: 90_000,
          message: 'Waiting for FlightlessDt route to update from flood to direct',
        }
      )
      .toBe(0);

    const learnedContact = await getContactByKey(FLIGHTLESS_PUBLIC_KEY);
    expect(learnedContact?.direct_path ?? '').toBe('');

    await page.locator('[title="View contact info"]').click();
    await expect(page.getByLabel('Contact Info')).toBeVisible({ timeout: 15_000 });
  });
});
