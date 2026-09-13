const COMMUNITY_OPT_OUT_BANNER_DISMISSED_KEY = 'meshloom-community-opt-out-banner-dismissed';

export function isCommunityOptOutBannerDismissed(): boolean {
  try {
    return localStorage.getItem(COMMUNITY_OPT_OUT_BANNER_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function setCommunityOptOutBannerDismissed(dismissed: boolean): void {
  try {
    if (dismissed) {
      localStorage.setItem(COMMUNITY_OPT_OUT_BANNER_DISMISSED_KEY, '1');
    } else {
      localStorage.removeItem(COMMUNITY_OPT_OUT_BANNER_DISMISSED_KEY);
    }
  } catch {
    // localStorage may be unavailable
  }
}
