import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import L, { type LatLngLiteral } from 'leaflet'
import './App.css'

type TabKey = 'home' | 'explore' | 'schedule' | 'profile'
type ClimbLevel = 'any' | 'low' | 'medium' | 'high'
type PickMode = 'destination' | 'waypoint'
type ScreenMode = 'main' | 'navigation'

interface TabItem {
  key: TabKey
  label: string
}

interface Course {
  id: string
  name: string
  distanceKm: number
  elevationM: number
  etaMin: number
  description: string
  destination: LatLngLiteral
}

interface Waypoint {
  id: string
  name: string
  point: LatLngLiteral
}

interface NavigationRoute {
  path: LatLngLiteral[]
  pathCumulativeKm: number[]
  distanceKm: number
  durationMin: number
  steps: NavigationStep[]
  stepCumulativeKm: number[]
}

interface NavigationStep {
  instruction: string
  distanceM: number
  durationS: number
  maneuverType: string
  modifier?: string
  point: LatLngLiteral
}

interface RideRecord {
  id: string
  routeName: string
  startedAt: string
  endedAt: string
  distanceKm: number
  durationMin: number
  avgSpeedKmh: number
}

interface Profile {
  heightCm: number
  weightKg: number
  age: number
}

interface PlaceSearchItem {
  lat: string
  lon: string
  display_name?: string
}

interface PhotonSearchResponse {
  features?: Array<{
    geometry?: {
      coordinates?: [number, number]
    }
    properties?: {
      name?: string
      street?: string
      city?: string
      district?: string
      county?: string
      state?: string
      country?: string
    }
  }>
}

interface PlaceSuggestion {
  id: string
  name: string
  point: LatLngLiteral
}

const tabs: TabItem[] = [
  { key: 'home', label: '홈' },
  { key: 'explore', label: '탐색' },
  { key: 'schedule', label: '일정' },
  { key: 'profile', label: '마이' },
]

const COURSE_NAMES = [
  '강변 스피드 루프',
  '도심-한강 연결 코스',
  '야간 템포 코스',
  '브릿지 인터벌 코스',
  '평지 지구력 코스',
  '리버사이드 회복 라이딩',
]

const ROUTE_STORAGE_KEY = 'bike-navi-ride-records'
const PROFILE_STORAGE_KEY = 'bike-navi-profile'

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function haversineDistanceKm(a: LatLngLiteral, b: LatLngLiteral): number {
  const toRad = (value: number) => (value * Math.PI) / 180
  const earthRadius = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * earthRadius * Math.asin(Math.sqrt(x))
}

function destinationPoint(
  origin: LatLngLiteral,
  distanceKm: number,
  bearingDeg: number,
): LatLngLiteral {
  const earthRadiusKm = 6371
  const bearing = (bearingDeg * Math.PI) / 180
  const lat1 = (origin.lat * Math.PI) / 180
  const lng1 = (origin.lng * Math.PI) / 180
  const angularDistance = distanceKm / earthRadiusKm

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  )
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    )

  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (lng2 * 180) / Math.PI,
  }
}

function getClimbLevel(elevationM: number): Exclude<ClimbLevel, 'any'> {
  if (elevationM <= 180) {
    return 'low'
  }
  if (elevationM <= 350) {
    return 'medium'
  }
  return 'high'
}

function readStoredRides(): RideRecord[] {
  const raw = localStorage.getItem(ROUTE_STORAGE_KEY)
  if (!raw) {
    return []
  }
  const parsed = JSON.parse(raw) as RideRecord[]
  return Array.isArray(parsed) ? parsed : []
}

function writeStoredRides(records: RideRecord[]): void {
  localStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify(records))
}

function readStoredProfile(): Profile {
  const raw = localStorage.getItem(PROFILE_STORAGE_KEY)
  if (!raw) {
    return { heightCm: 175, weightKg: 70, age: 29 }
  }
  const parsed = JSON.parse(raw) as Profile
  return {
    heightCm: parsed.heightCm ?? 175,
    weightKg: parsed.weightKg ?? 70,
    age: parsed.age ?? 29,
  }
}

function buildNearbyCourses(location: LatLngLiteral, rideRecords: RideRecord[]): Course[] {
  const recentRecords = rideRecords
    .filter((record) => Date.now() - new Date(record.endedAt).getTime() <= 1000 * 60 * 60 * 24 * 60)
    .slice(0, 12)
  const avgRecentDistance =
    recentRecords.length === 0
      ? 0
      : recentRecords.reduce((sum, ride) => sum + ride.distanceKm, 0) / recentRecords.length

  const defaultDistances = [10, 14, 20, 26, 32, 40, 48]
  const distances =
    recentRecords.length === 0
      ? defaultDistances
      : [
          avgRecentDistance * 0.75,
          avgRecentDistance * 0.9,
          avgRecentDistance,
          avgRecentDistance * 1.15,
          avgRecentDistance * 1.3,
          avgRecentDistance * 1.45,
          avgRecentDistance * 1.6,
        ].map((distance) => Number(Math.min(50, Math.max(10, distance)).toFixed(1)))
  const bearings = [20, 70, 125, 180, 230, 285, 330]
  const avgRecentSpeed =
    recentRecords.length === 0
      ? 20
      : recentRecords.reduce((sum, ride) => sum + ride.avgSpeedKmh, 0) / recentRecords.length

  return distances.map((distanceKm, index) => {
    const elevationFactor = avgRecentSpeed >= 23 ? 8.2 : avgRecentSpeed >= 19 ? 6.9 : 5.8
    const elevationM = Math.round(80 + distanceKm * (index % 2 === 0 ? elevationFactor : elevationFactor - 1.6))
    return {
      id: `nearby-${distanceKm}-${index}`,
      name: COURSE_NAMES[index % COURSE_NAMES.length],
      distanceKm,
      elevationM,
      etaMin: Math.round((distanceKm / 21) * 60),
      description:
        recentRecords.length === 0
          ? `현재 위치 기준 ${distanceKm}km 권장 코스`
          : `최근 라이딩(${recentRecords.length}건) 반영 ${distanceKm}km 권장 코스`,
      destination: destinationPoint(location, distanceKm, bearings[index]),
    }
  })
}

async function searchDestination(
  keyword: string,
  location: LatLngLiteral | null,
): Promise<LatLngLiteral | null> {
  const photonParams = new URLSearchParams({
    q: keyword,
    limit: '1',
    lang: 'ko',
  })

  if (location) {
    photonParams.set('lat', String(location.lat))
    photonParams.set('lon', String(location.lng))
  }

  try {
    const photonResponse = await fetch(`https://photon.komoot.io/api/?${photonParams.toString()}`)
    if (photonResponse.ok) {
      const photonPayload = (await photonResponse.json()) as PhotonSearchResponse
      const coordinates = photonPayload.features?.[0]?.geometry?.coordinates
      if (coordinates) {
        return {
          lat: Number(coordinates[1]),
          lng: Number(coordinates[0]),
        }
      }
    }
  } catch {
    // Photon 실패 시 Nominatim으로 폴백
  }

  const nominatimParams = new URLSearchParams({
    q: keyword,
    format: 'jsonv2',
    limit: '1',
    'accept-language': 'ko',
  })

  if (location) {
    const minLon = (location.lng - 0.25).toFixed(6)
    const maxLon = (location.lng + 0.25).toFixed(6)
    const minLat = (location.lat - 0.2).toFixed(6)
    const maxLat = (location.lat + 0.2).toFixed(6)
    nominatimParams.set('viewbox', `${minLon},${maxLat},${maxLon},${minLat}`)
    nominatimParams.set('bounded', '1')
  }

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${nominatimParams.toString()}`)
  if (!response.ok) {
    throw new Error('장소 검색 요청에 실패했습니다.')
  }

  const payload = (await response.json()) as PlaceSearchItem[]
  const top = payload[0]
  if (!top) {
    return null
  }
  return {
    lat: Number(top.lat),
    lng: Number(top.lon),
  }
}

function buildPhotonLabel(feature: NonNullable<PhotonSearchResponse['features']>[number]): string {
  const properties = feature.properties
  if (!properties) {
    return '검색 위치'
  }
  const parts = [
    properties.name,
    properties.street,
    properties.city,
    properties.district,
    properties.county,
    properties.state,
  ].filter((part): part is string => Boolean(part && part.trim()))
  return parts.length > 0 ? parts.join(' · ') : '검색 위치'
}

async function searchPlaceSuggestions(
  keyword: string,
  location: LatLngLiteral | null,
): Promise<PlaceSuggestion[]> {
  const normalized = keyword.trim()
  if (normalized.length < 2) {
    return []
  }

  const photonParams = new URLSearchParams({
    q: normalized,
    limit: '6',
    lang: 'ko',
  })

  if (location) {
    photonParams.set('lat', String(location.lat))
    photonParams.set('lon', String(location.lng))
  }

  try {
    const photonResponse = await fetch(`https://photon.komoot.io/api/?${photonParams.toString()}`)
    if (photonResponse.ok) {
      const photonPayload = (await photonResponse.json()) as PhotonSearchResponse
      const photonSuggestions = (photonPayload.features ?? [])
        .map((feature, index) => {
          const coords = feature.geometry?.coordinates
          if (!coords) {
            return null
          }
          return {
            id: `photon-${index}-${coords[0]}-${coords[1]}`,
            name: buildPhotonLabel(feature),
            point: { lat: Number(coords[1]), lng: Number(coords[0]) },
          } satisfies PlaceSuggestion
        })
        .filter((item): item is PlaceSuggestion => item !== null)
      if (photonSuggestions.length > 0) {
        return photonSuggestions
      }
    }
  } catch {
    // Photon 실패 시 Nominatim으로 폴백
  }

  const nominatimParams = new URLSearchParams({
    q: normalized,
    format: 'jsonv2',
    limit: '6',
    'accept-language': 'ko',
  })

  if (location) {
    const minLon = (location.lng - 0.25).toFixed(6)
    const maxLon = (location.lng + 0.25).toFixed(6)
    const minLat = (location.lat - 0.2).toFixed(6)
    const maxLat = (location.lat + 0.2).toFixed(6)
    nominatimParams.set('viewbox', `${minLon},${maxLat},${maxLon},${minLat}`)
    nominatimParams.set('bounded', '1')
  }

  const nominatimResponse = await fetch(
    `https://nominatim.openstreetmap.org/search?${nominatimParams.toString()}`,
  )
  if (!nominatimResponse.ok) {
    return []
  }

  const payload = (await nominatimResponse.json()) as PlaceSearchItem[]
  return payload
    .map((item, index) => ({
      id: `nominatim-${index}-${item.lon}-${item.lat}`,
      name: item.display_name ?? `${Number(item.lat).toFixed(5)}, ${Number(item.lon).toFixed(5)}`,
      point: {
        lat: Number(item.lat),
        lng: Number(item.lon),
      },
    }))
    .filter((item) => Number.isFinite(item.point.lat) && Number.isFinite(item.point.lng))
}

function MapClickPicker({
  enabled,
  onPick,
}: {
  enabled: boolean
  onPick: (point: LatLngLiteral) => void
}) {
  useMapEvents({
    click(event) {
      if (enabled) {
        onPick(event.latlng)
      }
    },
  })
  return null
}

function FollowMyLocation({
  center,
  active,
}: {
  center: LatLngLiteral | null
  active: boolean
}) {
  const map = useMap()

  useEffect(() => {
    if (center && active) {
      map.setView(center, 16, { animate: true })
    }
  }, [active, center, map])

  return null
}

function MapCenterOnTarget({
  center,
  zoom,
}: {
  center: LatLngLiteral | null
  zoom: number
}) {
  const map = useMap()

  useEffect(() => {
    if (center) {
      map.setView(center, zoom, { animate: true })
    }
  }, [center, map, zoom])

  return null
}

function getManeuverIcon(step?: NavigationStep): string {
  if (!step) {
    return '↑'
  }
  if (step.modifier === 'left' || step.modifier === 'slight left') {
    return '↖'
  }
  if (step.modifier === 'sharp left') {
    return '↰'
  }
  if (step.modifier === 'right' || step.modifier === 'slight right') {
    return '↗'
  }
  if (step.modifier === 'sharp right') {
    return '↱'
  }
  if (step.maneuverType === 'uturn') {
    return '⤴'
  }
  if (step.maneuverType === 'arrive') {
    return '🏁'
  }
  return '↑'
}

function maneuverToKorean(type: string, modifier?: string): string {
  const modifierText =
    modifier === 'left'
      ? '좌회전'
      : modifier === 'right'
        ? '우회전'
        : modifier === 'slight left'
          ? '좌측 방향'
          : modifier === 'slight right'
            ? '우측 방향'
            : modifier === 'sharp left'
              ? '급좌회전'
              : modifier === 'sharp right'
                ? '급우회전'
                : modifier === 'straight'
                  ? '직진'
                  : ''

  if (type === 'arrive') {
    return '목적지 도착'
  }
  if (type === 'depart') {
    return '출발'
  }
  if (type === 'roundabout') {
    return '로터리 진입'
  }
  if (type === 'end of road') {
    return '도로 끝'
  }
  if (type === 'new name') {
    return '도로 변경'
  }
  if (type === 'continue') {
    return modifierText.length > 0 ? modifierText : '계속 진행'
  }
  if (type === 'turn') {
    return modifierText.length > 0 ? modifierText : '방향 전환'
  }
  return modifierText.length > 0 ? modifierText : type
}

function formatDistanceKm(valueKm: number): string {
  if (valueKm < 1) {
    return `${Math.round(valueKm * 1000)}m`
  }
  return `${valueKm.toFixed(1)}km`
}

function buildPathCumulativeKm(path: LatLngLiteral[]): number[] {
  let cumulative = 0
  return path.map((point, index) => {
    if (index === 0) {
      return 0
    }
    cumulative += haversineDistanceKm(path[index - 1], point)
    return cumulative
  })
}

function getNearestPathState(
  path: LatLngLiteral[],
  pathCumulativeKm: number[],
  current: LatLngLiteral,
): { index: number; progressKm: number } {
  let nearestIndex = 0
  let nearestDistance = Number.POSITIVE_INFINITY

  for (let index = 0; index < path.length; index += 1) {
    const distance = haversineDistanceKm(current, path[index])
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = index
    }
  }

  return {
    index: nearestIndex,
    progressKm: pathCumulativeKm[nearestIndex] ?? 0,
  }
}

async function fetchBicycleRoute(points: LatLngLiteral[]): Promise<NavigationRoute> {
  const coordinates = points.map((point) => `${point.lng},${point.lat}`).join(';')
  const response = await fetch(
    `https://router.project-osrm.org/route/v1/bicycle/${coordinates}?overview=full&geometries=geojson&steps=true`,
  )

  if (!response.ok) {
    throw new Error('경로 서버 응답에 실패했습니다.')
  }

  const payload = (await response.json()) as {
    code: string
    routes?: Array<{
      distance: number
      duration: number
      geometry: { coordinates: [number, number][] }
      legs: Array<{
        steps: Array<{
          distance: number
          duration: number
          name: string
          maneuver: {
            type: string
            modifier?: string
            location: [number, number]
          }
        }>
      }>
    }>
  }

  if (payload.code !== 'Ok' || !payload.routes || payload.routes.length === 0) {
    throw new Error('요청한 조건으로 경로를 찾을 수 없습니다.')
  }

  const route = payload.routes[0]
  const steps: NavigationStep[] = route.legs.flatMap((leg) =>
    leg.steps.map((step) => {
      const maneuverText = maneuverToKorean(step.maneuver.type, step.maneuver.modifier)
      const name = step.name ? ` (${step.name})` : ''
      return {
        instruction: `${maneuverText}${name}`,
        distanceM: step.distance,
        durationS: step.duration,
        maneuverType: step.maneuver.type,
        modifier: step.maneuver.modifier,
        point: {
          lat: step.maneuver.location[1],
          lng: step.maneuver.location[0],
        },
      }
    }),
  )
  const path = route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }))
  const pathCumulativeKm = buildPathCumulativeKm(path)
  let stepCumulative = 0
  const stepCumulativeKm = steps.map((step) => {
    stepCumulative += step.distanceM / 1000
    return stepCumulative
  })

  return {
    path,
    pathCumulativeKm,
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
    steps,
    stepCumulativeKm,
  }
}

function getDistanceByPeriod(records: RideRecord[], period: 'week' | 'month' | 'year') {
  const now = new Date()
  const threshold = new Date(now)
  if (period === 'week') {
    threshold.setDate(now.getDate() - 7)
  } else if (period === 'month') {
    threshold.setMonth(now.getMonth() - 1)
  } else {
    threshold.setFullYear(now.getFullYear() - 1)
  }

  const total = records
    .filter((record) => new Date(record.endedAt) >= threshold)
    .reduce((sum, record) => sum + record.distanceKm, 0)
  return total
}

function App() {
  const [screenMode, setScreenMode] = useState<ScreenMode>('main')
  const [activeTab, setActiveTab] = useState<TabKey>('home')
  const [targetDistance, setTargetDistance] = useState<number>(20)
  const [climbFilter, setClimbFilter] = useState<ClimbLevel>('any')
  const [pickMode, setPickMode] = useState<PickMode>('destination')
  const [waypoints, setWaypoints] = useState<Waypoint[]>([])
  const [selectedDestination, setSelectedDestination] = useState<Course | null>(null)
  const [navigationRoute, setNavigationRoute] = useState<NavigationRoute | null>(null)
  const [isGuiding, setIsGuiding] = useState(false)
  const [isLoadingRoute, setIsLoadingRoute] = useState(false)
  const [routeError, setRouteError] = useState('')
  const [searchTriggered, setSearchTriggered] = useState(false)
  const [placeKeyword, setPlaceKeyword] = useState('')
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([])
  const [isSearchingPlace, setIsSearchingPlace] = useState(false)
  const [placeSearchMessage, setPlaceSearchMessage] = useState('')
  const [location, setLocation] = useState<LatLngLiteral | null>(null)
  const [locationError, setLocationError] = useState('')
  const [speedKmh, setSpeedKmh] = useState<number | null>(null)
  const [trackedDistanceKm, setTrackedDistanceKm] = useState(0)
  const [rideRecords, setRideRecords] = useState<RideRecord[]>([])
  const [profile, setProfile] = useState<Profile>({
    heightCm: 175,
    weightKg: 70,
    age: 29,
  })
  const [distancePeriod, setDistancePeriod] = useState<'week' | 'month' | 'year'>(
    'week',
  )

  const trackingRef = useRef<{
    startedAt: number
    previous: LatLngLiteral | null
    routeName: string
  } | null>(null)
  const speedSampleRef = useRef<{
    point: LatLngLiteral
    timestamp: number
    speedKmh: number | null
  } | null>(null)

  useEffect(() => {
    setRideRecords(readStoredRides())
    setProfile(readStoredProfile())
  }, [])

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setLocationError('이 기기에서는 위치 서비스를 지원하지 않습니다.')
      return
    }
    if (!window.isSecureContext) {
      setLocationError('HTTPS 환경에서만 GPS 위치를 정확히 받을 수 있습니다.')
      return
    }
    setLocationError('GPS 위치 수신 중...')

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const current = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }
        setLocation(current)
        setLocationError('')

        const gpsSpeedKmh =
          position.coords.speed === null || Number.isNaN(position.coords.speed)
            ? null
            : Math.max(0, position.coords.speed * 3.6)
        let estimatedSpeedKmh = gpsSpeedKmh
        const sample = speedSampleRef.current

        if (estimatedSpeedKmh === null && sample) {
          const elapsedSec = Math.max(0.001, (position.timestamp - sample.timestamp) / 1000)
          const movedDistanceM = haversineDistanceKm(sample.point, current) * 1000
          estimatedSpeedKmh = (movedDistanceM / elapsedSec) * 3.6
        }

        if (estimatedSpeedKmh !== null) {
          const filteredSpeed =
            sample?.speedKmh === null || sample?.speedKmh === undefined
              ? estimatedSpeedKmh
              : sample.speedKmh * 0.55 + estimatedSpeedKmh * 0.45
          const safeSpeed = Math.max(0, Math.min(filteredSpeed, 80))
          setSpeedKmh(safeSpeed)
          speedSampleRef.current = {
            point: current,
            timestamp: position.timestamp,
            speedKmh: safeSpeed,
          }
        } else {
          setSpeedKmh(null)
          speedSampleRef.current = {
            point: current,
            timestamp: position.timestamp,
            speedKmh: null,
          }
        }

        if (isGuiding && trackingRef.current) {
          const previous = trackingRef.current.previous
          if (previous) {
            const segment = haversineDistanceKm(previous, current)
            if (segment <= 0.2) {
              setTrackedDistanceKm((prev) => prev + segment)
            }
          }
          trackingRef.current.previous = current
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError('위치 권한이 필요합니다. 브라우저에서 위치를 허용해주세요.')
          return
        }
        setLocationError('현재 위치를 불러오지 못했습니다.')
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [isGuiding])

  useEffect(() => {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
  }, [profile])

  useEffect(() => {
    const keyword = placeKeyword.trim()
    if (keyword.length < 2) {
      setPlaceSuggestions([])
      return
    }

    let cancelled = false
    const timerId = window.setTimeout(() => {
      void (async () => {
        const suggestions = await searchPlaceSuggestions(keyword, location)
        if (!cancelled) {
          setPlaceSuggestions(suggestions)
        }
      })()
    }, 220)

    return () => {
      cancelled = true
      window.clearTimeout(timerId)
    }
  }, [location, placeKeyword])

  const nearbyCourses = useMemo(() => {
    if (!location) {
      return []
    }
    return buildNearbyCourses(location, rideRecords)
  }, [location, rideRecords])

  const recommendedCourses = useMemo(() => {
    if (nearbyCourses.length === 0) {
      return []
    }

    if (rideRecords.length === 0) {
      return nearbyCourses.filter((course) => course.distanceKm >= 10 && course.distanceKm <= 30)
    }

    const recentRides = rideRecords.slice(0, 10)
    const targetByHistory = recentRides.reduce((sum, ride) => sum + ride.distanceKm, 0) / recentRides.length

    return [...nearbyCourses]
      .sort(
        (a, b) =>
          Math.abs(a.distanceKm - targetByHistory) - Math.abs(b.distanceKm - targetByHistory),
      )
      .slice(0, 4)
  }, [nearbyCourses, rideRecords])

  const searchResults = useMemo(() => {
    if (!location) {
      return []
    }
    return nearbyCourses.filter((course) => {
      const distanceMatched = Math.abs(course.distanceKm - targetDistance) <= 10
      const climbMatched =
        climbFilter === 'any' || getClimbLevel(course.elevationM) === climbFilter
      return distanceMatched && climbMatched && course.distanceKm <= 50
    })
  }, [climbFilter, location, nearbyCourses, targetDistance])

  const periodDistance = useMemo(() => {
    return getDistanceByPeriod(rideRecords, distancePeriod)
  }, [distancePeriod, rideRecords])

  const mapCenter = location ?? { lat: 37.5665, lng: 126.978 }

  const routePoints = useMemo(() => {
    if (!location || !selectedDestination) {
      return []
    }
    return [location, ...waypoints.map((waypoint) => waypoint.point), selectedDestination.destination]
  }, [location, selectedDestination, waypoints])

  const currentPathState = useMemo(() => {
    if (!navigationRoute || !location) {
      return { index: 0, progressKm: trackedDistanceKm }
    }
    return getNearestPathState(navigationRoute.path, navigationRoute.pathCumulativeKm, location)
  }, [location, navigationRoute, trackedDistanceKm])

  const progressDistanceKm = useMemo(() => {
    if (!navigationRoute) {
      return trackedDistanceKm
    }
    return isGuiding
      ? Math.max(trackedDistanceKm, currentPathState.progressKm)
      : currentPathState.progressKm
  }, [currentPathState.progressKm, isGuiding, navigationRoute, trackedDistanceKm])

  const remainingDistanceKm = useMemo(() => {
    if (!navigationRoute) {
      return 0
    }
    return Math.max(0, navigationRoute.distanceKm - progressDistanceKm)
  }, [navigationRoute, progressDistanceKm])

  const currentStepIndex = useMemo(() => {
    if (!navigationRoute) {
      return 0
    }
    const foundIndex = navigationRoute.stepCumulativeKm.findIndex(
      (stepDistanceKm) => stepDistanceKm > progressDistanceKm + 0.03,
    )
    if (foundIndex === -1) {
      return Math.max(0, navigationRoute.steps.length - 1)
    }
    return foundIndex
  }, [navigationRoute, progressDistanceKm])

  const nextStep = navigationRoute?.steps[currentStepIndex]
  const nextStepDistanceKm = useMemo(() => {
    if (!navigationRoute || !nextStep) {
      return 0
    }
    const beforeStep = currentStepIndex === 0 ? 0 : navigationRoute.stepCumulativeKm[currentStepIndex - 1]
    const inStepProgress = Math.max(0, progressDistanceKm - beforeStep)
    const stepDistanceKm = nextStep.distanceM / 1000
    return Math.max(0, stepDistanceKm - inStepProgress)
  }, [currentStepIndex, navigationRoute, nextStep, progressDistanceKm])

  const traveledPath = useMemo(() => {
    if (!navigationRoute) {
      return []
    }
    return navigationRoute.path.slice(0, currentPathState.index + 1)
  }, [currentPathState.index, navigationRoute])

  const progressRate = useMemo(() => {
    if (!navigationRoute || navigationRoute.distanceKm <= 0) {
      return 0
    }
    return Math.min(1, progressDistanceKm / navigationRoute.distanceKm)
  }, [navigationRoute, progressDistanceKm])

  const estimatedRemainingMin = useMemo(() => {
    if (!navigationRoute) {
      return 0
    }
    if (speedKmh && speedKmh >= 5) {
      return (remainingDistanceKm / speedKmh) * 60
    }
    if (navigationRoute.distanceKm === 0) {
      return 0
    }
    return navigationRoute.durationMin * (remainingDistanceKm / navigationRoute.distanceKm)
  }, [navigationRoute, remainingDistanceKm, speedKmh])

  const handleMapPick = (point: LatLngLiteral) => {
    if (!location) {
      return
    }

    if (pickMode === 'waypoint') {
      setWaypoints((prev) => [
        ...prev,
        {
          id: `wpt-${Date.now()}-${prev.length}`,
          name: `경유지 ${prev.length + 1}`,
          point,
        },
      ])
      return
    }

    const distanceKm = Math.min(50, Math.max(10, haversineDistanceKm(location, point)))
    const course: Course = {
      id: `picked-${Date.now()}`,
      name: '지도 선택 코스',
      distanceKm: Number(distanceKm.toFixed(1)),
      elevationM: Math.round(120 + distanceKm * 6),
      etaMin: Math.round((distanceKm / 20) * 60),
      description: '지도에서 직접 선택한 목적지',
      destination: point,
    }
    setSelectedDestination(course)
    setRouteError('')
  }

  const buildRoute = async (course: Course): Promise<NavigationRoute | null> => {
    if (!location) {
      setRouteError('현재 위치를 먼저 확인해주세요.')
      return null
    }

    const points = [location, ...waypoints.map((waypoint) => waypoint.point), course.destination]
    setIsLoadingRoute(true)
    setRouteError('')
    try {
      const route = await fetchBicycleRoute(points)
      setNavigationRoute(route)
      return route
    } catch (error) {
      setNavigationRoute(null)
      if (error instanceof Error) {
        setRouteError(error.message)
      } else {
        setRouteError('경로 계산 중 오류가 발생했습니다.')
      }
      return null
    } finally {
      setIsLoadingRoute(false)
    }
  }

  const beginGuidance = (routeName: string, currentLocation: LatLngLiteral) => {
    trackingRef.current = {
      startedAt: Date.now(),
      previous: currentLocation,
      routeName,
    }
    setTrackedDistanceKm(0)
    setIsGuiding(true)
    setScreenMode('navigation')
  }

  const handleSelectCourse = async (course: Course, startImmediately = false) => {
    setSelectedDestination(course)
    setActiveTab('explore')
    const route = await buildRoute(course)
    if (startImmediately && route && location) {
      beginGuidance(course.name, location)
    }
  }

  const handleSearch = () => {
    setSearchTriggered(true)
    setPlaceSearchMessage('')
    setRouteError('')
    if (searchResults.length > 0) {
      setSelectedDestination(searchResults[0])
      void buildRoute(searchResults[0])
    } else {
      setRouteError('조건에 맞는 근처 코스가 없습니다. 목적지 검색을 사용해보세요.')
    }
  }

  const handlePlaceSearch = async () => {
    const keyword = placeKeyword.trim()
    if (!keyword) {
      setPlaceSearchMessage('검색어를 입력해주세요.')
      return
    }

    setIsSearchingPlace(true)
    setPlaceSearchMessage('')
    setRouteError('')
    try {
      const destination = await searchDestination(keyword, location)
      if (!destination) {
        setPlaceSearchMessage('검색 결과가 없습니다. 다른 키워드를 입력해주세요.')
        return
      }

      const distanceKm = location ? haversineDistanceKm(location, destination) : 10
      const searchedCourse: Course = {
        id: `searched-${Date.now()}`,
        name: keyword,
        distanceKm: Number(Math.max(1, distanceKm).toFixed(1)),
        elevationM: Math.round(110 + Math.max(1, distanceKm) * 6),
        etaMin: Math.round((Math.max(1, distanceKm) / 20) * 60),
        description: '장소 검색으로 선택한 목적지',
        destination,
      }
      setSelectedDestination(searchedCourse)
      await buildRoute(searchedCourse)
      setPlaceSuggestions([])
      setPlaceSearchMessage(`'${keyword}' 위치로 목적지를 설정했습니다.`)
    } catch (error) {
      if (error instanceof Error) {
        setPlaceSearchMessage(error.message)
      } else {
        setPlaceSearchMessage('검색 중 오류가 발생했습니다.')
      }
    } finally {
      setIsSearchingPlace(false)
    }
  }

  const handleSelectPlaceSuggestion = (suggestion: PlaceSuggestion) => {
    setPlaceKeyword(suggestion.name)
    setPlaceSuggestions([])
    setPlaceSearchMessage(`'${suggestion.name}' 선택됨`)
  }

  const handleStartGuidance = async () => {
    if (!selectedDestination) {
      setRouteError('안내할 코스를 먼저 선택해주세요.')
      return
    }

    const ensuredRoute = navigationRoute ?? (await buildRoute(selectedDestination))
    if (!ensuredRoute) {
      return
    }

    if (!location) {
      setRouteError('현재 위치를 확인한 뒤 안내를 시작할 수 있습니다.')
      return
    }

    beginGuidance(selectedDestination.name, location)
  }

  const handleStopGuidance = () => {
    if (!trackingRef.current) {
      setIsGuiding(false)
      return
    }

    const endedAt = Date.now()
    const durationMin = Math.max(1, (endedAt - trackingRef.current.startedAt) / 60000)
    const avgSpeedKmh = trackedDistanceKm / (durationMin / 60)
    const record: RideRecord = {
      id: `ride-${endedAt}`,
      routeName: trackingRef.current.routeName,
      startedAt: new Date(trackingRef.current.startedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      distanceKm: Number(trackedDistanceKm.toFixed(2)),
      durationMin: Number(durationMin.toFixed(1)),
      avgSpeedKmh: Number(avgSpeedKmh.toFixed(1)),
    }

    const nextRecords = [record, ...rideRecords]
    setRideRecords(nextRecords)
    writeStoredRides(nextRecords)
    trackingRef.current = null
    setIsGuiding(false)
    setScreenMode('main')
    setTrackedDistanceKm(0)
  }

  if (screenMode === 'navigation' && navigationRoute && selectedDestination) {
    return (
      <div className="nav-screen">
        <MapContainer center={mapCenter} zoom={16} className="nav-screen-map">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FollowMyLocation center={location} active={isGuiding} />
          {location && <CircleMarker center={location} radius={8} />}
          <Polyline positions={navigationRoute.path} pathOptions={{ color: '#2f80ed', weight: 8 }} />
          {traveledPath.length >= 2 && (
            <Polyline positions={traveledPath} pathOptions={{ color: '#22c55e', weight: 8 }} />
          )}
          <Marker position={selectedDestination.destination} />
          {waypoints.map((waypoint) => (
            <Marker key={waypoint.id} position={waypoint.point} />
          ))}
        </MapContainer>

        <div className="nav-top-bar">
          <button type="button" className="nav-ghost-btn" onClick={() => setScreenMode('main')}>
            탐색으로
          </button>
          <strong>자전거 내비게이션</strong>
        </div>

        <div className="nav-turn-card">
          <span className="nav-icon">{getManeuverIcon(nextStep)}</span>
          <div>
            <p>다음 안내</p>
            <strong>{nextStep?.instruction ?? '직진'}</strong>
            <p>{formatDistanceKm(nextStepDistanceKm)} 후</p>
          </div>
        </div>

        <div className="nav-bottom-sheet">
          <div className="nav-metrics">
            <div>
              <span>남은 거리</span>
              <strong>{formatDistanceKm(remainingDistanceKm)}</strong>
            </div>
            <div>
              <span>도착 예상</span>
              <strong>{Math.max(1, Math.round(estimatedRemainingMin))}분</strong>
            </div>
            <div>
              <span>현재 속도</span>
              <strong>{speedKmh === null ? '--' : `${speedKmh.toFixed(1)} km/h`}</strong>
            </div>
          </div>
          <div className="nav-progress">
            <div style={{ width: `${(progressRate * 100).toFixed(1)}%` }} />
          </div>
          <button type="button" className="primary-button stop" onClick={handleStopGuidance}>
            안내 종료 및 일정 저장
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="app-badge">Bicycle Navi</p>
          <h1>자전거 내비</h1>
        </div>
        <div className="speed-chip">
          현재 속도 <strong>{speedKmh === null ? '--' : `${speedKmh.toFixed(1)} km/h`}</strong>
        </div>
      </header>

      <main className="app-main">
        {activeTab === 'home' && (
          <>
            <section className="content-card">
              <h2>내 현재 위치 지도</h2>
              {locationError && <p className="error-text">{locationError}</p>}
              <div className="map-wrap">
                <MapContainer center={mapCenter} zoom={13} className="map-frame">
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapCenterOnTarget center={location} zoom={13} />
                  {location && <Marker position={location} />}
                  {navigationRoute && <Polyline positions={navigationRoute.path} />}
                </MapContainer>
              </div>
              <p className="meta">
                주행 거리(실시간): {isGuiding ? `${trackedDistanceKm.toFixed(2)} km` : '안내 시작 후 측정'}
              </p>
            </section>

            <section className="content-card">
              <h2>현재 위치 + 최근 주행 반영 추천 코스</h2>
              {rideRecords.length > 0 && (
                <p className="meta">최근 {Math.min(10, rideRecords.length)}건의 주행 거리 패턴을 반영했습니다.</p>
              )}
              <div className="list-grid">
                {recommendedCourses.map((course) => (
                  <article key={course.id} className="route-card">
                    <h3>{course.name}</h3>
                    <p>{course.description}</p>
                    <p className="meta">
                      거리 {course.distanceKm}km · 오르막 {course.elevationM}m · 예상 {course.etaMin}분
                    </p>
                    <button
                      type="button"
                      className="primary-button small"
                      onClick={() => void handleSelectCourse(course, true)}
                    >
                      이 코스로 라이딩 시작
                    </button>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        {activeTab === 'explore' && (
          <>
            <section className="content-card">
              <h2>탐색 필터</h2>
              <label className="field">
                원하는 거리 (10~50km)
                <input
                  type="number"
                  min={10}
                  max={50}
                  value={targetDistance}
                  onChange={(event) => setTargetDistance(Number(event.target.value))}
                />
              </label>
              <label className="field">
                오르막 강도
                <select
                  value={climbFilter}
                  onChange={(event) => setClimbFilter(event.target.value as ClimbLevel)}
                >
                  <option value="any">전체</option>
                  <option value="low">낮음</option>
                  <option value="medium">보통</option>
                  <option value="high">높음</option>
                </select>
              </label>
              <button type="button" className="primary-button" onClick={handleSearch}>
                내 위치 주변 코스 검색
              </button>
            </section>

            <section className="content-card">
              <h2>목적지 검색</h2>
              <div className="inline-row">
                <input
                  type="text"
                  value={placeKeyword}
                  placeholder="예: 광화문, 잠실종합운동장"
                  onChange={(event) => {
                    setPlaceKeyword(event.target.value)
                    setPlaceSearchMessage('')
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      if (placeSuggestions.length > 0) {
                        void handleSelectPlaceSuggestion(placeSuggestions[0])
                        return
                      }
                      void handlePlaceSearch()
                    }
                  }}
                />
                <button type="button" onClick={() => void handlePlaceSearch()} disabled={isSearchingPlace}>
                  {isSearchingPlace ? '검색 중' : '검색'}
                </button>
              </div>
              {placeSuggestions.length > 0 && (
                <div className="suggestion-list" role="listbox" aria-label="검색 자동완성">
                  {placeSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      className="suggestion-item"
                      onClick={() => void handleSelectPlaceSuggestion(suggestion)}
                    >
                      {suggestion.name}
                    </button>
                  ))}
                </div>
              )}
              {placeSearchMessage && <p className="meta">{placeSearchMessage}</p>}
            </section>

            <section className="content-card">
              <h2>지도에서 목적지/경유지 선택</h2>
              <div className="segmented">
                <button
                  type="button"
                  className={pickMode === 'destination' ? 'active' : undefined}
                  onClick={() => setPickMode('destination')}
                >
                  목적지 선택
                </button>
                <button
                  type="button"
                  className={pickMode === 'waypoint' ? 'active' : undefined}
                  onClick={() => setPickMode('waypoint')}
                >
                  경유지 추가
                </button>
                <button
                  type="button"
                  onClick={() => setWaypoints([])}
                >
                  경유지 초기화
                </button>
              </div>
              <p className="meta">지도 클릭으로 선택합니다.</p>
              <div className="map-wrap">
                <MapContainer center={mapCenter} zoom={13} className="map-frame">
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapCenterOnTarget center={selectedDestination?.destination ?? location} zoom={14} />
                  <MapClickPicker enabled={Boolean(location)} onPick={handleMapPick} />
                  {location && <Marker position={location} />}
                  {selectedDestination && <Marker position={selectedDestination.destination} />}
                  {waypoints.map((waypoint) => (
                    <Marker key={waypoint.id} position={waypoint.point} />
                  ))}
                  {navigationRoute && <Polyline positions={navigationRoute.path} />}
                </MapContainer>
              </div>
            </section>

            {searchTriggered && (
              <section className="content-card">
                <h2>검색 결과 (내 위치 주변)</h2>
                <div className="list-grid">
                  {searchResults.map((course) => (
                    <article
                      key={course.id}
                      className={`route-card ${selectedDestination?.id === course.id ? 'selected' : ''}`}
                    >
                      <h3>{course.name}</h3>
                      <p>{course.description}</p>
                      <p className="meta">
                        거리 {course.distanceKm}km · 오르막 {course.elevationM}m · 예상 {course.etaMin}분
                      </p>
                      <button
                        type="button"
                        className="primary-button small"
                        onClick={() => void handleSelectCourse(course)}
                      >
                        경로 보기
                      </button>
                    </article>
                  ))}
                  {searchResults.length === 0 && <p className="meta">조건에 맞는 근처 코스가 없습니다.</p>}
                </div>
              </section>
            )}

            {selectedDestination && (
              <section className="content-card">
                <h2>네비게이션</h2>
                <p className="meta">
                  목적지: {selectedDestination.name} ({selectedDestination.distanceKm}km)
                </p>
                {isLoadingRoute && <p className="meta">경로 계산 중...</p>}
                {routeError && <p className="error-text">{routeError}</p>}
                {navigationRoute && (
                  <>
                    <p className="meta">
                      안내 거리 {navigationRoute.distanceKm.toFixed(1)}km · 예상{' '}
                      {navigationRoute.durationMin.toFixed(0)}분
                    </p>
                    <ol className="step-list">
                      {navigationRoute.steps.slice(0, 8).map((step, index) => (
                        <li key={`${step.instruction}-${index}`}>
                          {step.instruction} ({Math.round(step.distanceM)}m)
                        </li>
                      ))}
                    </ol>
                  </>
                )}
                {!isGuiding && (
                  <button type="button" className="primary-button" onClick={() => void handleStartGuidance()}>
                    라이딩 시작
                  </button>
                )}
                {isGuiding && <p className="guide-status">안내 중입니다. 상단 탭에서 내비 화면으로 이동합니다.</p>}
                {routePoints.length > 0 && (
                  <p className="meta">
                    경유지 {waypoints.length}개 포함 경로입니다.
                  </p>
                )}
              </section>
            )}
          </>
        )}

        {activeTab === 'schedule' && (
          <section className="content-card">
            <h2>실제 주행 일정</h2>
            <div className="list-grid">
              {rideRecords.map((ride) => (
                <article key={ride.id} className="route-card">
                  <h3>{ride.routeName}</h3>
                  <p className="meta">
                    {new Date(ride.startedAt).toLocaleString('ko-KR')} 출발
                  </p>
                  <p className="meta">
                    거리 {ride.distanceKm.toFixed(2)}km · 소요 {ride.durationMin.toFixed(1)}분 · 평균 속도{' '}
                    {ride.avgSpeedKmh.toFixed(1)}km/h
                  </p>
                </article>
              ))}
              {rideRecords.length === 0 && (
                <p className="meta">아직 저장된 실제 주행 기록이 없습니다. 안내를 시작/종료하면 자동 저장됩니다.</p>
              )}
            </div>
          </section>
        )}

        {activeTab === 'profile' && (
          <>
            <section className="content-card">
              <h2>프로필 설정</h2>
              <label className="field">
                키 (cm)
                <input
                  type="number"
                  min={100}
                  max={240}
                  value={profile.heightCm}
                  onChange={(event) =>
                    setProfile((prev) => ({ ...prev, heightCm: Number(event.target.value) }))
                  }
                />
              </label>
              <label className="field">
                몸무게 (kg)
                <input
                  type="number"
                  min={30}
                  max={220}
                  value={profile.weightKg}
                  onChange={(event) =>
                    setProfile((prev) => ({ ...prev, weightKg: Number(event.target.value) }))
                  }
                />
              </label>
              <label className="field">
                나이
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={profile.age}
                  onChange={(event) =>
                    setProfile((prev) => ({ ...prev, age: Number(event.target.value) }))
                  }
                />
              </label>
            </section>

            <section className="content-card">
              <h2>실제 주행 거리 통계</h2>
              <div className="segmented">
                <button
                  type="button"
                  className={distancePeriod === 'week' ? 'active' : undefined}
                  onClick={() => setDistancePeriod('week')}
                >
                  주
                </button>
                <button
                  type="button"
                  className={distancePeriod === 'month' ? 'active' : undefined}
                  onClick={() => setDistancePeriod('month')}
                >
                  월
                </button>
                <button
                  type="button"
                  className={distancePeriod === 'year' ? 'active' : undefined}
                  onClick={() => setDistancePeriod('year')}
                >
                  년
                </button>
              </div>
              <p className="distance-value">{periodDistance.toFixed(2)} km</p>
            </section>
          </>
        )}
      </main>

      <nav className="tab-bar" aria-label="하단 탭">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={activeTab === tab.key ? 'active' : undefined}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

export default App
