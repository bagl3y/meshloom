// Browser-local preference for collapsing the desktop conversation sidebar
// into an icon rail. Mobile sheet navigation is unaffected. Off (expanded)
// by default.

export const DESKTOP_SIDEBAR_COLLAPSED_KEY = 'remoteterm-desktop-sidebar-collapsed';

export function getSavedDesktopSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(DESKTOP_SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSavedDesktopSidebarCollapsed(collapsed: boolean): void {
  try {
    if (collapsed) {
      localStorage.setItem(DESKTOP_SIDEBAR_COLLAPSED_KEY, 'true');
    } else {
      localStorage.removeItem(DESKTOP_SIDEBAR_COLLAPSED_KEY);
    }
  } catch {
    // localStorage may be unavailable
  }
}
