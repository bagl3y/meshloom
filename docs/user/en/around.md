---
title: Around the messages
description: The map, the visualizer, the packet feed — what you watch without sending anything.
level: start
order: 5
---

A radio hears much more than what is addressed to you. Adverts, echoes, messages from other channels, unreadable packets: everything within range passes through the antenna. Meshloom keeps this material and gives you a few ways to inspect it.

None of this is needed to send a message. It is observation. You can skip it entirely.

The entries are in the **Tools** section of the left column.

## The node map

An advert can include coordinates. When it does, Meshloom places the node on a map. One heard advert, one more point.

Two limits matter. Not every node broadcasts its position: nodes that keep it private do not appear on the map, even if they are active. And a position is from the last advert received, not live tracking — a mobile node appears where it was the last time it spoke.

The map is mainly for understanding the local network’s geography: where the repeaters are, which direction messages travel, and which hill explains why a nearby node cannot be heard.

## The mesh visualizer

The map shows where nodes are. The visualizer shows how packets get there.

Every received packet carries the trace of the hops it crossed. By combining those traces, Meshloom draws the network as it actually works, rather than as a map might suggest. The most-used links stand out quickly.

The benefit is practical: you can work out which repeater carries your traffic. That helps when the repeater goes down and you need to understand why nothing is getting out.

Identities are not always certain. A hop is identified only by part of a key, and two nodes can share that same fragment. The visualizer then shows a hypothesis, not a fact.

## The raw packet feed

The feed shows everything the radio hears as it arrives, without filtering: messages for your channels, messages from channels whose keys you do not have, adverts, receipts, and packets damaged in transit.

It is an observation tool, not a reliable source of information. Think of it as an aquarium: interesting to watch, useful for copying one packet or checking that the radio hears something, and harmless to ignore.

The feed follows the newest packet continuously. A checkbox pauses it so you can inspect an older packet. Click a packet to open its details. A statistics panel summarizes what the session has heard: volumes, packet types, and the busiest nodes.

Packets that could not be decrypted are not necessarily lost. They are what makes later historical decryption possible when a channel key becomes available.

## The rest

- **Route trace** sends a test packet through known repeaters and back to your radio. It measures a route instead of inferring one.
- **Message search** searches the entire stored history, across direct messages and channels. Clicking a result opens the conversation at that exact point, with surrounding context.
- **Statistics**, in Settings, aggregate what the node has seen: volumes, activity by period, and the busiest channels.

## It takes space

Keeping raw packets has a cost. They accumulate and the database grows. The **Database** section of Settings shows its size and can purge old packets.

Purging closes the door on historical decryption for the deleted period: messages already decrypted remain, but unreadable packets disappear permanently. On a machine without tight disk limits, leaving it for a few weeks is usually fine.

Before leaving it running, read [A trusted network](/en/docs/trust/).
