import { KAKAO_MOBILITY_BASE, KAKAO_REST_KEY } from '../constants/env'
import type { LatLng, RoutePoint, RouteSummary } from '../types/geo'
import type { KakaoBikeDirectionsResponse, KakaoBikeRoad } from '../types/kakao'

type RouteRequest = {
  origin: LatLng
  destination: LatLng
  waypoints: LatLng[]
}

type RouteResponse = {
  path: RoutePoint[]
  summary: RouteSummary
}

const BICYCLE_API =
  (KAKAO_MOBILITY_BASE ?? 'https://apis-navi.kakaomobility.com') +
  '/affiliate/bicycle/v1/directions'

function roadIsBikePreferred(road: KakaoBikeRoad) {
  if (road.is_bicycle_only) {
    return true
  }
  if (road.road_type?.toUpperCase().includes('BICYCLE')) {
    return true
  }
  return false
}

function parseRoutePoints(response: KakaoBikeDirectionsResponse): RoutePoint[] {
  const roads = response.routes?.[0]?.sections?.flatMap((section) => section.roads ?? []) ?? []
  const points: RoutePoint[] = []

  for (const road of roads) {
    const vertices = road.vertexes ?? []
    const elevations = road.elevations ?? []
    let elevationIndex = 0
    for (let index = 0; index < vertices.length; index += 2) {
      const lng = vertices[index]
      const lat = vertices[index + 1]
      if (typeof lat === 'number' && typeof lng === 'number') {
        const elevationM = elevations[elevationIndex]
        points.push({
          lat,
          lng,
          isBikeRoad: roadIsBikePreferred(road),
          elevationM: typeof elevationM === 'number' ? elevationM : undefined,
        })
        elevationIndex += 1
      }
    }
  }
  return points
}

function applyFallbackElevation(path: RoutePoint[]) {
  const hasElevation = path.some((point) => typeof point.elevationM === 'number')
  if (hasElevation) {
    return path
  }
  return path.map((point, index) => ({
    ...point,
    elevationM: 35 + Math.sin(index / 6) * 12,
  }))
}

function computeBikeRoadRatio(response: KakaoBikeDirectionsResponse) {
  const route = response.routes?.[0]
  const totalDistance = route?.summary?.distance ?? 0
  const summaryRatioSource = route?.summary?.bicycle_road_distance
  if (summaryRatioSource && totalDistance > 0) {
    return (summaryRatioSource / totalDistance) * 100
  }

  const roads = route?.sections?.flatMap((section) => section.roads ?? []) ?? []
  const bikeDistance = roads.reduce((sum, road) => {
    if (!roadIsBikePreferred(road)) {
      return sum
    }
    return sum + (road.distance ?? 0)
  }, 0)
  return totalDistance > 0 ? (bikeDistance / totalDistance) * 100 : 0
}

export async function requestBicycleRoute(payload: RouteRequest): Promise<RouteResponse> {
  if (!KAKAO_REST_KEY) {
    throw new Error('VITE_KAKAO_REST_API_KEY가 필요합니다.')
  }

  const response = await fetch(BICYCLE_API, {
    method: 'POST',
    headers: {
      Authorization: `KakaoAK ${KAKAO_REST_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      origin: [payload.origin.lng, payload.origin.lat],
      destination: [payload.destination.lng, payload.destination.lat],
      waypoints: payload.waypoints.map((point) => [point.lng, point.lat]),
      priority: 'SHORTEST',
    }),
  })

  if (!response.ok) {
    throw new Error(`자전거 길찾기 API 실패 (${response.status})`)
  }

  const data = (await response.json()) as KakaoBikeDirectionsResponse
  const path = applyFallbackElevation(parseRoutePoints(data))
  if (!path.length) {
    throw new Error('경로 좌표가 비어 있습니다.')
  }

  const summary = data.routes?.[0]?.summary
  return {
    path,
    summary: {
      distanceKm: (summary?.distance ?? 0) / 1000,
      durationMin: (summary?.duration ?? 0) / 60,
      bicycleRoadRatio: computeBikeRoadRatio(data),
    },
  }
}
