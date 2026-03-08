import { describe, expect, it } from 'vitest';

import {
  analyzeRepeaterTraffic,
  buildAmbiguousRepeaterLabel,
  buildAmbiguousRepeaterNodeId,
  recordTrafficObservation,
  type RepeaterTrafficData,
} from '../utils/visualizerUtils';

describe('visualizer multibyte hop identity helpers', () => {
  it('preserves the full hop token in ambiguous node ids', () => {
    expect(buildAmbiguousRepeaterNodeId('aa11')).toBe('?aa11');
    expect(buildAmbiguousRepeaterNodeId('bb22cc')).toBe('?bb22cc');
  });

  it('preserves the full current and next hop tokens in traffic split ids', () => {
    expect(buildAmbiguousRepeaterNodeId('aa', 'bb22')).toBe('?aa:>bb22');
    expect(buildAmbiguousRepeaterNodeId('aa11', 'cc33dd')).toBe('?aa11:>cc33dd');
  });

  it('formats labels from full hop tokens', () => {
    expect(buildAmbiguousRepeaterLabel('aa11')).toBe('AA11');
    expect(buildAmbiguousRepeaterLabel('aa11', 'bb22')).toBe('AA11:>BB22');
  });
});

describe('visualizer traffic pattern grouping', () => {
  it('tracks traffic using full hop tokens instead of first-byte buckets', () => {
    const traffic = new Map<string, RepeaterTrafficData>();

    for (let i = 0; i < 20; i += 1) {
      recordTrafficObservation(traffic, 'aa11', `src-a-${i}`, 'bb22');
      recordTrafficObservation(traffic, 'aa22', `src-b-${i}`, 'bb33');
    }

    expect(traffic.has('aa11')).toBe(true);
    expect(traffic.has('aa22')).toBe(true);
    expect(traffic.has('aa')).toBe(false);

    const firstTraffic = traffic.get('aa11');
    const secondTraffic = traffic.get('aa22');
    expect(firstTraffic).toBeDefined();
    expect(secondTraffic).toBeDefined();

    const first = analyzeRepeaterTraffic(firstTraffic!);
    const second = analyzeRepeaterTraffic(secondTraffic!);
    expect(first.shouldSplit).toBe(false);
    expect(second.shouldSplit).toBe(false);
  });
});
