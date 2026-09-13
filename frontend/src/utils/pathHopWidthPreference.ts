// Browser-local preference for showing the per-hop byte width (e.g. "2B")
// next to the hop-count badge on received messages. Pure display tweak, stored
// per-browser in localStorage. On by default.

export const SHOW_PATH_HOP_WIDTH_KEY = 'meshloom-show-path-hop-width';

export function getSavedShowPathHopWidth(): boolean {
  try {
    return localStorage.getItem(SHOW_PATH_HOP_WIDTH_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setSavedShowPathHopWidth(enabled: boolean): void {
  try {
    localStorage.setItem(SHOW_PATH_HOP_WIDTH_KEY, enabled ? 'true' : 'false');
  } catch {
    // localStorage may be unavailable
  }
}
