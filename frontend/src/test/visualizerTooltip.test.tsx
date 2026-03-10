import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { VisualizerTooltip } from '../components/visualizer/VisualizerTooltip';
import type { GraphNode } from '../components/visualizer/shared';

function createNode(overrides: Partial<GraphNode> & Pick<GraphNode, 'id' | 'type'>): GraphNode {
  return {
    id: overrides.id,
    type: overrides.type,
    name: overrides.name ?? null,
    isAmbiguous: overrides.isAmbiguous ?? false,
    lastActivity: overrides.lastActivity ?? Date.now(),
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    z: overrides.z ?? 0,
    probableIdentity: overrides.probableIdentity,
    ambiguousNames: overrides.ambiguousNames,
    lastActivityReason: overrides.lastActivityReason,
  };
}

describe('VisualizerTooltip', () => {
  it('renders nothing without an active node', () => {
    const { container } = render(
      <VisualizerTooltip activeNodeId={null} nodes={new Map()} neighborIds={[]} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders ambiguous node details and neighbors', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T22:00:00Z'));

    const node = createNode({
      id: '?32',
      type: 'repeater',
      name: 'Likely Relay',
      isAmbiguous: true,
      probableIdentity: 'Likely Relay',
      ambiguousNames: ['Relay A', 'Relay B'],
      lastActivity: new Date('2026-03-10T21:58:30Z').getTime(),
      lastActivityReason: 'Relayed GT',
    });
    const neighbor = createNode({
      id: 'abcd1234ef56',
      type: 'client',
      name: 'Neighbor Node',
      ambiguousNames: ['Alt Neighbor'],
    });

    render(
      <VisualizerTooltip
        activeNodeId={node.id}
        nodes={
          new Map([
            [node.id, node],
            [neighbor.id, neighbor],
          ])
        }
        neighborIds={[neighbor.id]}
      />
    );

    expect(screen.getByText('Likely Relay')).toBeInTheDocument();
    expect(screen.getByText('ID: ?32')).toBeInTheDocument();
    expect(screen.getByText('Type: repeater (ambiguous)')).toBeInTheDocument();
    expect(screen.getByText('Probably: Likely Relay')).toBeInTheDocument();
    expect(screen.getByText('Other possible: Relay A, Relay B')).toBeInTheDocument();
    expect(screen.getByText('Last active: 1m 30s ago')).toBeInTheDocument();
    expect(screen.getByText('Reason: Relayed GT')).toBeInTheDocument();
    expect(screen.getByText('Neighbor Node')).toBeInTheDocument();
    expect(screen.getByText('(Alt Neighbor)')).toBeInTheDocument();

    vi.useRealTimers();
  });
});
