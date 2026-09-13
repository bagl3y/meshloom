// Browser-local preference for rendering MeshCore Open emoji reactions
// instead of their raw encoded text. This is a pure display tweak, stored
// per-browser in localStorage. The toggle only gates emoji reactions; Giphy
// GIFs already render as images without it. On by default.

export const RENDER_RICH_PAYLOADS_KEY = 'meshloom-render-rich-payloads';

export function getSavedRenderRichPayloads(): boolean {
  try {
    return localStorage.getItem(RENDER_RICH_PAYLOADS_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setSavedRenderRichPayloads(enabled: boolean): void {
  try {
    localStorage.setItem(RENDER_RICH_PAYLOADS_KEY, enabled ? 'true' : 'false');
  } catch {
    // localStorage may be unavailable
  }
}
