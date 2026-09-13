import { describe, expect, it } from 'vitest';

import snapshot from '../data/meshcoreChannels.snapshot.json';
import { MESHCORE_CHANNEL_NAMES } from '../data/meshcoreChannels';

describe('meshcore-channels snapshot', () => {
  it('exports the CC0 names-only snapshot', () => {
    expect(snapshot.license).toBe('CC0-1.0');
    expect(snapshot.generated_at).toBeTruthy();
    expect(MESHCORE_CHANNEL_NAMES.length).toBeGreaterThan(0);
    expect(MESHCORE_CHANNEL_NAMES).toEqual(snapshot.names);
  });

  it('contains unique names without leading hashes', () => {
    expect(new Set(MESHCORE_CHANNEL_NAMES).size).toBe(MESHCORE_CHANNEL_NAMES.length);
    expect(MESHCORE_CHANNEL_NAMES.every((name) => name.length > 0 && !name.startsWith('#'))).toBe(
      true
    );
  });
});
