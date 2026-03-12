import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  forceCenter,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  forceZ,
  type ForceLink3D,
  type Simulation3D,
} from 'd3-force-3d';
import { PayloadType } from '@michaelhart/meshcore-decoder';

import {
  CONTACT_TYPE_REPEATER,
  type Contact,
  type ContactAdvertPathSummary,
  type RadioConfig,
  type RawPacket,
} from '../../types';
import { getRawPacketObservationKey } from '../../utils/rawPacketIdentity';
import {
  buildLinkKey,
  type Particle,
  type PathStep,
  type PendingPacket,
  type RepeaterTrafficData,
  PARTICLE_COLOR_MAP,
  PARTICLE_SPEED,
  analyzeRepeaterTraffic,
  buildAmbiguousRepeaterLabel,
  buildAmbiguousRepeaterNodeId,
  compactPathSteps,
  dedupeConsecutive,
  generatePacketKey,
  getNodeType,
  getPacketLabel,
  parsePacket,
  recordTrafficObservation,
} from '../../utils/visualizerUtils';
import { type GraphLink, type GraphNode, normalizePacketTimestampMs } from './shared';

export interface UseVisualizerData3DOptions {
  packets: RawPacket[];
  contacts: Contact[];
  config: RadioConfig | null;
  repeaterAdvertPaths: ContactAdvertPathSummary[];
  showAmbiguousPaths: boolean;
  showAmbiguousNodes: boolean;
  useAdvertPathHints: boolean;
  splitAmbiguousByTraffic: boolean;
  chargeStrength: number;
  letEmDrift: boolean;
  particleSpeedMultiplier: number;
  observationWindowSec: number;
  pruneStaleNodes: boolean;
  pruneStaleMinutes: number;
}

export interface VisualizerData3D {
  nodes: Map<string, GraphNode>;
  links: Map<string, GraphLink>;
  particles: Particle[];
  stats: { processed: number; animated: number; nodes: number; links: number };
  expandContract: () => void;
  clearAndReset: () => void;
}

export function useVisualizerData3D({
  packets,
  contacts,
  config,
  repeaterAdvertPaths,
  showAmbiguousPaths,
  showAmbiguousNodes,
  useAdvertPathHints,
  splitAmbiguousByTraffic,
  chargeStrength,
  letEmDrift,
  particleSpeedMultiplier,
  observationWindowSec,
  pruneStaleNodes,
  pruneStaleMinutes,
}: UseVisualizerData3DOptions): VisualizerData3D {
  const nodesRef = useRef<Map<string, GraphNode>>(new Map());
  const linksRef = useRef<Map<string, GraphLink>>(new Map());
  const particlesRef = useRef<Particle[]>([]);
  const simulationRef = useRef<Simulation3D<GraphNode, GraphLink> | null>(null);
  const processedRef = useRef<Set<string>>(new Set());
  const pendingRef = useRef<Map<string, PendingPacket>>(new Map());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const trafficPatternsRef = useRef<Map<string, RepeaterTrafficData>>(new Map());
  const speedMultiplierRef = useRef(particleSpeedMultiplier);
  const observationWindowRef = useRef(observationWindowSec * 1000);
  const stretchRafRef = useRef<number | null>(null);
  const [stats, setStats] = useState({ processed: 0, animated: 0, nodes: 0, links: 0 });

  const contactIndex = useMemo(() => {
    const byPrefix12 = new Map<string, Contact>();
    const byName = new Map<string, Contact>();
    const byPrefix = new Map<string, Contact[]>();

    for (const contact of contacts) {
      const prefix12 = contact.public_key.slice(0, 12).toLowerCase();
      byPrefix12.set(prefix12, contact);

      if (contact.name && !byName.has(contact.name)) {
        byName.set(contact.name, contact);
      }

      for (let len = 1; len <= 12; len++) {
        const prefix = prefix12.slice(0, len);
        const matches = byPrefix.get(prefix);
        if (matches) {
          matches.push(contact);
        } else {
          byPrefix.set(prefix, [contact]);
        }
      }
    }

    return { byPrefix12, byName, byPrefix };
  }, [contacts]);

  const advertPathIndex = useMemo(() => {
    const byRepeater = new Map<string, ContactAdvertPathSummary['paths']>();
    for (const summary of repeaterAdvertPaths) {
      const key = summary.public_key.slice(0, 12).toLowerCase();
      byRepeater.set(key, summary.paths);
    }
    return { byRepeater };
  }, [repeaterAdvertPaths]);

  useEffect(() => {
    speedMultiplierRef.current = particleSpeedMultiplier;
  }, [particleSpeedMultiplier]);

  useEffect(() => {
    observationWindowRef.current = observationWindowSec * 1000;
  }, [observationWindowSec]);

  useEffect(() => {
    const sim = forceSimulation<GraphNode, GraphLink>([])
      .numDimensions(3)
      .force(
        'link',
        forceLink<GraphNode, GraphLink>([])
          .id((d) => d.id)
          .distance(120)
          .strength(0.3)
      )
      .force(
        'charge',
        forceManyBody<GraphNode>()
          .strength((d) => (d.id === 'self' ? -1200 : -200))
          .distanceMax(800)
      )
      .force('center', forceCenter(0, 0, 0))
      .force(
        'selfX',
        forceX<GraphNode>(0).strength((d) => (d.id === 'self' ? 0.1 : 0))
      )
      .force(
        'selfY',
        forceY<GraphNode>(0).strength((d) => (d.id === 'self' ? 0.1 : 0))
      )
      .force(
        'selfZ',
        forceZ<GraphNode>(0).strength((d) => (d.id === 'self' ? 0.1 : 0))
      )
      .alphaDecay(0.02)
      .velocityDecay(0.5)
      .alphaTarget(0.03);

    simulationRef.current = sim;
    return () => {
      sim.stop();
    };
  }, []);

  useEffect(() => {
    const sim = simulationRef.current;
    if (!sim) return;

    sim.force(
      'charge',
      forceManyBody<GraphNode>()
        .strength((d) => (d.id === 'self' ? chargeStrength * 6 : chargeStrength))
        .distanceMax(800)
    );
    sim.alpha(0.3).restart();
  }, [chargeStrength]);

  useEffect(() => {
    const sim = simulationRef.current;
    if (!sim) return;
    sim.alphaTarget(letEmDrift ? 0.05 : 0);
  }, [letEmDrift]);

  const syncSimulation = useCallback(() => {
    const sim = simulationRef.current;
    if (!sim) return;

    const nodes = Array.from(nodesRef.current.values());
    const links = Array.from(linksRef.current.values());

    sim.nodes(nodes);
    const linkForce = sim.force('link') as ForceLink3D<GraphNode, GraphLink> | undefined;
    linkForce?.links(links);

    sim.alpha(0.15).restart();

    setStats((prev) =>
      prev.nodes === nodes.length && prev.links === links.length
        ? prev
        : { ...prev, nodes: nodes.length, links: links.length }
    );
  }, []);

  useEffect(() => {
    if (!nodesRef.current.has('self')) {
      nodesRef.current.set('self', {
        id: 'self',
        name: config?.name || 'Me',
        type: 'self',
        isAmbiguous: false,
        lastActivity: Date.now(),
        x: 0,
        y: 0,
        z: 0,
      });
      syncSimulation();
    }
  }, [config, syncSimulation]);

  useEffect(() => {
    processedRef.current.clear();
    const selfNode = nodesRef.current.get('self');
    nodesRef.current.clear();
    if (selfNode) nodesRef.current.set('self', selfNode);
    linksRef.current.clear();
    particlesRef.current = [];
    pendingRef.current.clear();
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current.clear();
    trafficPatternsRef.current.clear();
    setStats({ processed: 0, animated: 0, nodes: selfNode ? 1 : 0, links: 0 });
    syncSimulation();
  }, [
    showAmbiguousPaths,
    showAmbiguousNodes,
    useAdvertPathHints,
    splitAmbiguousByTraffic,
    syncSimulation,
  ]);

  const addNode = useCallback(
    (
      id: string,
      name: string | null,
      type: GraphNode['type'],
      isAmbiguous: boolean,
      probableIdentity?: string | null,
      ambiguousNames?: string[],
      lastSeen?: number | null,
      activityAtMs?: number
    ) => {
      const activityAt = activityAtMs ?? Date.now();
      const existing = nodesRef.current.get(id);
      if (existing) {
        existing.lastActivity = Math.max(existing.lastActivity, activityAt);
        if (name) existing.name = name;
        if (probableIdentity !== undefined) existing.probableIdentity = probableIdentity;
        if (ambiguousNames) existing.ambiguousNames = ambiguousNames;
        if (lastSeen !== undefined) existing.lastSeen = lastSeen;
      } else {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 80 + Math.random() * 100;
        nodesRef.current.set(id, {
          id,
          name,
          type,
          isAmbiguous,
          lastActivity: activityAt,
          probableIdentity,
          lastSeen,
          ambiguousNames,
          x: r * Math.sin(phi) * Math.cos(theta),
          y: r * Math.sin(phi) * Math.sin(theta),
          z: r * Math.cos(phi),
        });
      }
    },
    []
  );

  const addLink = useCallback(
    (
      sourceId: string,
      targetId: string,
      activityAtMs?: number,
      hiddenIntermediate: boolean = false
    ) => {
      const activityAt = activityAtMs ?? Date.now();
      const key = buildLinkKey(sourceId, targetId);
      const existing = linksRef.current.get(key);
      if (existing) {
        existing.lastActivity = Math.max(existing.lastActivity, activityAt);
        if (hiddenIntermediate) {
          existing.hasHiddenIntermediate = true;
        } else {
          existing.hasDirectObservation = true;
        }
      } else {
        linksRef.current.set(key, {
          source: sourceId,
          target: targetId,
          lastActivity: activityAt,
          hasDirectObservation: !hiddenIntermediate,
          hasHiddenIntermediate: hiddenIntermediate,
        });
      }
    },
    []
  );

  const publishPacket = useCallback((packetKey: string) => {
    const pending = pendingRef.current.get(packetKey);
    if (!pending) return;

    pendingRef.current.delete(packetKey);
    timersRef.current.delete(packetKey);

    if (document.hidden) return;

    for (const path of pending.paths) {
      const dedupedPath = dedupeConsecutive(path.nodes);
      if (dedupedPath.length < 2) continue;

      for (let i = 0; i < dedupedPath.length - 1; i++) {
        particlesRef.current.push({
          linkKey: buildLinkKey(dedupedPath[i], dedupedPath[i + 1]),
          progress: -i,
          speed: PARTICLE_SPEED * speedMultiplierRef.current,
          color: PARTICLE_COLOR_MAP[pending.label],
          label: pending.label,
          fromNodeId: dedupedPath[i],
          toNodeId: dedupedPath[i + 1],
        });
      }
    }
  }, []);

  const pickLikelyRepeaterByAdvertPath = useCallback(
    (candidates: Contact[], nextPrefix: string | null) => {
      const nextHop = nextPrefix?.toLowerCase() ?? null;
      const scored = candidates
        .map((candidate) => {
          const prefix12 = candidate.public_key.slice(0, 12).toLowerCase();
          const paths = advertPathIndex.byRepeater.get(prefix12) ?? [];
          let matchScore = 0;
          let totalScore = 0;

          for (const path of paths) {
            totalScore += path.heard_count;
            const pathNextHop = path.next_hop?.toLowerCase() ?? null;
            if (pathNextHop === nextHop) {
              matchScore += path.heard_count;
            }
          }

          return { candidate, matchScore, totalScore };
        })
        .filter((entry) => entry.totalScore > 0)
        .sort(
          (a, b) =>
            b.matchScore - a.matchScore ||
            b.totalScore - a.totalScore ||
            a.candidate.public_key.localeCompare(b.candidate.public_key)
        );

      if (scored.length === 0) return null;

      const top = scored[0];
      const second = scored[1] ?? null;

      if (top.matchScore < 2) return null;
      if (second && top.matchScore < second.matchScore * 2) return null;

      return top.candidate;
    },
    [advertPathIndex]
  );

  const resolveNode = useCallback(
    (
      source: { type: 'prefix' | 'pubkey' | 'name'; value: string },
      isRepeater: boolean,
      showAmbiguous: boolean,
      myPrefix: string | null,
      activityAtMs: number,
      trafficContext?: { packetSource: string | null; nextPrefix: string | null }
    ): string | null => {
      if (source.type === 'pubkey') {
        if (source.value.length < 12) return null;
        const nodeId = source.value.slice(0, 12).toLowerCase();
        if (myPrefix && nodeId === myPrefix) return 'self';
        const contact = contactIndex.byPrefix12.get(nodeId);
        addNode(
          nodeId,
          contact?.name || null,
          getNodeType(contact),
          false,
          undefined,
          undefined,
          contact?.last_seen,
          activityAtMs
        );
        return nodeId;
      }

      if (source.type === 'name') {
        const contact = contactIndex.byName.get(source.value) ?? null;
        if (contact) {
          const nodeId = contact.public_key.slice(0, 12).toLowerCase();
          if (myPrefix && nodeId === myPrefix) return 'self';
          addNode(
            nodeId,
            contact.name,
            getNodeType(contact),
            false,
            undefined,
            undefined,
            contact.last_seen,
            activityAtMs
          );
          return nodeId;
        }
        const nodeId = `name:${source.value}`;
        addNode(
          nodeId,
          source.value,
          'client',
          false,
          undefined,
          undefined,
          undefined,
          activityAtMs
        );
        return nodeId;
      }

      const lookupValue = source.value.toLowerCase();
      const matches = contactIndex.byPrefix.get(lookupValue) ?? [];
      const contact = matches.length === 1 ? matches[0] : null;
      if (contact) {
        const nodeId = contact.public_key.slice(0, 12).toLowerCase();
        if (myPrefix && nodeId === myPrefix) return 'self';
        addNode(
          nodeId,
          contact.name,
          getNodeType(contact),
          false,
          undefined,
          undefined,
          contact.last_seen,
          activityAtMs
        );
        return nodeId;
      }

      if (showAmbiguous) {
        const filtered = isRepeater
          ? matches.filter((c) => c.type === CONTACT_TYPE_REPEATER)
          : matches.filter((c) => c.type !== CONTACT_TYPE_REPEATER);

        if (filtered.length === 1) {
          const c = filtered[0];
          const nodeId = c.public_key.slice(0, 12).toLowerCase();
          addNode(
            nodeId,
            c.name,
            getNodeType(c),
            false,
            undefined,
            undefined,
            c.last_seen,
            activityAtMs
          );
          return nodeId;
        }

        if (filtered.length > 1 || (filtered.length === 0 && isRepeater)) {
          const names = filtered.map((c) => c.name || c.public_key.slice(0, 8));
          const lastSeen = filtered.reduce(
            (max, c) => (c.last_seen && (!max || c.last_seen > max) ? c.last_seen : max),
            null as number | null
          );

          let nodeId = buildAmbiguousRepeaterNodeId(lookupValue);
          let displayName = buildAmbiguousRepeaterLabel(lookupValue);
          let probableIdentity: string | null = null;
          let ambiguousNames = names.length > 0 ? names : undefined;

          if (useAdvertPathHints && isRepeater && trafficContext) {
            const normalizedNext = trafficContext.nextPrefix?.toLowerCase() ?? null;
            const likely = pickLikelyRepeaterByAdvertPath(filtered, normalizedNext);
            if (likely) {
              const likelyName = likely.name || likely.public_key.slice(0, 12).toUpperCase();
              probableIdentity = likelyName;
              displayName = likelyName;
              ambiguousNames = filtered
                .filter((c) => c.public_key !== likely.public_key)
                .map((c) => c.name || c.public_key.slice(0, 8));
            }
          }

          if (splitAmbiguousByTraffic && isRepeater && trafficContext) {
            const normalizedNext = trafficContext.nextPrefix?.toLowerCase() ?? null;

            if (trafficContext.packetSource) {
              recordTrafficObservation(
                trafficPatternsRef.current,
                lookupValue,
                trafficContext.packetSource,
                normalizedNext
              );
            }

            const trafficData = trafficPatternsRef.current.get(lookupValue);
            if (trafficData) {
              const analysis = analyzeRepeaterTraffic(trafficData);
              if (analysis.shouldSplit && normalizedNext) {
                nodeId = buildAmbiguousRepeaterNodeId(lookupValue, normalizedNext);
                if (!probableIdentity) {
                  displayName = buildAmbiguousRepeaterLabel(lookupValue, normalizedNext);
                }
              }
            }
          }

          addNode(
            nodeId,
            displayName,
            isRepeater ? 'repeater' : 'client',
            true,
            probableIdentity,
            ambiguousNames,
            lastSeen,
            activityAtMs
          );
          return nodeId;
        }
      }

      return null;
    },
    [
      contactIndex,
      addNode,
      useAdvertPathHints,
      pickLikelyRepeaterByAdvertPath,
      splitAmbiguousByTraffic,
    ]
  );

  const buildPath = useCallback(
    (
      parsed: ReturnType<typeof parsePacket>,
      packet: RawPacket,
      myPrefix: string | null,
      activityAtMs: number
    ): { nodes: string[]; dashedLinkKeys: Set<string> } => {
      if (!parsed) return { nodes: [], dashedLinkKeys: new Set() };
      const steps: PathStep[] = [];
      let packetSource: string | null = null;
      const isDm = parsed.payloadType === PayloadType.TextMessage;
      const isOutgoingDm = isDm && !!myPrefix && parsed.srcHash?.toLowerCase() === myPrefix;

      if (parsed.payloadType === PayloadType.Advert && parsed.advertPubkey) {
        const nodeId = resolveNode(
          { type: 'pubkey', value: parsed.advertPubkey },
          false,
          false,
          myPrefix,
          activityAtMs
        );
        if (nodeId) {
          steps.push({ nodeId });
          packetSource = nodeId;
        }
      } else if (parsed.payloadType === PayloadType.AnonRequest && parsed.anonRequestPubkey) {
        const nodeId = resolveNode(
          { type: 'pubkey', value: parsed.anonRequestPubkey },
          false,
          false,
          myPrefix,
          activityAtMs
        );
        if (nodeId) {
          steps.push({ nodeId });
          packetSource = nodeId;
        }
      } else if (parsed.payloadType === PayloadType.TextMessage && parsed.srcHash) {
        if (myPrefix && parsed.srcHash.toLowerCase() === myPrefix) {
          steps.push({ nodeId: 'self' });
          packetSource = 'self';
        } else {
          const nodeId = resolveNode(
            { type: 'prefix', value: parsed.srcHash },
            false,
            showAmbiguousNodes,
            myPrefix,
            activityAtMs
          );
          if (nodeId) {
            steps.push({ nodeId });
            packetSource = nodeId;
          }
        }
      } else if (parsed.payloadType === PayloadType.GroupText) {
        const senderName = parsed.groupTextSender || packet.decrypted_info?.sender;
        if (senderName) {
          const resolved = resolveNode(
            { type: 'name', value: senderName },
            false,
            false,
            myPrefix,
            activityAtMs
          );
          if (resolved) {
            steps.push({ nodeId: resolved });
            packetSource = resolved;
          }
        }
      }

      for (let i = 0; i < parsed.pathBytes.length; i++) {
        const hexPrefix = parsed.pathBytes[i];
        const nextPrefix = parsed.pathBytes[i + 1] || null;
        const nodeId = resolveNode(
          { type: 'prefix', value: hexPrefix },
          true,
          showAmbiguousPaths,
          myPrefix,
          activityAtMs,
          { packetSource, nextPrefix }
        );
        steps.push({ nodeId, markHiddenLinkWhenOmitted: true });
      }

      if (parsed.payloadType === PayloadType.TextMessage && parsed.dstHash) {
        if (myPrefix && parsed.dstHash.toLowerCase() === myPrefix) {
          steps.push({ nodeId: 'self' });
        } else {
          const nodeId = resolveNode(
            { type: 'prefix', value: parsed.dstHash },
            false,
            showAmbiguousNodes,
            myPrefix,
            activityAtMs
          );
          if (nodeId) {
            steps.push({ nodeId });
          } else if (!isOutgoingDm) {
            steps.push({ nodeId: 'self' });
          }
        }
      } else {
        const hasVisibleNode = steps.some((step) => step.nodeId !== null);
        if (hasVisibleNode) {
          steps.push({ nodeId: 'self' });
        }
      }

      const compacted = compactPathSteps(steps);
      return {
        nodes: dedupeConsecutive(compacted.nodes),
        dashedLinkKeys: compacted.dashedLinkKeys,
      };
    },
    [resolveNode, showAmbiguousPaths, showAmbiguousNodes]
  );

  useEffect(() => {
    let newProcessed = 0;
    let newAnimated = 0;
    let needsUpdate = false;
    const myPrefix = config?.public_key?.slice(0, 12).toLowerCase() || null;

    for (const packet of packets) {
      const observationKey = getRawPacketObservationKey(packet);
      if (processedRef.current.has(observationKey)) continue;
      processedRef.current.add(observationKey);
      newProcessed++;

      if (processedRef.current.size > 1000) {
        processedRef.current = new Set(Array.from(processedRef.current).slice(-500));
      }

      const parsed = parsePacket(packet.data);
      if (!parsed) continue;

      const packetActivityAt = normalizePacketTimestampMs(packet.timestamp);
      const builtPath = buildPath(parsed, packet, myPrefix, packetActivityAt);
      if (builtPath.nodes.length < 2) continue;

      const label = getPacketLabel(parsed.payloadType);
      for (let i = 0; i < builtPath.nodes.length; i++) {
        const n = nodesRef.current.get(builtPath.nodes[i]);
        if (n && n.id !== 'self') {
          n.lastActivityReason = i === 0 ? `${label} source` : `Relayed ${label}`;
        }
      }

      for (let i = 0; i < builtPath.nodes.length - 1; i++) {
        if (builtPath.nodes[i] !== builtPath.nodes[i + 1]) {
          const linkKey = buildLinkKey(builtPath.nodes[i], builtPath.nodes[i + 1]);
          addLink(
            builtPath.nodes[i],
            builtPath.nodes[i + 1],
            packetActivityAt,
            builtPath.dashedLinkKeys.has(linkKey)
          );
          needsUpdate = true;
        }
      }

      const packetKey = generatePacketKey(parsed, packet);
      const now = Date.now();
      const existing = pendingRef.current.get(packetKey);

      if (existing && now < existing.expiresAt) {
        existing.paths.push({ nodes: builtPath.nodes, snr: packet.snr ?? null, timestamp: now });
      } else {
        const existingTimer = timersRef.current.get(packetKey);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }
        const windowMs = observationWindowRef.current;
        pendingRef.current.set(packetKey, {
          key: packetKey,
          label: getPacketLabel(parsed.payloadType),
          paths: [{ nodes: builtPath.nodes, snr: packet.snr ?? null, timestamp: now }],
          firstSeen: now,
          expiresAt: now + windowMs,
        });
        timersRef.current.set(
          packetKey,
          setTimeout(() => publishPacket(packetKey), windowMs)
        );
      }

      if (pendingRef.current.size > 100) {
        const entries = Array.from(pendingRef.current.entries())
          .sort((a, b) => a[1].firstSeen - b[1].firstSeen)
          .slice(0, 50);
        for (const [key] of entries) {
          const timer = timersRef.current.get(key);
          if (timer) {
            clearTimeout(timer);
          }
          timersRef.current.delete(key);
          pendingRef.current.delete(key);
        }
      }

      newAnimated++;
    }

    if (needsUpdate) syncSimulation();
    if (newProcessed > 0) {
      setStats((prev) => ({
        ...prev,
        processed: prev.processed + newProcessed,
        animated: prev.animated + newAnimated,
      }));
    }
  }, [packets, config, buildPath, addLink, syncSimulation, publishPacket]);

  const expandContract = useCallback(() => {
    const sim = simulationRef.current;
    if (!sim) return;

    if (stretchRafRef.current !== null) {
      cancelAnimationFrame(stretchRafRef.current);
      stretchRafRef.current = null;
    }

    const startChargeStrength = chargeStrength;
    const peakChargeStrength = -5000;
    const startLinkStrength = 0.3;
    const minLinkStrength = 0.02;
    const expandDuration = 1000;
    const holdDuration = 2000;
    const contractDuration = 1000;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      let currentChargeStrength: number;
      let currentLinkStrength: number;

      if (elapsed < expandDuration) {
        const t = elapsed / expandDuration;
        currentChargeStrength =
          startChargeStrength + (peakChargeStrength - startChargeStrength) * t;
        currentLinkStrength = startLinkStrength + (minLinkStrength - startLinkStrength) * t;
      } else if (elapsed < expandDuration + holdDuration) {
        currentChargeStrength = peakChargeStrength;
        currentLinkStrength = minLinkStrength;
      } else if (elapsed < expandDuration + holdDuration + contractDuration) {
        const t = (elapsed - expandDuration - holdDuration) / contractDuration;
        currentChargeStrength = peakChargeStrength + (startChargeStrength - peakChargeStrength) * t;
        currentLinkStrength = minLinkStrength + (startLinkStrength - minLinkStrength) * t;
      } else {
        sim.force(
          'charge',
          forceManyBody<GraphNode>()
            .strength((d) => (d.id === 'self' ? startChargeStrength * 6 : startChargeStrength))
            .distanceMax(800)
        );
        sim.force(
          'link',
          forceLink<GraphNode, GraphLink>(Array.from(linksRef.current.values()))
            .id((d) => d.id)
            .distance(120)
            .strength(startLinkStrength)
        );
        sim.alpha(0.3).restart();
        stretchRafRef.current = null;
        return;
      }

      sim.force(
        'charge',
        forceManyBody<GraphNode>()
          .strength((d) => (d.id === 'self' ? currentChargeStrength * 6 : currentChargeStrength))
          .distanceMax(800)
      );
      sim.force(
        'link',
        forceLink<GraphNode, GraphLink>(Array.from(linksRef.current.values()))
          .id((d) => d.id)
          .distance(120)
          .strength(currentLinkStrength)
      );
      sim.alpha(0.5).restart();

      stretchRafRef.current = requestAnimationFrame(animate);
    };

    stretchRafRef.current = requestAnimationFrame(animate);
  }, [chargeStrength]);

  const clearAndReset = useCallback(() => {
    if (stretchRafRef.current !== null) {
      cancelAnimationFrame(stretchRafRef.current);
      stretchRafRef.current = null;
    }

    for (const timer of timersRef.current.values()) {
      clearTimeout(timer);
    }
    timersRef.current.clear();
    pendingRef.current.clear();
    processedRef.current.clear();
    trafficPatternsRef.current.clear();
    particlesRef.current.length = 0;
    linksRef.current.clear();

    const selfNode = nodesRef.current.get('self');
    nodesRef.current.clear();
    if (selfNode) {
      selfNode.x = 0;
      selfNode.y = 0;
      selfNode.z = 0;
      selfNode.vx = 0;
      selfNode.vy = 0;
      selfNode.vz = 0;
      selfNode.lastActivity = Date.now();
      nodesRef.current.set('self', selfNode);
    }

    const sim = simulationRef.current;
    if (sim) {
      sim.nodes(Array.from(nodesRef.current.values()));
      const linkForce = sim.force('link') as ForceLink3D<GraphNode, GraphLink> | undefined;
      linkForce?.links([]);
      sim.alpha(0.3).restart();
    }

    setStats({ processed: 0, animated: 0, nodes: 1, links: 0 });
  }, []);

  useEffect(() => {
    const stretchRaf = stretchRafRef;
    const timers = timersRef.current;
    const pending = pendingRef.current;
    return () => {
      if (stretchRaf.current !== null) {
        cancelAnimationFrame(stretchRaf.current);
      }
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
      pending.clear();
    };
  }, []);

  useEffect(() => {
    if (!pruneStaleNodes) return;

    const staleMs = pruneStaleMinutes * 60 * 1000;
    const pruneIntervalMs = 1000;

    const interval = setInterval(() => {
      const cutoff = Date.now() - staleMs;
      let pruned = false;

      for (const [id, node] of nodesRef.current) {
        if (id === 'self') continue;
        if (node.lastActivity < cutoff) {
          nodesRef.current.delete(id);
          pruned = true;
        }
      }

      if (pruned) {
        for (const [key, link] of linksRef.current) {
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          const targetId = typeof link.target === 'string' ? link.target : link.target.id;
          if (!nodesRef.current.has(sourceId) || !nodesRef.current.has(targetId)) {
            linksRef.current.delete(key);
          }
        }
        syncSimulation();
      }
    }, pruneIntervalMs);

    return () => clearInterval(interval);
  }, [pruneStaleNodes, pruneStaleMinutes, syncSimulation]);

  return useMemo(
    () => ({
      nodes: nodesRef.current,
      links: linksRef.current,
      particles: particlesRef.current,
      stats,
      expandContract,
      clearAndReset,
    }),
    [stats, expandContract, clearAndReset]
  );
}
