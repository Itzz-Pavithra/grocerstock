/**
 * Computes great-circle distance between two latitude/longitude points in kilometers
 * using the Haversine formula.
 *
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number|null} distance in kilometers rounded to 1 decimal place, or null if coordinates invalid
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  if (
    lat1 === null ||
    lat1 === undefined ||
    lon1 === null ||
    lon1 === undefined ||
    lat2 === null ||
    lat2 === undefined ||
    lon2 === null ||
    lon2 === undefined
  ) {
    return null;
  }

  const pLat1 = Number(lat1);
  const pLon1 = Number(lon1);
  const pLat2 = Number(lat2);
  const pLon2 = Number(lon2);

  if (isNaN(pLat1) || isNaN(pLon1) || isNaN(pLat2) || isNaN(pLon2)) {
    return null;
  }

  const R = 6371; // Earth's mean radius in km
  const dLat = ((pLat2 - pLat1) * Math.PI) / 180;
  const dLon = ((pLon2 - pLon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((pLat1 * Math.PI) / 180) *
      Math.cos((pLat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

/**
 * Resolves coordinate numbers from profile object supporting both flat lat/lng and GeoJSON Point
 */
export function extractCoordinates(profile) {
  if (!profile) return { latitude: null, longitude: null };

  let lat = null;
  let lng = null;

  if (profile.latitude !== undefined && profile.latitude !== null && profile.latitude !== '') {
    const p = Number(profile.latitude);
    if (!isNaN(p) && p >= -90 && p <= 90) lat = p;
  }
  if (profile.longitude !== undefined && profile.longitude !== null && profile.longitude !== '') {
    const p = Number(profile.longitude);
    if (!isNaN(p) && p >= -180 && p <= 180) lng = p;
  }

  if (
    (lat === null || lng === null) &&
    profile.location &&
    Array.isArray(profile.location.coordinates) &&
    profile.location.coordinates.length === 2
  ) {
    const pLng = Number(profile.location.coordinates[0]);
    const pLat = Number(profile.location.coordinates[1]);
    if (!isNaN(pLat) && pLat >= -90 && pLat <= 90) lat = pLat;
    if (!isNaN(pLng) && pLng >= -180 && pLng <= 180) lng = pLng;
  }

  return { latitude: lat, longitude: lng };
}
