// Haversine distance calculation helper
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
}

/**
 * Searches places/cities/addresses using OpenStreetMap Nominatim
 */
export const searchLocation = async (req, res) => {
  const { q } = req.query;

  if (!q || typeof q !== 'string' || q.trim().length < 2) {
    return res.status(400).json({ success: false, message: 'Search query must be at least 2 characters.' });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&q=${encodeURIComponent(
      q.trim()
    )}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'GrocerStock-Platform/1.0 (support@grocerstock.internal)',
        'Accept-Language': 'en',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Geocoding service returned status ${response.status}`);
    }

    const data = await response.json();
    const suggestions = (data || []).map((item) => ({
      name: item.name || (item.display_name ? item.display_name.split(',')[0].trim() : 'Location'),
      displayName: item.display_name,
      formattedAddress: item.display_name,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      address: item.display_name,
      city: item.address?.city || item.address?.town || item.address?.village || item.address?.county || '',
      state: item.address?.state || '',
      country: item.address?.country || '',
      postalCode: item.address?.postcode || '',
    }));

    res.json({ success: true, data: suggestions, suggestions });
  } catch (error) {
    console.error('Location search error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to search locations. Please try typing your city name.',
      data: [],
      suggestions: [],
    });
  }
};

/**
 * Reverse geocodes coordinates to a human-readable address
 */
export const reverseGeocode = async (req, res) => {
  const { lat, lng } = req.query;

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);

  if (isNaN(latitude) || isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({ success: false, message: 'Invalid latitude or longitude coordinates.' });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${latitude}&lon=${longitude}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'GrocerStock-Platform/1.0 (support@grocerstock.internal)',
        'Accept-Language': 'en',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Reverse geocoding service returned status ${response.status}`);
    }

    const item = await response.json();
    const location = {
      formattedAddress: item.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      city: item.address?.city || item.address?.town || item.address?.village || item.address?.suburb || '',
      state: item.address?.state || '',
      country: item.address?.country || '',
      postalCode: item.address?.postcode || '',
      latitude,
      longitude,
    };

    res.json({ success: true, data: location, location });
  } catch (error) {
    console.error('Reverse geocode error:', error.message);
    const fallbackLocation = {
      formattedAddress: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      city: '',
      state: '',
      country: '',
      postalCode: '',
      latitude,
      longitude,
    };
    res.json({
      success: true,
      data: fallbackLocation,
      location: fallbackLocation,
    });
  }
};

/**
 * Returns driving directions with real road geometry, distance, and ETA via OSRM
 */
export const getDirections = async (req, res) => {
  const { startLat, startLng, endLat, endLng } = req.query;

  const sLat = parseFloat(startLat);
  const sLng = parseFloat(startLng);
  const eLat = parseFloat(endLat);
  const eLng = parseFloat(endLng);

  if (
    isNaN(sLat) ||
    isNaN(sLng) ||
    isNaN(eLat) ||
    isNaN(eLng) ||
    sLat < -90 ||
    sLat > 90 ||
    eLat < -90 ||
    eLat > 90 ||
    sLng < -180 ||
    sLng > 180 ||
    eLng < -180 ||
    eLng > 180
  ) {
    return res.status(400).json({ success: false, message: 'Invalid start or end coordinates provided.' });
  }

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${sLng},${sLat};${eLng},${eLat}?overview=full&geometries=geojson`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'GrocerStock-Platform/1.0',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Routing service returned status ${response.status}`);
    }

    const data = await response.json();
    if (!data.routes || data.routes.length === 0) {
      throw new Error('No driving route found between coordinates');
    }

    const primaryRoute = data.routes[0];
    const distanceKm = Number((primaryRoute.distance / 1000).toFixed(1));
    const durationMinutes = Math.max(1, Math.round(primaryRoute.duration / 60));

    res.json({
      success: true,
      distanceKm,
      durationMin: durationMinutes,
      durationMinutes,
      durationFormatted: formatDuration(durationMinutes),
      coordinates: primaryRoute.geometry.coordinates, // Array of [lng, lat] along road network
      route: {
        type: 'Feature',
        properties: { distanceKm, durationMinutes },
        geometry: primaryRoute.geometry,
      },
      summary: primaryRoute.legs?.[0]?.summary || '',
      isFallback: false,
    });
  } catch (error) {
    console.warn('OSRM routing fallback engaged:', error.message);
    const distanceKm = calculateHaversineDistance(sLat, sLng, eLat, eLng);
    // Estimate ~35 km/h urban delivery driving speed
    const durationMinutes = Math.max(2, Math.round((distanceKm / 35) * 60));

    res.json({
      success: true,
      distanceKm,
      durationMin: durationMinutes,
      durationMinutes,
      durationFormatted: formatDuration(durationMinutes),
      coordinates: [
        [sLng, sLat],
        [eLng, eLat],
      ],
      route: {
        type: 'Feature',
        properties: { distanceKm, durationMinutes },
        geometry: {
          type: 'LineString',
          coordinates: [
            [sLng, sLat],
            [eLng, eLat],
          ],
        },
      },
      summary: 'Direct route estimate',
      isFallback: true,
    });
  }
};
