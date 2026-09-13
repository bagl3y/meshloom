import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  STATUS_DOT_IDLE_SIZE_PX,
  STATUS_DOT_PULSE_DURATION_MS,
  STATUS_DOT_PULSE_PACKET_EVENT,
  STATUS_DOT_PULSE_SIZE_PX,
  emitStatusDotPulse,
  getStatusDotPulseEnabled,
  payloadTypeToPulseKind,
  pulseColorFor,
  setStatusDotPulseEnabled,
} from '../utils/statusDotPulse';

const STORAGE_KEY = 'meshloom-status-dot-pulse';

function hslLightness(color: string): number {
  const match = color.match(/hsl\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*([\d.]+)%\s*\)/i);
  if (!match) {
    throw new Error(`expected hsl color, got ${color}`);
  }
  return Number(match[1]);
}

describe('statusDotPulse utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to on when unset', () => {
    expect(getStatusDotPulseEnabled()).toBe(true);
  });

  it('returns true when enabled', () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    expect(getStatusDotPulseEnabled()).toBe(true);
  });

  it('returns false only when explicitly stored as false', () => {
    localStorage.setItem(STORAGE_KEY, 'false');
    expect(getStatusDotPulseEnabled()).toBe(false);
  });

  it('defaults to on when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(getStatusDotPulseEnabled()).toBe(true);
  });

  it('persists true and false without removing the key', () => {
    setStatusDotPulseEnabled(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');

    setStatusDotPulseEnabled(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('false');
  });

  it('maps payload types to pulse kinds', () => {
    expect(payloadTypeToPulseKind('GROUP_TEXT')).toBe('channel');
    expect(payloadTypeToPulseKind('TEXT_MESSAGE')).toBe('dm');
    expect(payloadTypeToPulseKind('ADVERT')).toBe('advert');
    expect(payloadTypeToPulseKind('TRACE')).toBe('other');
    expect(payloadTypeToPulseKind(null)).toBe('other');
  });

  it('uses a mid-lightness green for other packets', () => {
    const lightness = hslLightness(pulseColorFor('other'));
    expect(lightness).toBeGreaterThanOrEqual(38);
    expect(lightness).toBeLessThanOrEqual(55);
  });

  it('holds the pulse longer than a brief color flash', () => {
    expect(STATUS_DOT_PULSE_DURATION_MS).toBe(700);
  });

  it('enlarges the idle 8px dot to about 10–12px while pulsing', () => {
    expect(STATUS_DOT_IDLE_SIZE_PX).toBe(8);
    expect(STATUS_DOT_PULSE_SIZE_PX).toBeGreaterThanOrEqual(10);
    expect(STATUS_DOT_PULSE_SIZE_PX).toBeLessThanOrEqual(12);
  });

  it('emits a packet pulse event with the mapped kind', () => {
    const handler = vi.fn();
    window.addEventListener(STATUS_DOT_PULSE_PACKET_EVENT, handler);
    emitStatusDotPulse('GROUP_TEXT');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toMatchObject({ detail: 'channel' });
    window.removeEventListener(STATUS_DOT_PULSE_PACKET_EVENT, handler);
  });
});
