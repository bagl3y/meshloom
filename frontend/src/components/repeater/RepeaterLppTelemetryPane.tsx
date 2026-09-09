import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RepeaterPane, NotFetched, LppSensorRow, formatLppLabel } from './repeaterPaneShared';
import { useDistanceUnit } from '../../contexts/DistanceUnitContext';
import type { RepeaterLppTelemetryResponse, PaneState } from '../../types';

export function LppTelemetryPane({
  data,
  state,
  onRefresh,
  disabled,
}: {
  data: RepeaterLppTelemetryResponse | null;
  state: PaneState;
  onRefresh: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { distanceUnit } = useDistanceUnit();

  // Build disambiguated labels matching the telemetry history chart names
  const labels = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    return data.sensors.map((s) => {
      const base = `${s.type_name}_${s.channel}`;
      const n = (counts.get(base) ?? 0) + 1;
      counts.set(base, n);
      return n > 1
        ? t('repeater.lppChannelN', {
            label: formatLppLabel(s.type_name),
            channel: s.channel,
            n,
          })
        : t('repeater.lppChannel', { label: formatLppLabel(s.type_name), channel: s.channel });
    });
  }, [data, t]);

  return (
    <RepeaterPane
      title={t('repeater.lppSensors')}
      state={state}
      onRefresh={onRefresh}
      disabled={disabled}
    >
      {!data ? (
        <NotFetched />
      ) : data.sensors.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('repeater.noSensors')}</p>
      ) : (
        <div className="space-y-0.5">
          {data.sensors.map((sensor, i) => (
            <LppSensorRow key={i} sensor={sensor} unitPref={distanceUnit} label={labels[i]} />
          ))}
        </div>
      )}
    </RepeaterPane>
  );
}
