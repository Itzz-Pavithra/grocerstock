import { browser } from '$app/environment';

/**
 * Robust cross-bundler loader for MapLibre GL JS in SvelteKit / Vite.
 * In MapLibre v5+, Map, Marker, Popup, etc. are pure ESM named exports.
 * This helper resolves both ESM namespace exports and CJS default objects seamlessly.
 */
export async function getMapLibre() {
  if (!browser) {
    throw new Error('MapLibre GL can only be loaded in the browser environment.');
  }

  const mod = await import('maplibre-gl');
  if (mod && typeof mod.Map === 'function') {
    return mod;
  }
  if (mod && mod.default && typeof mod.default.Map === 'function') {
    return mod.default;
  }
  return mod;
}

/**
 * Production-ready OpenStreetMap raster tiles style specification.
 * Works 100% reliably in any environment without requiring external API keys.
 */
export const osmRasterStyle = {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: 'osm-tiles',
      type: 'raster',
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};
