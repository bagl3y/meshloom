import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CommunitySetupBanner,
  communitySetupBannerVisible,
} from '../components/CommunitySetupBanner';
import i18n from '../i18n';
import { setCommunityOptOutBannerDismissed } from '../utils/communityBannerPreference';
import { DEFAULT_LOCALE } from '../utils/languagePreference';

describe('CommunitySetupBanner', () => {
  afterEach(() => {
    setCommunityOptOutBannerDismissed(false);
    void i18n.changeLanguage(DEFAULT_LOCALE);
  });

  it('is incomplete until Community is on and IATA is set', () => {
    expect(communitySetupBannerVisible(false, '')).toBe(true);
    expect(communitySetupBannerVisible(true, '')).toBe(true);
    expect(communitySetupBannerVisible(true, 'LYS')).toBe(false);
  });

  it('hides the opt-out banner after a permanent dismiss', () => {
    setCommunityOptOutBannerDismissed(true);
    expect(communitySetupBannerVisible(false, '')).toBe(false);
    expect(communitySetupBannerVisible(true, '')).toBe(true);
  });

  it('asks for an IATA code when Community is on', () => {
    const onOpenSettings = vi.fn();
    render(<CommunitySetupBanner enabled iata="" onOpenSettings={onOpenSettings} />);
    expect(screen.getByTestId('community-setup-banner')).toHaveTextContent(
      i18n.t('settings.community.bannerMessage')
    );
    expect(
      screen.queryByRole('button', { name: i18n.t('settings.community.bannerDismiss') })
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: i18n.t('settings.community.bannerOpenSettings') })
    );
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('lets an opted-out operator dismiss the banner permanently', () => {
    render(<CommunitySetupBanner enabled={false} iata="" onOpenSettings={() => undefined} />);
    expect(screen.getByTestId('community-setup-banner')).toHaveTextContent(
      i18n.t('settings.community.bannerOptedOut')
    );
    fireEvent.click(
      screen.getByRole('button', { name: i18n.t('settings.community.bannerDismiss') })
    );
    expect(screen.queryByTestId('community-setup-banner')).not.toBeInTheDocument();
    expect(communitySetupBannerVisible(false, '')).toBe(false);
  });

  it('hides when setup is complete', () => {
    const { container } = render(
      <CommunitySetupBanner enabled iata="LYS" onOpenSettings={() => undefined} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
