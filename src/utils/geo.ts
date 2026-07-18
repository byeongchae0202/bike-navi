import type { LatLng } from '../types/geo'

const EARTH_RADIUS_M = 6_371_000

export function haversineDistanceMeters(a: LatLng, b: LatLng) {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

export function pressureToAltitudeMeters(hPa: number, seaLevelPressure = 1013.25) {
  return 44330 * (1 - (hPa / seaLevelPressure) ** 0.1903)
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
