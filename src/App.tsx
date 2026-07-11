import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L, { type LatLngLiteral } from 'leaflet'
import './App.css'

type TabKey = 'navigation' | 'records' | 'courses'

interface SearchPlace {
  id: string
  title: string
  subtitle: string
  point: LatLngLiteral
}

interface NavigationStep {
  instruction: string
  distanceM: number
  point: LatLngLiteral
  maneuverType: string
}

interface NavigationRoute {
  path: LatLngLiteral[]
  pathCumulativeKm: number[]
  steps: NavigationStep[]
  stepCumulativeKm: number[]
  distanceKm: number
  durationMin: number
  ascentM: number
}

interface RideRecord {
  id: string
  date: string
  distanceKm: number
  durationMin: number
  avgSpeedKmh: number
}

interface CourseItem {
  id: string
  name: string
  summary: string
  distanceKm: number
  climbM: number
  point: LatLngLiteral
}

const RECORDS_KEY = 'bike-unique-records-v1'

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function haversineDistanceKm(a: LatLngLiteral, b: LatLngLiteral): number {
  const toRad = (value: number) => (value * Math.PI) / 180
  const r = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(x))
}

function destinationPoint(origin: LatLngLiteral, distanceKm: number, bearingDeg: number): LatLngLiteral {
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
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI }
}

function normalizeAngle(angle: number): number {
  const normalized = angle % 360
  return normalized < 0 ? normalized + 360 : normalized
}

function getHeadingDegrees(from: LatLngLiteral, to: LatLngLiteral): number {
  const lat1 = (from.lat * Math.PI) / 180
  const lat2 = (to.lat * Math.PI) / 180
  const deltaLng = ((to.lng - from.lng) * Math.PI) / 180
  const y = Math.sin(deltaLng) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng)
  return normalizeAngle((Math.atan2(y, x) * 180) / Math.PI)
}

function smoothHeading(previous: number, target: number): number {
  const delta = ((((target - previous) % 360) + 540) % 360) - 180
  return normalizeAngle(previous + delta * 0.2)
}

function buildPathCumulativeKm(path: LatLngLiteral[]): number[] {
  let cumulative = 0
  return path.map((point, index) => {
    if (index === 0) return 0
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
  return { index: nearestIndex, progressKm: pathCumulativeKm[nearestIndex] ?? 0 }
}

function formatDistanceKm(distanceKm: number): string {
  return distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`
}

function maneuverToKorean(type: string, modifier?: string): string {
  const modifierText =
    modifier === 'left'
      ? '좌회전'
      : modifier === 'right'
        ? '우회전'
        : modifier === 'slight left'
          ? '좌측 진행'
          : modifier === 'slight right'
            ? '우측 진행'
            : modifier === 'straight'
              ? '직진'
              : ''
  if (type === 'arrive') return '목적지 도착'
  if (type === 'depart') return '출발'
  if (type === 'turn') return modifierText || '방향 전환'
  return modifierText || '직진'
}

function buildFallbackRoute(start: LatLngLiteral, end: LatLngLiteral): NavigationRoute {
  const count = 20
  const path = Array.from({ length: count + 1 }, (_, i) => ({
    lat: start.lat + ((end.lat - start.lat) * i) / count,
    lng: start.lng + ((end.lng - start.lng) * i) / count,
  }))
  const pathCumulativeKm = buildPathCumulativeKm(path)
  const distanceKm = pathCumulativeKm[pathCumulativeKm.length - 1] ?? 0
  const durationMin = Math.max(1, (distanceKm / 18) * 60)
  const steps: NavigationStep[] = [
    { instruction: '출발', distanceM: 0, point: start, maneuverType: 'depart' },
    {
      instruction: '직진 후 목적지 접근',
      distanceM: distanceKm * 0.7 * 1000,
      point: path[Math.floor(path.length * 0.7)],
      maneuverType: 'continue',
    },
    { instruction: '목적지 도착', distanceM: distanceKm * 0.3 * 1000, point: end, maneuverType: 'arrive' },
  ]
  let cumulative = 0
  const stepCumulativeKm = steps.map((step) => {
    cumulative += step.distanceM / 1000
    return cumulative
  })
  return {
    path,
    pathCumulativeKm,
    steps,
    stepCumulativeKm,
    distanceKm,
    durationMin,
    ascentM: Math.round(distanceKm * 8),
  }
}

async function fetchBicycleRoute(start: LatLngLiteral, end: LatLngLiteral): Promise<NavigationRoute> {
  const coordinates = `${start.lng},${start.lat};${end.lng},${end.lat}`
  const urls = [
    `https://router.project-osrm.org/route/v1/bicycle/${coordinates}?overview=full&geometries=geojson&steps=true&exclude=motorway,toll,ferry`,
    `https://router.project-osrm.org/route/v1/bicycle/${coordinates}?overview=full&geometries=geojson&steps=true`,
  ]

  for (const url of urls) {
    try {
      const response = await fetch(url)
      if (!response.ok) continue
      const payload = (await response.json()) as {
        code: string
        routes?: Array<{
          distance: number
          duration: number
          geometry: { coordinates: [number, number][] }
          legs: Array<{
            steps: Array<{
              distance: number
              name: string
              maneuver: { type: string; modifier?: string; location: [number, number] }
            }>
          }>
        }>
      }
      if (payload.code !== 'Ok' || !payload.routes || payload.routes.length === 0) continue
      const selected = payload.routes[0]
      const path = selected.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }))
      const pathCumulativeKm = buildPathCumulativeKm(path)
      const steps: NavigationStep[] = selected.legs.flatMap((leg) =>
        leg.steps
          .filter((step) => !/stair|계단/i.test(step.name))
          .map((step) => ({
            instruction: `${maneuverToKorean(step.maneuver.type, step.maneuver.modifier)}${
              step.name ? ` (${step.name})` : ''
            }`,
            distanceM: step.distance,
            point: { lat: step.maneuver.location[1], lng: step.maneuver.location[0] },
            maneuverType: step.maneuver.type,
          })),
      )
      let cumulative = 0
      const stepCumulativeKm = steps.map((step) => {
        cumulative += step.distanceM / 1000
        return cumulative
      })
      return {
        path,
        pathCumulativeKm,
        steps,
        stepCumulativeKm,
        distanceKm: selected.distance / 1000,
        durationMin: selected.duration / 60,
        ascentM: Math.round((selected.distance / 1000) * 12),
      }
    } catch {
      continue
    }
  }

  return buildFallbackRoute(start, end)
}

async function fetchPlaceSearch(query: string): Promise<SearchPlace[]> {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=kr&limit=8&q=${encodeURIComponent(
      query,
    )}`,
  )
  if (!response.ok) return []
  const payload = (await response.json()) as Array<{
    place_id: number
    display_name: string
    lat: string
    lon: string
  }>
  return payload.map((item) => ({
    id: String(item.place_id),
    title: item.display_name.split(',')[0] || '검색 결과',
    subtitle: item.display_name,
    point: { lat: Number(item.lat), lng: Number(item.lon) },
  }))
}

function CameraFollower({
  center,
  zoom,
  active,
}: {
  center: LatLngLiteral | null
  zoom: number
  active: boolean
}) {
  const map = useMap()
  useEffect(() => {
    if (active && center) map.setView(center, zoom, { animate: true, duration: 0.7 })
  }, [active, center, map, zoom])
  return null
}

function MapInteraction({
  onInteract,
  onZoomChange,
}: {
  onInteract: () => void
  onZoomChange: (zoom: number) => void
}) {
  const map = useMapEvents({
    mousedown: onInteract,
    dragstart: onInteract,
    zoomstart: onInteract,
    moveend: onInteract,
    zoomend() {
      onInteract()
      onZoomChange(map.getZoom())
    },
  })
  return null
}

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('navigation')
  const [location, setLocation] = useState<LatLngLiteral | null>(null)
  const [locationError, setLocationError] = useState('')
  const [headingDeg, setHeadingDeg] = useState(0)
  const [speedKmh, setSpeedKmh] = useState(0)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchPlace[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState<SearchPlace | null>(null)

  const [route, setRoute] = useState<NavigationRoute | null>(null)
  const [routeError, setRouteError] = useState('')
  const [isRouting, setIsRouting] = useState(false)
  const [isRiding, setIsRiding] = useState(false)
  const [trackedDistanceKm, setTrackedDistanceKm] = useState(0)
  const [currentTimeLabel, setCurrentTimeLabel] = useState(() =>
    new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
  )

  const [records, setRecords] = useState<RideRecord[]>([])

  const [radiusKm, setRadiusKm] = useState(7)
  const [courses, setCourses] = useState<CourseItem[]>([])

  const [mapInteracting, setMapInteracting] = useState(false)
  const [manualZoom, setManualZoom] = useState<number | null>(null)
  const [frozenRotation, setFrozenRotation] = useState(0)

  const interactionTimeoutRef = useRef<number | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const rideStateRef = useRef<{
    previous: LatLngLiteral | null
    startedAt: number
    smoothedSpeed: number
    lastTimestamp: number
  } | null>(null)
  const spokenGuideKeyRef = useRef('')

  const mapCenter = location ?? { lat: 37.5665, lng: 126.978 }

  const refreshLocationOnce = async () => {
    if (!('geolocation' in navigator)) {
      setLocationError('이 기기에서는 위치 서비스를 지원하지 않습니다.')
      return
    }
    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
          setLocationError('')
          resolve()
        },
        () => {
          setLocationError('현재 위치를 불러오지 못했습니다.')
          resolve()
        },
        {
          enableHighAccuracy: true,
          timeout: 3000,
          maximumAge: 1000,
        },
      )
    })
  }

  useEffect(() => {
    const raw = localStorage.getItem(RECORDS_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as RideRecord[]
    if (Array.isArray(parsed)) setRecords(parsed)
  }, [])

  useEffect(() => {
    if (activeTab === 'navigation' || activeTab === 'courses') {
      void refreshLocationOnce()
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'courses') {
      void regenerateCourses()
    }
  }, [activeTab])

  useEffect(() => {
    if (!isRiding) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      const sentinel = wakeLockRef.current
      wakeLockRef.current = null
      if (sentinel) void sentinel.release()
      return
    }

    if ('geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const current = { lat: position.coords.latitude, lng: position.coords.longitude }
          setLocation(current)
          const measuredSpeed =
            position.coords.speed === null ? null : Math.max(0, position.coords.speed * 3.6)

          const prev = rideStateRef.current
          if (!prev) {
            const initial = measuredSpeed ?? 0
            setSpeedKmh(initial)
            rideStateRef.current = {
              previous: current,
              startedAt: Date.now(),
              smoothedSpeed: initial,
              lastTimestamp: position.timestamp,
            }
            return
          }

          const movedKm = prev.previous ? haversineDistanceKm(prev.previous, current) : 0
          const elapsedHours = Math.max((position.timestamp - prev.lastTimestamp) / 3600000, 1 / 3600000)
          const accuracyKm = (position.coords.accuracy ?? 50) / 1000
          const effectiveMovedKm =
            movedKm <= Math.max(0.005, accuracyKm * 0.85) ? 0 : movedKm - accuracyKm * 0.55
          const fallbackKmh = effectiveMovedKm / elapsedHours
          const sourceSpeed = measuredSpeed ?? fallbackKmh
          const stationary = effectiveMovedKm < 0.0035 && sourceSpeed < 9
          const boundedSpeed = Math.min(60, stationary ? 0 : sourceSpeed)
          const smoothedSpeed = prev.smoothedSpeed * 0.84 + boundedSpeed * 0.16
          const nextSpeed = smoothedSpeed < 1.4 ? 0 : smoothedSpeed
          setSpeedKmh(nextSpeed)

          if (prev.previous) {
            const segment = haversineDistanceKm(prev.previous, current)
            if (segment <= 0.2) setTrackedDistanceKm((value) => value + segment)
            if (segment >= 0.008) {
              const nextHeading = getHeadingDegrees(prev.previous, current)
              setHeadingDeg((value) => smoothHeading(value, nextHeading))
            }
          }

          rideStateRef.current = {
            previous: current,
            startedAt: prev.startedAt,
            smoothedSpeed: nextSpeed,
            lastTimestamp: position.timestamp,
          }
        },
        () => {
          setLocationError('주행 중 위치를 가져오지 못했습니다.')
        },
        {
          enableHighAccuracy: true,
          timeout: 3000,
          maximumAge: 1000,
        },
      )
    }

    const wakeLockApi = (navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> }
    }).wakeLock
    if (wakeLockApi?.request) {
      void wakeLockApi
        .request('screen')
        .then((sentinel) => {
          wakeLockRef.current = sentinel
        })
        .catch(() => {
          wakeLockRef.current = null
        })
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      const sentinel = wakeLockRef.current
      wakeLockRef.current = null
      if (sentinel) void sentinel.release()
    }
  }, [isRiding])

  useEffect(() => {
    if (!isRiding) {
      setCurrentTimeLabel(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }))
      return
    }
    const intervalId = window.setInterval(() => {
      setCurrentTimeLabel(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }))
    }, 30000)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [isRiding])

  useEffect(() => {
    return () => {
      if (interactionTimeoutRef.current !== null) window.clearTimeout(interactionTimeoutRef.current)
    }
  }, [])

  const currentPathState = useMemo(() => {
    if (!route || !location) return { index: 0, progressKm: trackedDistanceKm }
    return getNearestPathState(route.path, route.pathCumulativeKm, location)
  }, [location, route, trackedDistanceKm])

  const progressDistanceKm = useMemo(() => {
    if (!route) return trackedDistanceKm
    return isRiding ? Math.max(trackedDistanceKm, currentPathState.progressKm) : currentPathState.progressKm
  }, [currentPathState.progressKm, isRiding, route, trackedDistanceKm])

  const remainingDistanceKm = useMemo(() => {
    if (!route) return 0
    return Math.max(0, route.distanceKm - progressDistanceKm)
  }, [progressDistanceKm, route])

  const currentStepIndex = useMemo(() => {
    if (!route) return 0
    const found = route.stepCumulativeKm.findIndex((distance) => distance > progressDistanceKm + 0.03)
    return found === -1 ? Math.max(0, route.steps.length - 1) : found
  }, [progressDistanceKm, route])

  const nextStep = route?.steps[currentStepIndex]
  const nextStepDistanceKm = useMemo(() => {
    if (!route || !nextStep) return 0
    const before = currentStepIndex === 0 ? 0 : route.stepCumulativeKm[currentStepIndex - 1]
    const inStep = Math.max(0, progressDistanceKm - before)
    return Math.max(0, nextStep.distanceM / 1000 - inStep)
  }, [currentStepIndex, nextStep, progressDistanceKm, route])

  const remainingMin = useMemo(() => {
    if (!route) return 0
    if (speedKmh >= 5) return (remainingDistanceKm / speedKmh) * 60
    return route.durationMin * (remainingDistanceKm / Math.max(route.distanceKm, 0.001))
  }, [remainingDistanceKm, route, speedKmh])

  const arrivalLabel = useMemo(() => {
    const minutes = Math.max(1, Math.round(remainingMin))
    return new Date(Date.now() + minutes * 60000).toLocaleTimeString('ko-KR', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }, [remainingMin])

  const gradientPercent = useMemo(() => {
    if (!route) return 0
    return Number(Math.min(12, Math.max(-8, (route.ascentM / Math.max(route.distanceKm, 1)) / 10)).toFixed(1))
  }, [route])

  const navZoom = useMemo(() => {
    let zoom = 16.8
    if (speedKmh >= 30) zoom = 15.9
    else if (speedKmh >= 22) zoom = 16.2
    else if (speedKmh >= 14) zoom = 16.5
    if (nextStepDistanceKm <= 0.12) zoom += 0.3
    return Math.max(15.6, Math.min(17.6, zoom))
  }, [nextStepDistanceKm, speedKmh])

  const effectiveZoom = mapInteracting ? manualZoom ?? navZoom : navZoom
  const cameraTarget = useMemo(() => {
    if (!location) return null
    return destinationPoint(location, 0.08, headingDeg)
  }, [headingDeg, location])
  const mapRotation = useMemo(() => {
    if (!isRiding) return 0
    return mapInteracting ? frozenRotation : -headingDeg
  }, [frozenRotation, headingDeg, isRiding, mapInteracting])

  const markInteraction = () => {
    if (!isRiding) return
    if (!mapInteracting) {
      setFrozenRotation(-headingDeg)
      setMapInteracting(true)
    }
    if (interactionTimeoutRef.current !== null) window.clearTimeout(interactionTimeoutRef.current)
    interactionTimeoutRef.current = window.setTimeout(() => {
      setMapInteracting(false)
      setManualZoom(null)
    }, 5000)
  }

  const speakKorean = (message: string) => {
    if (!('speechSynthesis' in window)) return
    const utterance = new SpeechSynthesisUtterance(message)
    utterance.lang = 'ko-KR'
    utterance.rate = 1
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }

  useEffect(() => {
    if (!isRiding || !nextStep) return
    const nearTurnM = Math.round(nextStepDistanceKm * 1000)
    if (nearTurnM > 80) return
    const speakKey = `${currentStepIndex}-${Math.floor(nearTurnM / 20)}`
    if (spokenGuideKeyRef.current === speakKey) return
    spokenGuideKeyRef.current = speakKey
    speakKorean(`${Math.max(10, nearTurnM)}미터 앞, ${nextStep.instruction}`)
  }, [currentStepIndex, isRiding, nextStep, nextStepDistanceKm])

  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) return
    setIsSearching(true)
    const results = await fetchPlaceSearch(searchQuery.trim())
    setSearchResults(results)
    setIsSearching(false)
  }

  const handleSelectPlace = async (place: SearchPlace) => {
    if (!location) {
      await refreshLocationOnce()
    }
    const currentLocation = location ?? mapCenter
    setIsRouting(true)
    setRouteError('')
    try {
      const built = await fetchBicycleRoute(currentLocation, place.point)
      setRoute(built)
      setSelectedPlace(place)
      setSearchResults([])
    } catch (error) {
      setRoute(null)
      setRouteError(error instanceof Error ? error.message : '경로 계산 중 오류가 발생했습니다.')
    } finally {
      setIsRouting(false)
    }
  }

  const startRide = async () => {
    if (!route) {
      setRouteError('먼저 목적지와 경로를 선택해주세요.')
      return
    }
    await refreshLocationOnce()
    rideStateRef.current = {
      previous: location,
      startedAt: Date.now(),
      smoothedSpeed: speedKmh,
      lastTimestamp: Date.now(),
    }
    setTrackedDistanceKm(0)
    setMapInteracting(false)
    setManualZoom(null)
    setFrozenRotation(0)
    spokenGuideKeyRef.current = ''
    setIsRiding(true)
    speakKorean('주행을 시작합니다.')
  }

  const stopRide = () => {
    const startedAt = rideStateRef.current?.startedAt ?? Date.now()
    const durationMin = Math.max(1, (Date.now() - startedAt) / 60000)
    const avgSpeedKmh = trackedDistanceKm / (durationMin / 60)
    const record: RideRecord = {
      id: `ride-${Date.now()}`,
      date: new Date().toISOString(),
      distanceKm: Number(trackedDistanceKm.toFixed(2)),
      durationMin: Number(durationMin.toFixed(1)),
      avgSpeedKmh: Number(avgSpeedKmh.toFixed(1)),
    }
    const nextRecords = [record, ...records].slice(0, 100)
    setRecords(nextRecords)
    localStorage.setItem(RECORDS_KEY, JSON.stringify(nextRecords))
    setIsRiding(false)
    setTrackedDistanceKm(0)
    speakKorean('주행을 종료하고 기록을 저장했습니다.')
  }

  const regenerateCourses = async () => {
    if (!location) await refreshLocationOnce()
    const baseLocation = location ?? mapCenter
    const base: Array<Omit<CourseItem, 'id' | 'point'>> = [
      { name: '리버 루프', summary: '평지 중심 지구력 코스', distanceKm: 18, climbM: 110 },
      { name: '힐 클라임 세션', summary: '짧고 강한 업힐 구간', distanceKm: 14, climbM: 340 },
      { name: '시티 템포', summary: '도심 템포 유지 코스', distanceKm: 22, climbM: 190 },
      { name: '야간 순환 코스', summary: '저강도 야간 라이딩', distanceKm: 12, climbM: 70 },
      { name: '브릿지 인터벌', summary: '상하 반복 훈련 코스', distanceKm: 20, climbM: 260 },
    ]
    const shuffled = [...base]
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    const nextCourses = shuffled.map((item, index) => ({
      id: `${item.name}-${Date.now()}-${index}`,
      ...item,
      point: destinationPoint(
        baseLocation,
        Math.max(2, Math.min(radiusKm, item.distanceKm * 0.45)),
        30 + index * 60 + Math.floor(Math.random() * 30),
      ),
    }))
    setCourses(nextCourses)
  }

  const selectCourseAsDestination = async (course: CourseItem) => {
    const place: SearchPlace = {
      id: course.id,
      title: course.name,
      subtitle: course.summary,
      point: course.point,
    }
    setActiveTab('navigation')
    setSearchQuery(course.name)
    await handleSelectPlace(place)
  }

  const navigationPanel = (
    <>
      <section className="top-panel glass">
        <div className="search-row">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="목적지 검색"
          />
          <button type="button" onClick={() => void handleSearch()}>
            검색
          </button>
        </div>
        {isSearching && <p className="muted">검색 중...</p>}
        {searchResults.length > 0 && (
          <div className="search-results">
            {searchResults.map((place) => (
              <button key={place.id} type="button" className="search-item" onClick={() => void handleSelectPlace(place)}>
                <strong>{place.title}</strong>
                <span>{place.subtitle}</span>
              </button>
            ))}
          </div>
        )}
        {routeError && <p className="error">{routeError}</p>}
      </section>

      {!isRiding && (
        <section className="bottom-panel glass">
          <div className="metrics">
            <div>
              <span>총 거리</span>
              <strong>{route ? `${route.distanceKm.toFixed(1)}km` : '--'}</strong>
            </div>
            <div>
              <span>예상 시간</span>
              <strong>{route ? `${route.durationMin.toFixed(0)}분` : '--'}</strong>
            </div>
            <div>
              <span>누적 상승</span>
              <strong>{route ? `${route.ascentM}m` : '--'}</strong>
            </div>
            <div>
              <span>도착 예정</span>
              <strong>{arrivalLabel}</strong>
            </div>
          </div>
          <p className="summary-text">
            {selectedPlace ? `${selectedPlace.title} · ${selectedPlace.subtitle}` : '목적지를 검색해 경로를 준비하세요.'}
          </p>
          <div className="action-row">
            <button type="button" className="primary" onClick={() => void startRide()} disabled={!route || isRouting}>
              주행 시작
            </button>
            {isRouting && <span className="muted">경로 계산 중...</span>}
          </div>
          {locationError && <p className="error">{locationError}</p>}
        </section>
      )}

      {isRiding && (
        <section className="mini-dashboard glass">
          <div className="mini-grid">
            <div>
              <span>속도</span>
              <strong>{speedKmh.toFixed(1)}</strong>
              <small>km/h</small>
            </div>
            <div>
              <span>현재 시간</span>
              <strong>{currentTimeLabel}</strong>
              <small>HH:MM</small>
            </div>
            <div>
              <span>경사</span>
              <strong>{gradientPercent.toFixed(1)}</strong>
              <small>%</small>
            </div>
            <div>
              <span>남은 거리</span>
              <strong>{formatDistanceKm(remainingDistanceKm)}</strong>
              <small>{Math.max(1, Math.round(remainingMin))}분</small>
            </div>
          </div>
          <div className="mini-bottom">
            <span>{nextStep ? `${formatDistanceKm(nextStepDistanceKm)} 앞 ${nextStep.instruction}` : '안내 대기 중'}</span>
            <button type="button" className="danger" onClick={stopRide}>
              종료
            </button>
          </div>
        </section>
      )}
    </>
  )

  const recordsPanel = (
    <section className="page-panel glass">
      <h3>라이딩 기록</h3>
      <div className="record-list">
        {records.map((record) => (
          <article key={record.id} className="record-item">
            <p>{new Date(record.date).toLocaleString('ko-KR')}</p>
            <p>
              거리 {record.distanceKm.toFixed(2)}km · 시간 {record.durationMin.toFixed(1)}분 · 평균{' '}
              {record.avgSpeedKmh.toFixed(1)}km/h
            </p>
          </article>
        ))}
        {records.length === 0 && <p className="muted">저장된 기록이 없습니다.</p>}
      </div>
    </section>
  )

  const coursesPanel = (
    <section className="page-panel glass">
      <h3>주변 코스 추천</h3>
      <div className="filter-row">
        <label>
          거리 {radiusKm}km
          <input type="range" min={5} max={10} value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))} />
        </label>
        <button type="button" className="primary" onClick={() => void regenerateCourses()}>
          새로고침
        </button>
      </div>
      <div className="course-list">
        {courses.map((course) => (
          <article key={course.id} onClick={() => void selectCourseAsDestination(course)}>
            <h4>{course.name}</h4>
            <p>
              {course.summary} · {course.distanceKm}km · 상승 {course.climbM}m
            </p>
          </article>
        ))}
        {courses.length === 0 && <p className="muted">탭 진입 또는 새로고침 시 코스를 생성합니다.</p>}
      </div>
    </section>
  )

  return (
    <div className="app-root">
      <div className={`map-wrap ${mapInteracting ? 'touching' : ''}`} style={{ '--map-rotation': `${mapRotation.toFixed(2)}deg` } as CSSProperties}>
        <MapContainer
          center={mapCenter}
          zoom={15.8}
          className="map"
          zoomControl={false}
          attributionControl={false}
          dragging
          doubleClickZoom
          touchZoom
          scrollWheelZoom
          keyboard={false}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
          />
          <CameraFollower center={cameraTarget} zoom={effectiveZoom} active={isRiding && !mapInteracting} />
          <MapInteraction onInteract={markInteraction} onZoomChange={setManualZoom} />
          {route && <Polyline positions={route.path} pathOptions={{ color: '#1d4ed8', weight: 7 }} />}
          {location && (
            <CircleMarker
              center={location}
              radius={7}
              pathOptions={{ color: '#1d4ed8', fillColor: '#60a5fa', fillOpacity: 0.95 }}
            />
          )}
          {selectedPlace && <Marker position={selectedPlace.point} />}
          {activeTab === 'courses' &&
            courses.map((course) => (
              <CircleMarker
                key={course.id}
                center={course.point}
                radius={5}
                pathOptions={{ color: '#0f766e', fillColor: '#14b8a6', fillOpacity: 0.9 }}
              />
            ))}
        </MapContainer>
      </div>

      <div className="vignette" />

      {activeTab === 'navigation' && navigationPanel}
      {activeTab === 'records' && recordsPanel}
      {activeTab === 'courses' && coursesPanel}

      <nav className="tab-bar">
        <button type="button" className={activeTab === 'navigation' ? 'active' : undefined} onClick={() => setActiveTab('navigation')}>
          내비
        </button>
        <button type="button" className={activeTab === 'records' ? 'active' : undefined} onClick={() => setActiveTab('records')}>
          기록
        </button>
        <button type="button" className={activeTab === 'courses' ? 'active' : undefined} onClick={() => setActiveTab('courses')}>
          코스
        </button>
      </nav>
    </div>
  )
}

export default App
