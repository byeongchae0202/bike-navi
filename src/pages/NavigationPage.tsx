import { useCallback, useMemo, useState } from 'react'
import { ElevationProfileChart } from '../components/ElevationProfileChart'
import { KakaoMapCanvas } from '../components/KakaoMapCanvas'
import { NavigationOverlay } from '../components/NavigationOverlay'
import { NearbyCoursePanel } from '../components/NearbyCoursePanel'
import { RouteInfoPanel } from '../components/RouteInfoPanel'
import { useBicycleRoute } from '../hooks/useBicycleRoute'
import { useNearbyCourses } from '../hooks/useNearbyCourses'
import { useNavigationStore } from '../store/useNavigationStore'
import { useRideMetrics } from '../store/RideMetricsProvider'
import type { LatLng, Place } from '../types/geo'
import { formatDuration } from '../utils/format'

const SEOUL_CITY_HALL: LatLng = { lat: 37.5665, lng: 126.978 }

function buildSearchSummary(origin: Place | null, destination: Place | null, waypointCount: number) {
  if (!origin && !destination) {
    return '출발지 · 목적지를 설정하세요'
  }
  const routeLabel = `${origin?.name ?? '출발지'} → ${destination?.name ?? '목적지'}`
  return waypointCount > 0 ? `${routeLabel} · 경유 ${waypointCount}` : routeLabel
}

export function NavigationPage() {
  const [radius, setRadius] = useState<5 | 10>(5)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const { metrics, isRideStarted, startRide } = useRideMetrics()
  const {
    origin,
    destination,
    waypoints,
    activePath,
    activeSummary,
    setRoute,
    setPathOnly,
    clearRoute,
    setOrigin,
    setDestination,
    addWaypoint,
  } = useNavigationStore()
  const bicycleRoute = useBicycleRoute()

  const center = metrics.currentPosition ?? origin?.location ?? destination?.location ?? SEOUL_CITY_HALL
  const markerPoints = useMemo(
    () => [
      ...(origin ? [origin.location] : []),
      ...waypoints.map((point) => point.location),
      ...(destination ? [destination.location] : []),
    ],
    [destination, origin, waypoints],
  )
  const searchSummary = useMemo(
    () => buildSearchSummary(origin, destination, waypoints.length),
    [destination, origin, waypoints.length],
  )

  const { data: nearbyCourses = [] } = useNearbyCourses(center, radius)

  const requestRouteWith = useCallback(
    (nextOrigin: Place | null, nextDestination: Place | null, nextWaypoints: Place[]) => {
      if (!nextOrigin || !nextDestination) {
        return
      }
      bicycleRoute.mutate(
        {
          origin: nextOrigin.location,
          destination: nextDestination.location,
          waypoints: nextWaypoints.map((point) => point.location),
        },
        {
          onSuccess: (result) => {
            setRoute(result.path, result.summary)
          },
        },
      )
    },
    [bicycleRoute, setRoute],
  )

  const requestRoute = () => {
    if (!origin || !destination) {
      alert('출발지와 목적지를 선택해 주세요.')
      return
    }
    requestRouteWith(origin, destination, waypoints)
  }

  const handleMapSelection = useCallback(
    (action: 'origin' | 'waypoint' | 'destination', place: Place) => {
      const nextOrigin = action === 'origin' ? place : origin
      const nextDestination = action === 'destination' ? place : destination
      const nextWaypoints =
        action === 'waypoint'
          ? waypoints.length < 5
            ? [...waypoints, place]
            : waypoints
          : waypoints

      if (action === 'origin') {
        setOrigin(place)
      } else if (action === 'destination') {
        setDestination(place)
      } else if (waypoints.length < 5) {
        addWaypoint(place)
      }

      requestRouteWith(nextOrigin, nextDestination, nextWaypoints)
    },
    [addWaypoint, destination, origin, requestRouteWith, setDestination, setOrigin, waypoints],
  )

  return (
    <section className="relative h-screen w-full overflow-hidden">
      <div className="absolute inset-0 z-0 h-full w-full">
        <KakaoMapCanvas
          center={center}
          markers={markerPoints}
          routePath={activePath}
          onMapSelection={handleMapSelection}
        />
      </div>

      {!isRideStarted && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-4 pt-4">
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="pointer-events-auto flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-xl"
          >
            <div className="h-8 w-8 rounded-full bg-slate-900 text-center text-lg leading-8 text-white">⌕</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{searchSummary}</p>
              <p className="text-xs text-slate-500">출발지/경유지/목적지 검색</p>
            </div>
          </button>
        </div>
      )}

      <NavigationOverlay
        open={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        loading={bicycleRoute.isPending}
        onRouteRequest={requestRoute}
      />

      <div className="absolute bottom-0 left-0 right-0 z-20">
        <div
          className={`rounded-t-3xl px-4 pb-6 pt-3 shadow-2xl backdrop-blur transition-all duration-300 ${
            isRideStarted ? 'bg-slate-950/95' : 'bg-white/95'
          }`}
        >
          <div className={`mx-auto mb-3 h-1.5 w-10 rounded-full ${isRideStarted ? 'bg-slate-600' : 'bg-slate-300'}`} />

          {!isRideStarted ? (
            <div className="space-y-3">
              <RouteInfoPanel summary={activeSummary} />
              <ElevationProfileChart points={activePath} />
              <NearbyCoursePanel
                radius={radius}
                onRadiusChange={setRadius}
                courses={nearbyCourses}
                onSelectCourse={(course) => {
                  clearRoute()
                  setPathOnly(course.coordinates)
                }}
              />
              <button
                type="button"
                onClick={startRide}
                className="w-full rounded-2xl bg-blue-600 px-4 py-4 text-base font-extrabold text-white shadow-[0_12px_30px_rgba(37,99,235,0.35)]"
              >
                라이딩 시작
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold tracking-[0.08em] text-slate-400">RIDING MODE</p>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    metrics.autoPaused ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'
                  }`}
                >
                  {metrics.autoPaused ? '자동 일시정지' : '주행 중'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-white">
                <div className="rounded-2xl bg-slate-900/80 p-3">
                  <p className="text-[11px] text-slate-400">현재 속도</p>
                  <p className="mt-1 text-4xl font-black tracking-[-0.05em]">{metrics.speedKmh.toFixed(1)}</p>
                  <p className="text-[11px] text-slate-400">km/h</p>
                </div>
                <div className="rounded-2xl bg-slate-900/80 p-3">
                  <p className="text-[11px] text-slate-400">이동 거리</p>
                  <p className="mt-1 text-4xl font-black tracking-[-0.05em]">{metrics.distanceKm.toFixed(2)}</p>
                  <p className="text-[11px] text-slate-400">km</p>
                </div>
                <div className="rounded-2xl bg-slate-900/80 p-3">
                  <p className="text-[11px] text-slate-400">주행 시간</p>
                  <p className="mt-1 text-3xl font-black tracking-[-0.03em]">{formatDuration(metrics.durationSec)}</p>
                </div>
                <div className="rounded-2xl bg-slate-900/80 p-3">
                  <p className="text-[11px] text-slate-400">경사도</p>
                  <p className="mt-1 text-4xl font-black tracking-[-0.05em]">{metrics.gradePercent.toFixed(1)}</p>
                  <p className="text-[11px] text-slate-400">%</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {bicycleRoute.error && (
        <div className="absolute bottom-8 left-4 right-4 z-30 rounded-xl border border-red-300/40 bg-red-900/70 p-2 text-xs text-red-100">
          {bicycleRoute.error.message}
        </div>
      )}
    </section>
  )
}
