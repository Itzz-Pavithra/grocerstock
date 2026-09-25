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

  // 1. Check if maplibregl is already on window
  if (typeof window !== 'undefined' && window.maplibregl && typeof window.maplibregl.Map === 'function') {
    return window.maplibregl;
  }

  // 2. Dynamic import with comprehensive unwrap logic
  try {
    const mod = await import('maplibre-gl');
    if (mod) {
      if (typeof mod.Map === 'function') {
        window.maplibregl = mod;
        return mod;
      }
      if (mod.default && typeof mod.default.Map === 'function') {
        window.maplibregl = mod.default;
        return mod.default;
      }
      if (mod.default && mod.default.default && typeof mod.default.default.Map === 'function') {
        window.maplibregl = mod.default.default;
        return mod.default.default;
      }
    }
  } catch (err) {
    console.warn('Dynamic import of maplibre-gl failed:', err);
  }

  // 3. Fallback: load MapLibre GL from CDN if bundler bundle failed
  if (typeof window !== 'undefined') {
    if (!window.maplibregl || typeof window.maplibregl.Map !== 'function') {
      await new Promise((resolve, reject) => {
        const existing = document.getElementById('maplibre-cdn-script');
        if (existing) {
          existing.addEventListener('load', () => resolve(window.maplibregl));
          existing.addEventListener('error', () => reject(new Error('Failed to load MapLibre GL from CDN')));
          return;
        }
        const script = document.createElement('script');
        script.id = 'maplibre-cdn-script';
        script.src = 'https://unpkg.com/maplibre-gl@5.1.0/dist/maplibre-gl.js';
        script.onload = () => resolve(window.maplibregl);
        script.onerror = () => reject(new Error('Failed to load MapLibre GL from CDN'));
        document.head.appendChild(script);
      });
    }

    if (window.maplibregl && typeof window.maplibregl.Map === 'function') {
      return window.maplibregl;
    }
  }

  throw new Error('MapLibre GL library could not be loaded.');
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
