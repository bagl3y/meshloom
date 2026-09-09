import { useTranslation } from 'react-i18next';
import { RepeaterPane, NotFetched } from './repeaterPaneShared';
import { cn } from '@/lib/utils';
import type { RepeaterRegionsResponse, PaneState } from '../../types';

export function RegionsPane({
  data,
  state,
  onRefresh,
  disabled,
}: {
  data: RepeaterRegionsResponse | null;
  state: PaneState;
  onRefresh: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const headerNote = data?.truncated
    ? t('repeater.regionsTruncated')
    : data?.source === 'anon'
      ? t('repeater.regionsNoteAnon')
      : t('repeater.regionsNote');

  return (
    <RepeaterPane
      title={t('repeater.regions')}
      state={state}
      onRefresh={onRefresh}
      disabled={disabled}
      headerNote={headerNote}
    >
      {!data ? (
        <NotFetched />
      ) : data.regions.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">{t('repeater.noRegions')}</p>
      ) : (
        <div className="space-y-0.5">
          {data.regions.map((region, index) => (
            <div
              key={`${region.depth}-${region.name}-${index}`}
              className="flex items-center gap-2 text-sm py-0.5"
              style={{ paddingLeft: `${region.depth * 0.9}rem` }}
            >
              <span className="font-mono truncate">
                {region.name === '*' ? t('repeater.allRegions') : region.name}
              </span>
              {region.is_home && (
                <span className="text-[0.625rem] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                  {t('repeater.home')}
                </span>
              )}
              <span
                className={cn(
                  'ml-auto shrink-0 text-[0.625rem] uppercase tracking-wider px-1.5 py-0.5 rounded',
                  region.flood_allowed
                    ? 'bg-success/15 text-success'
                    : 'bg-muted text-muted-foreground'
                )}
                title={
                  region.flood_allowed
                    ? t('repeater.floodAllowedTitle')
                    : t('repeater.floodBlockedTitle')
                }
              >
                {region.flood_allowed ? t('repeater.floodAllowed') : t('repeater.floodBlocked')}
              </span>
            </div>
          ))}
        </div>
      )}
    </RepeaterPane>
  );
}
