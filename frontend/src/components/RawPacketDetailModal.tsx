import { useMemo, useState } from 'react';
import { ChannelCrypto, PayloadType } from '@michaelhart/meshcore-decoder';

import type { Channel, RawPacket } from '../types';
import { cn } from '@/lib/utils';
import {
  createDecoderOptions,
  inspectRawPacketWithOptions,
  type PacketByteField,
} from '../utils/rawPacketInspector';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

interface RawPacketDetailModalProps {
  packet: RawPacket | null;
  channels: Channel[];
  onClose: () => void;
}

interface FieldPaletteEntry {
  box: string;
  boxActive: string;
  hex: string;
  hexActive: string;
}

interface GroupTextResolutionCandidate {
  key: string;
  name: string;
  hash: string;
}

const FIELD_PALETTE: FieldPaletteEntry[] = [
  {
    box: 'border-sky-500/30 bg-sky-500/10',
    boxActive: 'border-sky-600 bg-sky-500/20 shadow-sm shadow-sky-500/20',
    hex: 'border-sky-500/40 bg-sky-500/20',
    hexActive: 'border-sky-600 bg-sky-500/40',
  },
  {
    box: 'border-emerald-500/30 bg-emerald-500/10',
    boxActive: 'border-emerald-600 bg-emerald-500/20 shadow-sm shadow-emerald-500/20',
    hex: 'border-emerald-500/40 bg-emerald-500/20',
    hexActive: 'border-emerald-600 bg-emerald-500/40',
  },
  {
    box: 'border-amber-500/30 bg-amber-500/10',
    boxActive: 'border-amber-600 bg-amber-500/20 shadow-sm shadow-amber-500/20',
    hex: 'border-amber-500/40 bg-amber-500/20',
    hexActive: 'border-amber-600 bg-amber-500/40',
  },
  {
    box: 'border-rose-500/30 bg-rose-500/10',
    boxActive: 'border-rose-600 bg-rose-500/20 shadow-sm shadow-rose-500/20',
    hex: 'border-rose-500/40 bg-rose-500/20',
    hexActive: 'border-rose-600 bg-rose-500/40',
  },
  {
    box: 'border-violet-500/30 bg-violet-500/10',
    boxActive: 'border-violet-600 bg-violet-500/20 shadow-sm shadow-violet-500/20',
    hex: 'border-violet-500/40 bg-violet-500/20',
    hexActive: 'border-violet-600 bg-violet-500/40',
  },
  {
    box: 'border-cyan-500/30 bg-cyan-500/10',
    boxActive: 'border-cyan-600 bg-cyan-500/20 shadow-sm shadow-cyan-500/20',
    hex: 'border-cyan-500/40 bg-cyan-500/20',
    hexActive: 'border-cyan-600 bg-cyan-500/40',
  },
  {
    box: 'border-lime-500/30 bg-lime-500/10',
    boxActive: 'border-lime-600 bg-lime-500/20 shadow-sm shadow-lime-500/20',
    hex: 'border-lime-500/40 bg-lime-500/20',
    hexActive: 'border-lime-600 bg-lime-500/40',
  },
  {
    box: 'border-fuchsia-500/30 bg-fuchsia-500/10',
    boxActive: 'border-fuchsia-600 bg-fuchsia-500/20 shadow-sm shadow-fuchsia-500/20',
    hex: 'border-fuchsia-500/40 bg-fuchsia-500/20',
    hexActive: 'border-fuchsia-600 bg-fuchsia-500/40',
  },
];

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatSignal(packet: RawPacket): string {
  const parts: string[] = [];
  if (packet.rssi !== null) {
    parts.push(`${packet.rssi} dBm RSSI`);
  }
  if (packet.snr !== null) {
    parts.push(`${packet.snr.toFixed(1)} dB SNR`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'No signal sample';
}

function formatByteRange(field: PacketByteField): string {
  if (field.absoluteStartByte === field.absoluteEndByte) {
    return `Byte ${field.absoluteStartByte}`;
  }
  return `Bytes ${field.absoluteStartByte}-${field.absoluteEndByte}`;
}

function formatPathMode(hashSize: number | undefined, hopCount: number): string {
  if (hopCount === 0) {
    return 'No path hops';
  }
  if (!hashSize) {
    return `${hopCount} hop${hopCount === 1 ? '' : 's'}`;
  }
  return `${hopCount} hop${hopCount === 1 ? '' : 's'} · ${hashSize} byte hash${hashSize === 1 ? '' : 'es'}`;
}

function buildGroupTextResolutionCandidates(channels: Channel[]): GroupTextResolutionCandidate[] {
  return channels.map((channel) => ({
    key: channel.key,
    name: channel.name,
    hash: ChannelCrypto.calculateChannelHash(channel.key).toUpperCase(),
  }));
}

function resolveGroupTextRoomName(
  payload: {
    channelHash?: string;
    cipherMac?: string;
    ciphertext?: string;
    decrypted?: { message?: string };
  },
  candidates: GroupTextResolutionCandidate[]
): string | null {
  if (!payload.channelHash) {
    return null;
  }

  const hashMatches = candidates.filter(
    (candidate) => candidate.hash === payload.channelHash?.toUpperCase()
  );
  if (hashMatches.length === 1) {
    return hashMatches[0].name;
  }
  if (
    hashMatches.length <= 1 ||
    !payload.cipherMac ||
    !payload.ciphertext ||
    !payload.decrypted?.message
  ) {
    return null;
  }

  const decryptMatches = hashMatches.filter(
    (candidate) =>
      ChannelCrypto.decryptGroupTextMessage(payload.ciphertext!, payload.cipherMac!, candidate.key)
        .success
  );
  return decryptMatches.length === 1 ? decryptMatches[0].name : null;
}

function packetShowsDecryptedState(
  packet: RawPacket,
  inspection: ReturnType<typeof inspectRawPacketWithOptions>
): boolean {
  const payload = inspection.decoded?.payload.decoded as { decrypted?: unknown } | null | undefined;
  return packet.decrypted || Boolean(packet.decrypted_info) || Boolean(payload?.decrypted);
}

function getPacketContext(
  packet: RawPacket,
  inspection: ReturnType<typeof inspectRawPacketWithOptions>,
  groupTextCandidates: GroupTextResolutionCandidate[]
) {
  const fallbackSender = packet.decrypted_info?.sender ?? null;
  const fallbackRoom = packet.decrypted_info?.channel_name ?? null;

  if (!inspection.decoded?.payload.decoded) {
    if (!fallbackSender && !fallbackRoom) {
      return null;
    }
    return {
      title: fallbackRoom ? 'Room' : 'Context',
      primary: fallbackRoom ?? 'Sender metadata available',
      secondary: fallbackSender ? `Sender: ${fallbackSender}` : null,
    };
  }

  if (inspection.decoded.payloadType === PayloadType.GroupText) {
    const payload = inspection.decoded.payload.decoded as {
      channelHash?: string;
      cipherMac?: string;
      ciphertext?: string;
      decrypted?: { sender?: string; message?: string };
    };
    const roomName = fallbackRoom ?? resolveGroupTextRoomName(payload, groupTextCandidates);
    return {
      title: roomName ? 'Room' : 'Channel',
      primary:
        roomName ?? (payload.channelHash ? `Channel hash ${payload.channelHash}` : 'GroupText'),
      secondary: payload.decrypted?.sender
        ? `Sender: ${payload.decrypted.sender}`
        : fallbackSender
          ? `Sender: ${fallbackSender}`
          : null,
    };
  }

  if (fallbackSender) {
    return {
      title: 'Context',
      primary: fallbackSender,
      secondary: null,
    };
  }

  return null;
}

function buildDisplayFields(inspection: ReturnType<typeof inspectRawPacketWithOptions>) {
  return [
    ...inspection.packetFields.filter((field) => field.name !== 'Payload'),
    ...inspection.payloadFields,
  ];
}

function buildFieldColorMap(fields: PacketByteField[]) {
  return new Map(
    fields.map((field, index) => [field.id, FIELD_PALETTE[index % FIELD_PALETTE.length]])
  );
}

function buildByteOwners(totalBytes: number, fields: PacketByteField[]) {
  const owners = new Array<string | null>(totalBytes).fill(null);
  for (const field of fields) {
    for (let index = field.absoluteStartByte; index <= field.absoluteEndByte; index += 1) {
      if (index >= 0 && index < owners.length) {
        owners[index] = field.id;
      }
    }
  }
  return owners;
}

function CompactMetaCard({
  label,
  primary,
  secondary,
}: {
  label: string;
  primary: string;
  secondary?: string | null;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-card/70 p-2.5">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium leading-tight text-foreground">{primary}</div>
      {secondary ? (
        <div className="mt-1 text-xs leading-tight text-muted-foreground">{secondary}</div>
      ) : null}
    </div>
  );
}

function FullPacketHex({
  packetHex,
  fields,
  colorMap,
  hoveredFieldId,
  onHoverField,
}: {
  packetHex: string;
  fields: PacketByteField[];
  colorMap: Map<string, FieldPaletteEntry>;
  hoveredFieldId: string | null;
  onHoverField: (fieldId: string | null) => void;
}) {
  const normalized = packetHex.toUpperCase();
  const bytes = normalized.match(/.{1,2}/g) ?? [];
  const byteOwners = useMemo(() => buildByteOwners(bytes.length, fields), [bytes.length, fields]);

  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-1.5 sm:p-2">
      <div className="flex flex-wrap gap-1 font-mono text-[15px]">
        {bytes.map((byte, byteIndex) => {
          const fieldId = byteOwners[byteIndex];
          const palette = fieldId ? colorMap.get(fieldId) : null;
          const active = fieldId !== null && hoveredFieldId === fieldId;
          return (
            <span
              key={byteIndex}
              onMouseEnter={() => onHoverField(fieldId)}
              onMouseLeave={() => onHoverField(null)}
              className={cn(
                'rounded border px-1.5 py-1 leading-none transition-colors',
                palette
                  ? active
                    ? palette.hexActive
                    : palette.hex
                  : 'border-border/70 bg-background/70 text-foreground'
              )}
            >
              {byte}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function FieldBox({
  field,
  palette,
  active,
  onHoverField,
}: {
  field: PacketByteField;
  palette: FieldPaletteEntry;
  active: boolean;
  onHoverField: (fieldId: string | null) => void;
}) {
  return (
    <div
      onMouseEnter={() => onHoverField(field.id)}
      onMouseLeave={() => onHoverField(null)}
      className={cn(
        'rounded-lg border p-2.5 transition-colors',
        active ? palette.boxActive : palette.box
      )}
    >
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between">
        <div className="min-w-0">
          <div className="text-base font-semibold leading-tight text-foreground">{field.name}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{formatByteRange(field)}</div>
        </div>
        <div className="w-full break-all font-mono text-sm leading-5 text-foreground sm:max-w-[14rem] sm:text-right">
          {field.value.toUpperCase()}
        </div>
      </div>

      <div className="mt-2 whitespace-pre-wrap text-sm leading-5 text-foreground">
        {field.description}
      </div>

      {field.decryptedMessage ? (
        <div className="mt-2 rounded border border-border/50 bg-background/40 p-2">
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {field.name === 'Ciphertext' ? 'Plaintext' : 'Decoded value'}
          </div>
          <PlaintextContent text={field.decryptedMessage} />
        </div>
      ) : null}

      {field.headerBreakdown ? (
        <div className="mt-2 space-y-1.5">
          <div className="font-mono text-xs tracking-[0.16em] text-muted-foreground">
            {field.headerBreakdown.fullBinary}
          </div>
          {field.headerBreakdown.fields.map((part) => (
            <div
              key={`${field.id}-${part.bits}-${part.field}`}
              className="rounded border border-border/50 bg-background/40 p-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium leading-tight text-foreground">
                    {part.field}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">Bits {part.bits}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm text-foreground">{part.binary}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{part.value}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PlaintextContent({ text }: { text: string }) {
  const lines = text.split('\n');

  return (
    <div className="mt-1 space-y-1 text-sm leading-5 text-foreground">
      {lines.map((line, index) => {
        const separatorIndex = line.indexOf(': ');
        if (separatorIndex === -1) {
          return (
            <div key={`${line}-${index}`} className="font-mono">
              {line}
            </div>
          );
        }

        const label = line.slice(0, separatorIndex + 1);
        const value = line.slice(separatorIndex + 2);

        return (
          <div key={`${line}-${index}`}>
            <span>{label} </span>
            <span className="font-mono">{value}</span>
          </div>
        );
      })}
    </div>
  );
}

function FieldSection({
  title,
  fields,
  colorMap,
  hoveredFieldId,
  onHoverField,
}: {
  title: string;
  fields: PacketByteField[];
  colorMap: Map<string, FieldPaletteEntry>;
  hoveredFieldId: string | null;
  onHoverField: (fieldId: string | null) => void;
}) {
  return (
    <section className="rounded-lg border border-border/70 bg-card/70 p-3">
      <div className="mb-2 text-sm font-semibold text-foreground">{title}</div>
      {fields.length === 0 ? (
        <div className="text-sm text-muted-foreground">No decoded fields available.</div>
      ) : (
        <div className="grid gap-2">
          {fields.map((field) => (
            <FieldBox
              key={field.id}
              field={field}
              palette={colorMap.get(field.id) ?? FIELD_PALETTE[0]}
              active={hoveredFieldId === field.id}
              onHoverField={onHoverField}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function RawPacketDetailModal({ packet, channels, onClose }: RawPacketDetailModalProps) {
  const decoderOptions = useMemo(() => createDecoderOptions(channels), [channels]);
  const groupTextCandidates = useMemo(
    () => buildGroupTextResolutionCandidates(channels),
    [channels]
  );
  const inspection = useMemo(
    () => (packet ? inspectRawPacketWithOptions(packet, decoderOptions) : null),
    [decoderOptions, packet]
  );
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);

  const packetDisplayFields = useMemo(
    () => (inspection ? inspection.packetFields.filter((field) => field.name !== 'Payload') : []),
    [inspection]
  );
  const fullPacketFields = useMemo(
    () => (inspection ? buildDisplayFields(inspection) : []),
    [inspection]
  );
  const colorMap = useMemo(() => buildFieldColorMap(fullPacketFields), [fullPacketFields]);
  const packetContext = useMemo(
    () => (packet && inspection ? getPacketContext(packet, inspection, groupTextCandidates) : null),
    [groupTextCandidates, inspection, packet]
  );
  const packetIsDecrypted = useMemo(
    () => (packet && inspection ? packetShowsDecryptedState(packet, inspection) : false),
    [inspection, packet]
  );

  if (!packet || !inspection) {
    return null;
  }

  return (
    <Dialog open={packet !== null} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="flex h-[92vh] max-w-[min(96vw,82rem)] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-3">
          <DialogTitle>Packet Details</DialogTitle>
          <DialogDescription className="sr-only">
            Detailed byte and field breakdown for the selected raw packet.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
            <section className="rounded-lg border border-border/70 bg-card/70 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Summary
                  </div>
                  <div className="mt-1 text-base font-semibold leading-tight text-foreground">
                    {inspection.summary.summary}
                  </div>
                </div>
                <div className="shrink-0 text-xs text-muted-foreground">
                  {formatTimestamp(packet.timestamp)}
                </div>
              </div>
              {packetContext ? (
                <div className="mt-2 rounded-md border border-border/60 bg-background/35 px-2.5 py-2">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {packetContext.title}
                  </div>
                  <div className="mt-1 text-sm font-medium leading-tight text-foreground">
                    {packetContext.primary}
                  </div>
                  {packetContext.secondary ? (
                    <div className="mt-1 text-xs leading-tight text-muted-foreground">
                      {packetContext.secondary}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <CompactMetaCard
                label="Packet"
                primary={`${packet.data.length / 2} bytes · ${packetIsDecrypted ? 'Decrypted' : 'Encrypted'}`}
                secondary={`Storage #${packet.id}${packet.observation_id !== undefined ? ` · Observation #${packet.observation_id}` : ''}`}
              />
              <CompactMetaCard
                label="Transport"
                primary={`${inspection.routeTypeName} · ${inspection.payloadTypeName}`}
                secondary={`${inspection.payloadVersionName} · ${formatPathMode(inspection.decoded?.pathHashSize, inspection.pathTokens.length)}`}
              />
              <CompactMetaCard
                label="Signal"
                primary={formatSignal(packet)}
                secondary={packetContext ? null : undefined}
              />
            </section>
          </div>

          {inspection.validationErrors.length > 0 ? (
            <div className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-2.5">
              <div className="text-sm font-semibold text-foreground">Validation notes</div>
              <div className="mt-1.5 space-y-1 text-sm text-foreground">
                {inspection.validationErrors.map((error) => (
                  <div key={error}>{error}</div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-3 rounded-lg border border-border/70 bg-card/70 p-3">
            <div className="text-xl font-semibold text-foreground">Full packet hex</div>
            <div className="mt-2.5">
              <FullPacketHex
                packetHex={packet.data}
                fields={fullPacketFields}
                colorMap={colorMap}
                hoveredFieldId={hoveredFieldId}
                onHoverField={setHoveredFieldId}
              />
            </div>
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <FieldSection
              title="Packet fields"
              fields={packetDisplayFields}
              colorMap={colorMap}
              hoveredFieldId={hoveredFieldId}
              onHoverField={setHoveredFieldId}
            />

            <FieldSection
              title="Payload fields"
              fields={inspection.payloadFields}
              colorMap={colorMap}
              hoveredFieldId={hoveredFieldId}
              onHoverField={setHoveredFieldId}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
