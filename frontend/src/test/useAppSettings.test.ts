import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api';
import { useAppSettings } from '../hooks/useAppSettings';

const mocks = vi.hoisted(() => ({
  api: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    toggleBlockedKey: vi.fn(),
    toggleBlockedName: vi.fn(),
    toggleTrackedTelemetry: vi.fn(),
    toggleTrackedTelemetryContact: vi.fn(),
    toggleFavorite: vi.fn(),
  },
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  takePrefetchOrFetch: vi.fn(),
}));

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...actual,
    api: mocks.api,
  };
});

vi.mock('../components/ui/sonner', () => ({
  toast: mocks.toast,
}));

vi.mock('../prefetch', () => ({
  takePrefetchOrFetch: mocks.takePrefetchOrFetch,
}));

describe('useAppSettings telemetry toasts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the backend 409 message when repeater telemetry is full', async () => {
    mocks.api.toggleTrackedTelemetry.mockRejectedValue(
      new ApiError('Limit of 8 tracked repeaters reached', 409, {
        message: 'Limit of 8 tracked repeaters reached',
        tracked_telemetry_repeaters: [],
      })
    );

    const { result } = renderHook(() => useAppSettings());
    await act(async () => {
      await result.current.handleToggleTrackedTelemetry('aa'.repeat(32));
    });

    expect(mocks.toast.error).toHaveBeenCalledWith('Limit of 8 tracked repeaters reached');
  });

  it('shows the backend 409 message when contact telemetry is full', async () => {
    mocks.api.toggleTrackedTelemetryContact.mockRejectedValue(
      new ApiError('Limit of 8 tracked contacts reached', 409, {
        message: 'Limit of 8 tracked contacts reached',
      })
    );

    const { result } = renderHook(() => useAppSettings());
    await act(async () => {
      await result.current.handleToggleTrackedTelemetryContact('bb'.repeat(32));
    });

    expect(mocks.toast.error).toHaveBeenCalledWith('Limit of 8 tracked contacts reached');
  });
});
