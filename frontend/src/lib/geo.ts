/** Client-side distance helper for feed filtering. */

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r;
  const dLon = (lon2 - lon1) * r;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function withinKm<T extends { lat: number; lon: number }>(items: T[], lat: number, lon: number, maxKm: number, max = 50): T[] {
  return items
    .map((item) => ({ item, distance: haversineKm(lat, lon, item.lat, item.lon) }))
    .filter(({ distance }) => distance <= maxKm)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, max)
    .map(({ item }) => item);
}
