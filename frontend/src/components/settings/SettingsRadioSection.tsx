import { useState, useEffect, useMemo } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { toast } from '../ui/sonner';
import { RADIO_PRESETS } from '../../utils/radioPresets';
import type {
  AppSettings,
  AppSettingsUpdate,
  HealthStatus,
  RadioConfig,
  RadioConfigUpdate,
} from '../../types';

export function SettingsRadioSection({
  config,
  health,
  appSettings,
  pageMode,
  onSave,
  onSaveAppSettings,
  onSetPrivateKey,
  onReboot,
  onAdvertise,
  onClose,
  className,
}: {
  config: RadioConfig;
  health: HealthStatus | null;
  appSettings: AppSettings;
  pageMode: boolean;
  onSave: (update: RadioConfigUpdate) => Promise<void>;
  onSaveAppSettings: (update: AppSettingsUpdate) => Promise<void>;
  onSetPrivateKey: (key: string) => Promise<void>;
  onReboot: () => Promise<void>;
  onAdvertise: () => Promise<void>;
  onClose: () => void;
  className?: string;
}) {
  // Radio config state
  const [name, setName] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [txPower, setTxPower] = useState('');
  const [freq, setFreq] = useState('');
  const [bw, setBw] = useState('');
  const [sf, setSf] = useState('');
  const [cr, setCr] = useState('');
  const [pathHashMode, setPathHashMode] = useState('0');
  const [gettingLocation, setGettingLocation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rebooting, setRebooting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Identity state
  const [privateKey, setPrivateKey] = useState('');
  const [identityBusy, setIdentityBusy] = useState(false);
  const [identityRebooting, setIdentityRebooting] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);

  // Flood & advert control state
  const [advertIntervalHours, setAdvertIntervalHours] = useState('0');
  const [floodScope, setFloodScope] = useState('');
  const [maxRadioContacts, setMaxRadioContacts] = useState('');
  const [floodBusy, setFloodBusy] = useState(false);
  const [floodError, setFloodError] = useState<string | null>(null);

  // Advertise state
  const [advertising, setAdvertising] = useState(false);

  useEffect(() => {
    setName(config.name);
    setLat(String(config.lat));
    setLon(String(config.lon));
    setTxPower(String(config.tx_power));
    setFreq(String(config.radio.freq));
    setBw(String(config.radio.bw));
    setSf(String(config.radio.sf));
    setCr(String(config.radio.cr));
    setPathHashMode(String(config.path_hash_mode));
  }, [config]);

  useEffect(() => {
    setAdvertIntervalHours(String(Math.round(appSettings.advert_interval / 3600)));
    setFloodScope(appSettings.flood_scope);
    setMaxRadioContacts(String(appSettings.max_radio_contacts));
  }, [appSettings]);

  const currentPreset = useMemo(() => {
    const freqNum = parseFloat(freq);
    const bwNum = parseFloat(bw);
    const sfNum = parseInt(sf, 10);
    const crNum = parseInt(cr, 10);

    for (const preset of RADIO_PRESETS) {
      if (
        preset.freq === freqNum &&
        preset.bw === bwNum &&
        preset.sf === sfNum &&
        preset.cr === crNum
      ) {
        return preset.name;
      }
    }
    return 'custom';
  }, [freq, bw, sf, cr]);

  const handlePresetChange = (presetName: string) => {
    if (presetName === 'custom') return;
    const preset = RADIO_PRESETS.find((p) => p.name === presetName);
    if (preset) {
      setFreq(String(preset.freq));
      setBw(String(preset.bw));
      setSf(String(preset.sf));
      setCr(String(preset.cr));
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported', {
        description: 'Your browser does not support geolocation',
      });
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toFixed(6));
        setLon(position.coords.longitude.toFixed(6));
        setGettingLocation(false);
        toast.success('Location updated');
      },
      (err) => {
        setGettingLocation(false);
        toast.error('Failed to get location', {
          description: err.message,
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const buildUpdate = (): RadioConfigUpdate | null => {
    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);
    const parsedTxPower = parseInt(txPower, 10);
    const parsedFreq = parseFloat(freq);
    const parsedBw = parseFloat(bw);
    const parsedSf = parseInt(sf, 10);
    const parsedCr = parseInt(cr, 10);

    if (
      [parsedLat, parsedLon, parsedTxPower, parsedFreq, parsedBw, parsedSf, parsedCr].some((v) =>
        isNaN(v)
      )
    ) {
      setError('All numeric fields must have valid values');
      return null;
    }

    const parsedPathHashMode = parseInt(pathHashMode, 10);

    return {
      name,
      lat: parsedLat,
      lon: parsedLon,
      tx_power: parsedTxPower,
      radio: {
        freq: parsedFreq,
        bw: parsedBw,
        sf: parsedSf,
        cr: parsedCr,
      },
      ...(config.path_hash_mode_supported &&
      !isNaN(parsedPathHashMode) &&
      parsedPathHashMode !== config.path_hash_mode
        ? { path_hash_mode: parsedPathHashMode }
        : {}),
    };
  };

  const handleSave = async () => {
    setError(null);
    const update = buildUpdate();
    if (!update) return;

    setBusy(true);
    try {
      await onSave(update);
      toast.success('Radio config saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveAndReboot = async () => {
    setError(null);
    const update = buildUpdate();
    if (!update) return;

    setBusy(true);
    try {
      await onSave(update);
      toast.success('Radio config saved, rebooting...');
      setRebooting(true);
      await onReboot();
      if (!pageMode) {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setRebooting(false);
      setBusy(false);
    }
  };

  const handleSetPrivateKey = async () => {
    if (!privateKey.trim()) {
      setIdentityError('Private key is required');
      return;
    }
    setIdentityError(null);
    setIdentityBusy(true);

    try {
      await onSetPrivateKey(privateKey.trim());
      setPrivateKey('');
      toast.success('Private key set, rebooting...');
      setIdentityRebooting(true);
      await onReboot();
      if (!pageMode) {
        onClose();
      }
    } catch (err) {
      setIdentityError(err instanceof Error ? err.message : 'Failed to set private key');
    } finally {
      setIdentityRebooting(false);
      setIdentityBusy(false);
    }
  };

  const handleSaveFloodSettings = async () => {
    setFloodError(null);
    setFloodBusy(true);

    try {
      const update: AppSettingsUpdate = {};
      const hours = parseInt(advertIntervalHours, 10);
      const newAdvertInterval = isNaN(hours) ? 0 : hours * 3600;
      if (newAdvertInterval !== appSettings.advert_interval) {
        update.advert_interval = newAdvertInterval;
      }
      if (floodScope !== appSettings.flood_scope) {
        update.flood_scope = floodScope;
      }
      const newMaxRadioContacts = parseInt(maxRadioContacts, 10);
      if (!isNaN(newMaxRadioContacts) && newMaxRadioContacts !== appSettings.max_radio_contacts) {
        update.max_radio_contacts = newMaxRadioContacts;
      }
      if (Object.keys(update).length > 0) {
        await onSaveAppSettings(update);
      }
      toast.success('Settings saved');
    } catch (err) {
      setFloodError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setFloodBusy(false);
    }
  };

  const handleAdvertise = async () => {
    setAdvertising(true);
    try {
      await onAdvertise();
    } finally {
      setAdvertising(false);
    }
  };

  return (
    <div className={className}>
      {/* Connection display */}
      <div className="space-y-2">
        <Label>Connection</Label>
        {health?.connection_info ? (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-status-connected" />
            <code className="px-2 py-1 bg-muted rounded text-foreground text-sm">
              {health.connection_info}
            </code>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-status-disconnected" />
            <span>Not connected</span>
          </div>
        )}
      </div>

      {/* Radio Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Radio Name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <Separator />

      {/* Radio Config */}
      <div className="space-y-2">
        <Label htmlFor="preset">Preset</Label>
        <select
          id="preset"
          value={currentPreset}
          onChange={(e) => handlePresetChange(e.target.value)}
          className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <option value="custom">Custom</option>
          {RADIO_PRESETS.map((preset) => (
            <option key={preset.name} value={preset.name}>
              {preset.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="freq">Frequency (MHz)</Label>
          <Input
            id="freq"
            type="number"
            step="any"
            value={freq}
            onChange={(e) => setFreq(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bw">Bandwidth (kHz)</Label>
          <Input
            id="bw"
            type="number"
            step="any"
            value={bw}
            onChange={(e) => setBw(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sf">Spreading Factor</Label>
          <Input
            id="sf"
            type="number"
            min="7"
            max="12"
            value={sf}
            onChange={(e) => setSf(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cr">Coding Rate</Label>
          <Input
            id="cr"
            type="number"
            min="5"
            max="8"
            value={cr}
            onChange={(e) => setCr(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="tx-power">TX Power (dBm)</Label>
          <Input
            id="tx-power"
            type="number"
            value={txPower}
            onChange={(e) => setTxPower(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="max-tx">Max TX Power</Label>
          <Input id="max-tx" type="number" value={config.max_tx_power} disabled />
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Location</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGetLocation}
            disabled={gettingLocation}
          >
            {gettingLocation ? 'Getting...' : '📍 Use My Location'}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="lat" className="text-xs text-muted-foreground">
              Latitude
            </Label>
            <Input
              id="lat"
              type="number"
              step="any"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lon" className="text-xs text-muted-foreground">
              Longitude
            </Label>
            <Input
              id="lon"
              type="number"
              step="any"
              value={lon}
              onChange={(e) => setLon(e.target.value)}
            />
          </div>
        </div>
      </div>

      {config.path_hash_mode_supported && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="path-hash-mode">Path Hash Mode</Label>
            <select
              id="path-hash-mode"
              value={pathHashMode}
              onChange={(e) => setPathHashMode(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="0">1 byte (default)</option>
              <option value="1">2 bytes</option>
              <option value="2">3 bytes</option>
            </select>
            <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-xs text-amber-200">
              <p className="font-semibold mb-1">Compatibility Warning</p>
              <p>
                ALL nodes along a message&apos;s route &mdash; your radio, every repeater, and the
                recipient &mdash; must be running firmware that supports the selected mode. Messages
                sent with 2-byte or 3-byte hops will be dropped by any node on older firmware.
              </p>
            </div>
          </div>
        </>
      )}

      {error && (
        <div className="text-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={busy || rebooting}
          variant="outline"
          className="flex-1"
        >
          {busy && !rebooting ? 'Saving...' : 'Save'}
        </Button>
        <Button onClick={handleSaveAndReboot} disabled={busy || rebooting} className="flex-1">
          {rebooting ? 'Rebooting...' : 'Save & Reboot'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Some settings may require a reboot to take effect on some radios.
      </p>

      <Separator />

      {/* Keys */}
      <div className="space-y-2">
        <Label htmlFor="public-key">Public Key</Label>
        <Input id="public-key" value={config.public_key} disabled className="font-mono text-xs" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="private-key">Set Private Key (write-only)</Label>
        <Input
          id="private-key"
          type="password"
          autoComplete="off"
          value={privateKey}
          onChange={(e) => setPrivateKey(e.target.value)}
          placeholder="64-character hex private key"
        />
        <Button
          onClick={handleSetPrivateKey}
          disabled={identityBusy || identityRebooting || !privateKey.trim()}
          className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
          variant="outline"
        >
          {identityBusy || identityRebooting
            ? 'Setting & Rebooting...'
            : 'Set Private Key & Reboot'}
        </Button>
      </div>

      {identityError && (
        <div className="text-sm text-destructive" role="alert">
          {identityError}
        </div>
      )}

      <Separator />

      {/* Flood & Advert Control */}
      <div className="space-y-2">
        <Label className="text-base">Flood & Advert Control</Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="advert-interval">Periodic Advertising Interval</Label>
        <div className="flex items-center gap-2">
          <Input
            id="advert-interval"
            type="number"
            min="0"
            value={advertIntervalHours}
            onChange={(e) => setAdvertIntervalHours(e.target.value)}
            className="w-28"
          />
          <span className="text-sm text-muted-foreground">hours (0 = off)</span>
        </div>
        <p className="text-xs text-muted-foreground">
          How often to automatically advertise presence. Set to 0 to disable. Minimum: 1 hour.
          Recommended: 24 hours or higher.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="flood-scope">Flood Scope / Region</Label>
        <Input
          id="flood-scope"
          value={floodScope}
          onChange={(e) => setFloodScope(e.target.value)}
          placeholder="#MyRegion"
        />
        <p className="text-xs text-muted-foreground">
          Tag outgoing flood messages with a region name (e.g. #MyRegion). Repeaters with this
          region configured will prioritize your traffic. Leave empty to disable.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="max-contacts">Max Contacts on Radio</Label>
        <Input
          id="max-contacts"
          type="number"
          min="1"
          max="1000"
          value={maxRadioContacts}
          onChange={(e) => setMaxRadioContacts(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Favorite contacts load first, then recent non-repeater contacts until this limit is
          reached (1-1000)
        </p>
      </div>

      {floodError && (
        <div className="text-sm text-destructive" role="alert">
          {floodError}
        </div>
      )}

      <Button onClick={handleSaveFloodSettings} disabled={floodBusy} className="w-full">
        {floodBusy ? 'Saving...' : 'Save Settings'}
      </Button>

      <Separator />

      {/* Send Advertisement */}
      <div className="space-y-2">
        <Label>Send Advertisement</Label>
        <p className="text-xs text-muted-foreground">
          Send a flood advertisement to announce your presence on the mesh network.
        </p>
        <Button
          onClick={handleAdvertise}
          disabled={advertising || !health?.radio_connected}
          className="w-full bg-warning hover:bg-warning/90 text-warning-foreground"
        >
          {advertising ? 'Sending...' : 'Send Advertisement'}
        </Button>
        {!health?.radio_connected && (
          <p className="text-sm text-destructive">Radio not connected</p>
        )}
      </div>
    </div>
  );
}
