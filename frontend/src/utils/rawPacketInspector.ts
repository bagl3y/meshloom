import {
  MeshCoreDecoder,
  PayloadType,
  Utils,
  type DecodedPacket,
  type DecryptionOptions,
  type HeaderBreakdown,
  type PacketStructure,
} from '@michaelhart/meshcore-decoder';

import i18n from '../i18n';
import type { Channel, RawPacket } from '../types';

export interface RawPacketSummary {
  summary: string;
  routeType: string;
  details?: string;
}

export interface PacketByteField {
  id: string;
  scope: 'packet' | 'payload';
  name: string;
  description: string;
  value: string;
  decryptedMessage?: string;
  startByte: number;
  endByte: number;
  absoluteStartByte: number;
  absoluteEndByte: number;
  headerBreakdown?: HeaderBreakdown;
}

export interface RawPacketInspection {
  decoded: DecodedPacket | null;
  structure: PacketStructure | null;
  routeTypeName: string;
  payloadTypeName: string;
  payloadVersionName: string;
  pathTokens: string[];
  summary: RawPacketSummary;
  validationErrors: string[];
  packetFields: PacketByteField[];
  payloadFields: PacketByteField[];
}

export function formatHexByHop(hex: string, hashSize: number | null | undefined): string {
  const normalized = hex.trim().toUpperCase();
  if (!normalized || !hashSize || hashSize < 1) {
    return normalized;
  }

  const charsPerHop = hashSize * 2;
  if (normalized.length <= charsPerHop || normalized.length % charsPerHop !== 0) {
    return normalized;
  }

  const hops = normalized.match(new RegExp(`.{1,${charsPerHop}}`, 'g'));
  return hops && hops.length > 1 ? hops.join(' → ') : normalized;
}

export function describeCiphertextStructure(
  payloadType: PayloadType,
  byteLength: number,
  fallbackDescription: string
): string {
  switch (payloadType) {
    case PayloadType.GroupText:
      return i18n.t('rawPacket.ciphertextGroup', { bytes: byteLength });
    case PayloadType.TextMessage:
      return i18n.t('rawPacket.ciphertextDm', { bytes: byteLength });
    case PayloadType.Response:
      return i18n.t('rawPacket.ciphertextResponse', { bytes: byteLength });
    default:
      return fallbackDescription;
  }
}

function getPathTokens(decoded: DecodedPacket): string[] {
  const tracePayload =
    decoded.payloadType === PayloadType.Trace && decoded.payload.decoded
      ? (decoded.payload.decoded as { pathHashes?: string[] })
      : null;
  return tracePayload?.pathHashes || decoded.path || [];
}

function formatUnixTimestamp(timestamp: number): string {
  return `${timestamp} (${new Date(timestamp * 1000).toLocaleString()})`;
}

function createPacketField(
  scope: 'packet' | 'payload',
  id: string,
  field: {
    name: string;
    description: string;
    value: string;
    decryptedMessage?: string;
    startByte: number;
    endByte: number;
    headerBreakdown?: HeaderBreakdown;
  },
  absoluteOffset: number
): PacketByteField {
  return {
    id,
    scope,
    name: field.name,
    description: field.description,
    value: field.value,
    decryptedMessage: field.decryptedMessage,
    startByte: field.startByte,
    endByte: field.endByte,
    absoluteStartByte: absoluteOffset + field.startByte,
    absoluteEndByte: absoluteOffset + field.endByte,
    headerBreakdown: field.headerBreakdown,
  };
}

export function createDecoderOptions(
  channels: Channel[] | null | undefined
): DecryptionOptions | undefined {
  const channelSecrets =
    channels
      ?.map((channel) => channel.key?.trim())
      .filter((key): key is string => Boolean(key && key.length > 0)) ?? [];

  if (channelSecrets.length === 0) {
    return undefined;
  }

  return {
    keyStore: MeshCoreDecoder.createKeyStore({ channelSecrets }),
    attemptDecryption: true,
  };
}

function safeValidate(hexData: string): string[] {
  try {
    const validation = MeshCoreDecoder.validate(hexData);
    return validation.errors ?? [];
  } catch (error) {
    return [error instanceof Error ? error.message : 'Packet validation failed'];
  }
}

export function decodePacketSummary(
  packet: RawPacket,
  decoderOptions?: DecryptionOptions
): RawPacketSummary {
  try {
    const decoded = MeshCoreDecoder.decode(packet.data, decoderOptions);

    if (!decoded.isValid) {
      return { summary: i18n.t('rawPacket.invalidPacket'), routeType: 'Unknown' };
    }

    const routeType = Utils.getRouteTypeName(decoded.routeType);
    const payloadTypeName = Utils.getPayloadTypeName(decoded.payloadType);
    const pathTokens = getPathTokens(decoded);
    const pathStr =
      pathTokens.length > 0 ? i18n.t('rawPacket.viaPath', { path: pathTokens.join(', ') }) : '';

    let summary = payloadTypeName;
    let details: string | undefined;

    switch (decoded.payloadType) {
      case PayloadType.TextMessage: {
        const payload = decoded.payload.decoded as {
          destinationHash?: string;
          sourceHash?: string;
        } | null;
        if (payload?.sourceHash && payload?.destinationHash) {
          summary = i18n.t('rawPacket.dmFromTo', {
            source: payload.sourceHash,
            dest: payload.destinationHash,
            path: pathStr,
          });
        } else {
          summary = i18n.t('rawPacket.dmOnly', { path: pathStr });
        }
        break;
      }
      case PayloadType.GroupText: {
        const payload = decoded.payload.decoded as {
          channelHash?: string;
          decrypted?: { sender?: string; message?: string };
        } | null;
        if (packet.decrypted_info?.channel_name) {
          if (packet.decrypted_info.sender) {
            summary = i18n.t('rawPacket.gtFromIn', {
              sender: packet.decrypted_info.sender,
              channel: packet.decrypted_info.channel_name,
              path: pathStr,
            });
          } else {
            summary = i18n.t('rawPacket.gtIn', {
              channel: packet.decrypted_info.channel_name,
              path: pathStr,
            });
          }
        } else if (payload?.decrypted?.sender) {
          summary = i18n.t('rawPacket.gtFrom', {
            sender: payload.decrypted.sender,
            path: pathStr,
          });
        } else if (payload?.decrypted?.message) {
          summary = i18n.t('rawPacket.gtDecrypted', { path: pathStr });
        } else if (payload?.channelHash) {
          summary = i18n.t('rawPacket.gtCh', { hash: payload.channelHash, path: pathStr });
        } else {
          summary = i18n.t('rawPacket.groupTextPath', { path: pathStr });
        }
        break;
      }
      case PayloadType.Advert: {
        const payload = decoded.payload.decoded as {
          publicKey?: string;
          appData?: { name?: string; deviceRole?: number };
        } | null;
        if (payload?.appData?.name) {
          const role =
            payload.appData.deviceRole !== undefined
              ? Utils.getDeviceRoleName(payload.appData.deviceRole)
              : '';
          summary = i18n.t('rawPacket.advertNamed', {
            name: payload.appData.name,
            role: role ? ` (${role})` : '',
            path: pathStr,
          });
        } else if (payload?.publicKey) {
          summary = i18n.t('rawPacket.advertKey', {
            key: payload.publicKey.slice(0, 8),
            path: pathStr,
          });
        } else {
          summary = i18n.t('rawPacket.advertOnly', { path: pathStr });
        }
        break;
      }
      case PayloadType.Ack:
        summary = i18n.t('rawPacket.ackPath', { path: pathStr });
        break;
      case PayloadType.Request:
        summary = i18n.t('rawPacket.requestPath', { path: pathStr });
        break;
      case PayloadType.Response:
        summary = i18n.t('rawPacket.responsePath', { path: pathStr });
        break;
      case PayloadType.Trace:
        summary = i18n.t('rawPacket.tracePath', { path: pathStr });
        break;
      case PayloadType.Path:
        summary = i18n.t('rawPacket.pathOnly', { path: pathStr });
        break;
      default:
        summary = i18n.t('rawPacket.typePath', { type: payloadTypeName, path: pathStr });
        break;
    }

    return { summary, routeType, details };
  } catch {
    return { summary: i18n.t('rawPacket.decodeError'), routeType: 'Unknown' };
  }
}

export function inspectRawPacket(packet: RawPacket): RawPacketInspection {
  return inspectRawPacketWithOptions(packet);
}

export function inspectRawPacketWithOptions(
  packet: RawPacket,
  decoderOptions?: DecryptionOptions
): RawPacketInspection {
  const summary = decodePacketSummary(packet, decoderOptions);
  const validationErrors = safeValidate(packet.data);

  let decoded: DecodedPacket | null = null;
  let structure: PacketStructure | null = null;

  try {
    decoded = MeshCoreDecoder.decode(packet.data, decoderOptions);
  } catch {
    decoded = null;
  }

  try {
    structure = MeshCoreDecoder.analyzeStructure(packet.data, decoderOptions);
  } catch {
    structure = null;
  }

  const routeTypeName = decoded?.isValid
    ? Utils.getRouteTypeName(decoded.routeType)
    : summary.routeType;
  const payloadTypeName = decoded?.isValid
    ? Utils.getPayloadTypeName(decoded.payloadType)
    : packet.payload_type;
  const payloadVersionName = decoded?.isValid
    ? Utils.getPayloadVersionName(decoded.payloadVersion)
    : 'Unknown';
  const pathTokens = decoded?.isValid ? getPathTokens(decoded) : [];

  const packetFields =
    structure?.segments
      .map((segment, index) => createPacketField('packet', `packet-${index}`, segment, 0))
      .map((field) => {
        if (field.name !== 'Path Data') {
          return field;
        }
        const hashSize =
          decoded?.pathHashSize ??
          (decoded?.pathLength && decoded.pathLength > 0
            ? Math.max(1, field.value.length / 2 / decoded.pathLength)
            : null);
        return {
          ...field,
          value: formatHexByHop(field.value, hashSize),
        };
      }) ?? [];

  const payloadFields =
    structure == null
      ? []
      : (structure.payload.segments.length > 0
          ? structure.payload.segments
          : structure.payload.hex.length > 0
            ? [
                {
                  name: 'Payload Bytes',
                  description:
                    'Field-level payload breakdown is not available for this packet type.',
                  startByte: 0,
                  endByte: Math.max(0, structure.payload.hex.length / 2 - 1),
                  value: structure.payload.hex,
                },
              ]
            : []
        ).map((segment, index) =>
          createPacketField('payload', `payload-${index}`, segment, structure.payload.startByte)
        );

  const enrichedPayloadFields = payloadFields.map((field) => {
    if (!decoded?.isValid || field.name !== 'Ciphertext') {
      return field;
    }

    const withStructure = {
      ...field,
      description: describeCiphertextStructure(
        decoded.payloadType,
        field.endByte - field.startByte + 1,
        field.description
      ),
    };

    // GroupText: client-side decoder has the decrypted content
    if (decoded.payloadType === PayloadType.GroupText && decoded.payload.decoded) {
      const payload = decoded.payload.decoded as {
        decrypted?: { timestamp?: number; flags?: number; sender?: string; message?: string };
      };
      if (!payload.decrypted?.message) {
        return withStructure;
      }
      const detailLines = [
        payload.decrypted.timestamp != null
          ? i18n.t('rawPacket.sentPacket', {
              time: formatUnixTimestamp(payload.decrypted.timestamp),
            })
          : null,
        payload.decrypted.flags != null
          ? i18n.t('rawPacket.flags', {
              value: `0x${payload.decrypted.flags.toString(16).padStart(2, '0')}`,
            })
          : null,
        payload.decrypted.sender
          ? i18n.t('rawPacket.sender', { name: payload.decrypted.sender })
          : null,
        i18n.t('rawPacket.messageLabel', { text: payload.decrypted.message }),
      ].filter((line): line is string => line !== null);
      return { ...withStructure, decryptedMessage: detailLines.join('\n') };
    }

    // TextMessage (DM): server-side decryption via decrypted_info
    if (decoded.payloadType === PayloadType.TextMessage && packet.decrypted_info?.message) {
      const info = packet.decrypted_info;
      const detailLines = [
        info.sender_timestamp != null
          ? i18n.t('rawPacket.sentPacket', {
              time: formatUnixTimestamp(info.sender_timestamp),
            })
          : null,
        info.sender ? i18n.t('rawPacket.sender', { name: info.sender }) : null,
        i18n.t('rawPacket.messageLabel', { text: info.message }),
      ].filter((line): line is string => line !== null);
      return { ...withStructure, decryptedMessage: detailLines.join('\n') };
    }

    return withStructure;
  });

  return {
    decoded,
    structure,
    routeTypeName,
    payloadTypeName,
    payloadVersionName,
    pathTokens,
    summary,
    validationErrors:
      validationErrors.length > 0
        ? validationErrors
        : (decoded?.errors ?? (decoded || structure ? [] : [i18n.t('rawPacket.unableToDecode')])),
    packetFields,
    payloadFields: enrichedPayloadFields,
  };
}
