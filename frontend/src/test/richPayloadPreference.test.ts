import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  RENDER_RICH_PAYLOADS_KEY,
  getSavedRenderRichPayloads,
  setSavedRenderRichPayloads,
} from '../utils/richPayloadPreference';

describe('richPayloadPreference utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to on when unset', () => {
    expect(getSavedRenderRichPayloads()).toBe(true);
  });

  it('returns true when enabled', () => {
    localStorage.setItem(RENDER_RICH_PAYLOADS_KEY, 'true');
    expect(getSavedRenderRichPayloads()).toBe(true);
  });

  it('returns false only when explicitly stored as false', () => {
    localStorage.setItem(RENDER_RICH_PAYLOADS_KEY, 'false');
    expect(getSavedRenderRichPayloads()).toBe(false);
  });

  it('defaults to on when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(getSavedRenderRichPayloads()).toBe(true);
  });

  it('persists true and false without removing the key', () => {
    setSavedRenderRichPayloads(true);
    expect(localStorage.getItem(RENDER_RICH_PAYLOADS_KEY)).toBe('true');

    setSavedRenderRichPayloads(false);
    expect(localStorage.getItem(RENDER_RICH_PAYLOADS_KEY)).toBe('false');
  });
});
