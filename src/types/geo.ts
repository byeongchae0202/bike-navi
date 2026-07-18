export type LatLng = {
  lat: number
  lng: number
}

export type Place = {
  id: string
  name: string
  address: string
  location: LatLng
}

export type RouteSummary = {
  distanceKm: number
  durationMin: number
  bicycleRoadRatio: number
}

export type RoutePoint = LatLng & { elevationM?: number; isBikeRoad?: boolean }

export type NearbyCourse = {
  id: string
  name: string
  totalDistanceKm: number
  gainElevationM: number
  coordinates: LatLng[]
}
