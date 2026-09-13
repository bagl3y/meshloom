// Browser-local Giphy API key for the GIF picker search. Display of inbound
// `g:<id>` payloads does not need a key (they load from media.giphy.com).
// Search/trending require a key from https://developers.giphy.com/dashboard/

export const GIPHY_API_KEY_STORAGE = 'meshloom-giphy-api-key';

function envGiphyApiKey(): string {
  const env = import.meta.env.VITE_GIPHY_API_KEY;
  return typeof env === 'string' ? env.trim() : '';
}

export function getSavedGiphyApiKey(): string {
  try {
    const saved = localStorage.getItem(GIPHY_API_KEY_STORAGE)?.trim();
    if (saved) return saved;
  } catch {
    // localStorage may be unavailable
  }
  return envGiphyApiKey();
}

export function setSavedGiphyApiKey(key: string): void {
  try {
    const trimmed = key.trim();
    if (trimmed) {
      localStorage.setItem(GIPHY_API_KEY_STORAGE, trimmed);
    } else {
      localStorage.removeItem(GIPHY_API_KEY_STORAGE);
    }
  } catch {
    // localStorage may be unavailable
  }
}
