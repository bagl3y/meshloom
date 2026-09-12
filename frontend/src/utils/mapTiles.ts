/**
 * OSMF volunteer raster tiles. Policy:
 * https://operations.osmfoundation.org/policies/tiles/
 *
 * Leaflet also sets a per-image referrerPolicy so tile requests still
 * send a Referer if a document policy would otherwise omit it.
 */
export const OSM_RASTER_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const OSM_RASTER_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export const OSM_RASTER_REFERRER_POLICY = 'strict-origin-when-cross-origin' as const;
