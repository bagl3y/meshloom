// Browser-local CARTO API key for MapView dark raster tiles.
// Neighbors / Locate / Path stay on OSM and do not use this key.
// Request a free key at https://carto.com/basemaps/apikey

export const CARTO_API_KEY_STORAGE = 'meshloom-carto-api-key';

function envCartoApiKey(): string {
  const env = import.meta.env.VITE_CARTO_API_KEY;
  return typeof env === 'string' ? env.trim() : '';
}

export function getSavedCartoApiKey(): string {
  try {
    const saved = localStorage.getItem(CARTO_API_KEY_STORAGE)?.trim();
    if (saved) return saved;
  } catch {
    // localStorage may be unavailable
  }
  return envCartoApiKey();
}

export function setSavedCartoApiKey(key: string): void {
  try {
    const trimmed = key.trim();
    if (trimmed) {
      localStorage.setItem(CARTO_API_KEY_STORAGE, trimmed);
    } else {
      localStorage.removeItem(CARTO_API_KEY_STORAGE);
    }
  } catch {
    // localStorage may be unavailable
  }
}
