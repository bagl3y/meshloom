import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  isCommunityOptOutBannerDismissed,
  setCommunityOptOutBannerDismissed,
} from '../utils/communityBannerPreference';
import { Button } from './ui/button';

export function communitySetupBannerVisible(enabled: boolean, iata: string): boolean {
  if (enabled && iata.trim()) return false;
  if (!enabled && isCommunityOptOutBannerDismissed()) return false;
  return !enabled || !iata.trim();
}

export function CommunitySetupBanner({
  enabled,
  iata,
  onOpenSettings,
}: {
  enabled: boolean;
  iata: string;
  onOpenSettings: () => void;
}) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(isCommunityOptOutBannerDismissed);
  if (!communitySetupBannerVisible(enabled, iata) || (!enabled && dismissed)) return null;

  return (
    <div
      data-testid="community-setup-banner"
      className="flex flex-col gap-3 border-b border-warning/30 bg-warning/10 px-4 py-3 text-warning sm:flex-row sm:items-center sm:justify-between"
      role="status"
    >
      <p className="text-[0.8125rem] leading-snug">
        {enabled ? t('settings.community.bannerMessage') : t('settings.community.bannerOptedOut')}
      </p>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-warning/50 text-warning hover:bg-warning/10"
          onClick={onOpenSettings}
        >
          {t('settings.community.bannerOpenSettings')}
        </Button>
        {!enabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-warning hover:bg-warning/10"
            onClick={() => {
              setCommunityOptOutBannerDismissed(true);
              setDismissed(true);
            }}
          >
            {t('settings.community.bannerDismiss')}
          </Button>
        )}
      </div>
    </div>
  );
}
