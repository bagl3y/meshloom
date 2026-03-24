import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildBadgedFaviconSvg,
  deriveFaviconBadgeState,
  getFavoriteUnreadCount,
  getUnreadTitle,
  getTotalUnreadCount,
  useFaviconBadge,
  useUnreadTitle,
} from '../hooks/useFaviconBadge';
import type { Favorite } from '../types';
import { getStateKey } from '../utils/conversationState';

function getIconHref(rel: 'icon' | 'shortcut icon'): string | null {
  return (
    document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)?.getAttribute('href') ?? null
  );
}

describe('useFaviconBadge', () => {
  const baseSvg =
    '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1000" height="1000"/></svg>';
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  let objectUrlCounter = 0;
  let fetchMock: ReturnType<typeof vi.fn>;
  let createObjectURLMock: ReturnType<typeof vi.fn>;
  let revokeObjectURLMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.head.innerHTML = `
      <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      <link rel="shortcut icon" href="/favicon.ico" />
    `;
    document.title = 'RemoteTerm for MeshCore';
    objectUrlCounter = 0;
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => baseSvg,
    });
    createObjectURLMock = vi.fn(() => `blob:generated-${++objectUrlCounter}`);
    revokeObjectURLMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURLMock,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: originalRevokeObjectURL,
    });
  });

  it('derives badge priority from unread counts, mentions, and favorites', () => {
    const favorites: Favorite[] = [{ type: 'channel', id: 'fav-chan' }];

    expect(deriveFaviconBadgeState({}, {}, favorites)).toBe('none');
    expect(
      deriveFaviconBadgeState(
        {
          [getStateKey('channel', 'fav-chan')]: 3,
        },
        {},
        favorites
      )
    ).toBe('green');
    expect(
      deriveFaviconBadgeState(
        {
          [getStateKey('contact', 'abc')]: 12,
        },
        {},
        favorites
      )
    ).toBe('red');
    expect(
      deriveFaviconBadgeState(
        {
          [getStateKey('channel', 'fav-chan')]: 1,
        },
        {
          [getStateKey('channel', 'fav-chan')]: true,
        },
        favorites
      )
    ).toBe('red');
  });

  it('builds a dot-only badge into the base svg markup', () => {
    const svg = buildBadgedFaviconSvg(baseSvg, '#16a34a');

    expect(svg).toContain('<circle cx="750" cy="750" r="220" fill="#ffffff"/>');
    expect(svg).toContain('<circle cx="750" cy="750" r="180" fill="#16a34a"/>');
    expect(svg).not.toContain('<text');
  });

  it('derives the unread count and page title', () => {
    expect(getTotalUnreadCount({})).toBe(0);
    expect(getTotalUnreadCount({ a: 2, b: 5 })).toBe(7);
    expect(getFavoriteUnreadCount({}, [])).toBe(0);
    expect(
      getFavoriteUnreadCount(
        {
          [getStateKey('channel', 'fav-chan')]: 7,
          [getStateKey('contact', 'fav-contact')]: 3,
          [getStateKey('channel', 'other-chan')]: 9,
        },
        [
          { type: 'channel', id: 'fav-chan' },
          { type: 'contact', id: 'fav-contact' },
        ]
      )
    ).toBe(10);
    expect(getUnreadTitle({}, [])).toBe('RemoteTerm for MeshCore');
    expect(
      getUnreadTitle(
        {
          [getStateKey('channel', 'fav-chan')]: 7,
          [getStateKey('channel', 'other-chan')]: 9,
        },
        [{ type: 'channel', id: 'fav-chan' }]
      )
    ).toBe('(7) RemoteTerm');
    expect(
      getUnreadTitle(
        {
          [getStateKey('channel', 'fav-chan')]: 120,
        },
        [{ type: 'channel', id: 'fav-chan' }]
      )
    ).toBe('(99+) RemoteTerm');
  });

  it('switches between the base favicon and generated blob badges', async () => {
    const favorites: Favorite[] = [{ type: 'channel', id: 'fav-chan' }];
    const { rerender } = renderHook(
      ({
        unreadCounts,
        mentions,
        currentFavorites,
      }: {
        unreadCounts: Record<string, number>;
        mentions: Record<string, boolean>;
        currentFavorites: Favorite[];
      }) => useFaviconBadge(unreadCounts, mentions, currentFavorites),
      {
        initialProps: {
          unreadCounts: {},
          mentions: {},
          currentFavorites: favorites,
        },
      }
    );

    await waitFor(() => {
      expect(getIconHref('icon')).toBe('/favicon.svg');
      expect(getIconHref('shortcut icon')).toBe('/favicon.svg');
    });

    rerender({
      unreadCounts: {
        [getStateKey('channel', 'fav-chan')]: 1,
      },
      mentions: {},
      currentFavorites: favorites,
    });

    await waitFor(() => {
      expect(getIconHref('icon')).toBe('blob:generated-1');
      expect(getIconHref('shortcut icon')).toBe('blob:generated-1');
    });

    rerender({
      unreadCounts: {
        [getStateKey('contact', 'dm-key')]: 12,
      },
      mentions: {},
      currentFavorites: favorites,
    });

    await waitFor(() => {
      expect(getIconHref('icon')).toBe('blob:generated-2');
      expect(getIconHref('shortcut icon')).toBe('blob:generated-2');
    });

    rerender({
      unreadCounts: {},
      mentions: {},
      currentFavorites: favorites,
    });

    await waitFor(() => {
      expect(getIconHref('icon')).toBe('/favicon.svg');
      expect(getIconHref('shortcut icon')).toBe('/favicon.svg');
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(createObjectURLMock).toHaveBeenCalledTimes(2);
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:generated-1');
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:generated-2');
  });

  it('writes unread counts into the page title', () => {
    const { rerender, unmount } = renderHook(
      ({
        unreadCounts,
        favorites,
      }: {
        unreadCounts: Record<string, number>;
        favorites: Favorite[];
      }) => useUnreadTitle(unreadCounts, favorites),
      {
        initialProps: {
          unreadCounts: {},
          favorites: [{ type: 'channel', id: 'fav-chan' }],
        },
      }
    );

    expect(document.title).toBe('RemoteTerm for MeshCore');

    rerender({
      unreadCounts: {
        [getStateKey('channel', 'fav-chan')]: 4,
        [getStateKey('contact', 'dm-key')]: 2,
      },
      favorites: [{ type: 'channel', id: 'fav-chan' }],
    });

    expect(document.title).toBe('(4) RemoteTerm');

    unmount();

    expect(document.title).toBe('RemoteTerm for MeshCore');
  });
});
