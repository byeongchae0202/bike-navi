import type { LatLng } from './geo'

export type RideMetrics = {
  speedKmh: number
  distanceKm: number
  durationSec: number
  elevationM: number
  gradePercent: number
  autoPaused: boolean
  currentPosition: LatLng | null
  crashDetected: boolean
}
