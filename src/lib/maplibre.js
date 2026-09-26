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
 * Resolves the configured CARTO API key from Vite / SvelteKit public environment variables.
 */
export function getCartoApiKey() {
  const key = (import.meta.env.VITE_CARTO_API_KEY || import.meta.env.VITE_MAP_API_KEY || '').trim();
  return key && key !== 'YOUR_CARTO_API_KEY' ? key : '';
}

/**
 * Resolves the configured MapTiler API key from Vite / SvelteKit public environment variables.
 */
export function getMapTilerApiKey() {
  const key = (import.meta.env.VITE_MAPTILER_API_KEY || '').trim();
  return key && key !== 'YOUR_MAPTILER_API_KEY' ? key : '';
}

/**
 * Clean OpenStreetMap standard raster tiles specification.
 * 100% free, reliable, no API key required, and ZERO watermarks.
 */
export const cleanOsmRasterStyle = {
  version: 8,
  sources: {
    'osm-standard': {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: 'osm-standard-tiles',
      type: 'raster',
      source: 'osm-standard',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

/**
 * Creates authenticated CARTO Voyager raster tiles specification.
 * If apiKey is provided, it is appended to all tile requests to eliminate watermarks.
 */
export function createCartoRasterStyle(apiKey) {
  const keyParam = apiKey ? `?api_key=${encodeURIComponent(apiKey)}` : '';
  return {
    version: 8,
    sources: {
      'carto-voyager': {
        type: 'raster',
        tiles: [
          `https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png${keyParam}`,
          `https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png${keyParam}`,
          `https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png${keyParam}`,
          `https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png${keyParam}`,
        ],
        tileSize: 256,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
      },
    },
    layers: [
      {
        id: 'carto-voyager-tiles',
        type: 'raster',
        source: 'carto-voyager',
        minzoom: 0,
        maxzoom: 20,
      },
    ],
  };
}

/**
 * Resolves the effective MapLibre style:
 * 1. If VITE_CARTO_API_KEY is configured, uses CARTO Voyager with the key.
 * 2. If VITE_MAPTILER_API_KEY is configured, uses MapTiler Streets v2.
 * 3. Fallback: Clean OpenStreetMap standard raster tiles (zero watermark, no key required).
 */
export function getEffectiveMapStyle() {
  const cartoKey = getCartoApiKey();
  const mapTilerKey = getMapTilerApiKey();

  if (cartoKey) {
    return createCartoRasterStyle(cartoKey);
  }

  if (mapTilerKey) {
    return `https://api.maptiler.com/maps/streets-v2/style.json?key=${encodeURIComponent(mapTilerKey)}`;
  }

  return cleanOsmRasterStyle;
}

/**
 * Creates MapLibre transformRequest function to inject CARTO API key into all sub-resource requests
 */
export function createMapTransformRequest() {
  const cartoKey = getCartoApiKey();
  return (url) => {
    if (cartoKey && typeof url === 'string' && url.includes('cartocdn.com') && !url.includes('api_key=')) {
      const sep = url.includes('?') ? '&' : '?';
      return { url: `${url}${sep}api_key=${encodeURIComponent(cartoKey)}` };
    }
    return { url };
  };
}

// Backward-compatible alias for existing imports
export const osmRasterStyle = cleanOsmRasterStyle;
