---
title: First launch
description: Open the interface, check the radio, name the node, and look around.
level: start
order: 3
---

The server is running and the radio is connected. Now open the page and see what is there.

```
http://127.0.0.1:8000
```

From another device on the same network, use the machine’s IP address with port `8000`.

## Check the radio link

At the top of the screen, a status bar shows what the radio is doing. It moves through **Radio connecting**, **Radio initializing**, and finally **Radio OK** when the link is established and synchronization is complete. The first connection takes a moment: the server reads the device configuration, retrieves its contacts and channels, and sets its clock.

If the bar says **Radio disconnected**, a **Reconnect** button appears beside it. A server that cannot find the radio retries by itself every few seconds, so reconnecting a cable or powering up the radio is usually enough. If the state does not change, the transport selected during installation is the first suspect: wrong serial port, wrong IP address, or rejected Bluetooth PIN. See [Radio transports](/en/docs/deep/transports/) and [Troubleshooting](/en/docs/deep/troubleshooting/).

The status bar also shows the node name, its public key — click it to copy — and the battery level when the radio provides it.

## Name the node

A node without a name appears to other people under the first characters of its public key. Give it a name.

Open **Settings**, then **Radio**, the **Identity** group, and the **Radio name** field. This name goes out in every advert and is what other people see in their contact list. Short is better: radio packets have limited space.

The same section contains radio settings: presets, frequency, bandwidth, and the rest. They must match nearby nodes or nobody will hear anybody else. If the node stays silent while other devices nearby are active, this is the first place to look. It is worth knowing the local settings before changing them.

## Announce yourself

Farther down in the same section is **Adverts and discovery**. An advert is the small packet a node sends to say that it exists, with its name and public key.

- **Send advert** sends one immediately. The *flood* version travels through repeaters and goes farther. The *zero-hop* version stays local and uses much less airtime.
- **Periodic advert interval** controls automatic repeats. `0` disables them. The minimum is one hour, and twenty-four hours or more is recommended: adverts sent too often occupy airtime for everyone.

The reverse works too. Contacts do not have to be entered by hand: every advert heard creates or updates a contact automatically. An empty list at startup is not a problem; it just means the network has not been heard yet.

## Look around

The left column groups conversations into sections: **Favorites**, **Channels**, **Contacts**, **Repeaters**, and **Room servers**. A **Public** channel exists from the start; it is MeshCore’s default channel, open to everyone.

Below the conversations is a **Tools** section:

- **Raw packet feed** — everything the radio hears, whether it can be decrypted or not.
- **Node map** — nodes whose adverts included coordinates.
- **Mesh visualizer** — the paths packets actually took.
- **Route trace** — a route test to one node.
- **Message search** — full-text search across the history.

The **Add channel/contact** button opens conversation creation: a contact by public key, a channel by key, or a hashtag channel by name.

To send something: [Messages](/en/docs/messages/).
