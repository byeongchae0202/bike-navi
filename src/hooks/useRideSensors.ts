import { useEffect, useMemo, useRef, useState } from 'react'
import type { RideMetrics } from '../types/sensor'
import { clamp, haversineDistanceMeters, pressureToAltitudeMeters } from '../utils/geo'
import { lowPassFilter } from '../utils/filter'

const AUTO_PAUSE_SPEED = 1.1
const AUTO_RESUME_SPEED = 2
const AUTO_PAUSE_DELAY = 4_000
const CRASH_ACCEL_THRESHOLD = 22

export function useRideSensors(enabled: boolean) {
  const [metrics, setMetrics] = useState<RideMetrics>({
    speedKmh: 0,
    distanceKm: 0,
    durationSec: 0,
    elevationM: 0,
    gradePercent: 0,
    autoPaused: false,
    currentPosition: null,
    crashDetected: false,
  })

  const smoothedSpeedRef = useRef(0)
  const smoothedGradeRef = useRef(0)
  const accelMagnitudeRef = useRef(0)
  const barometricPressureRef = useRef<number | null>(null)
  const lastCoordsRef = useRef<GeolocationCoordinates | null>(null)
  const lastTsRef = useRef<number | null>(null)
  const pauseStartRef = useRef<number | null>(null)
  const crashCooldownRef = useRef<number>(0)
  const elevationRef = useRef(0)

  useEffect(() => {
    if (!enabled) {
      return
    }
    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity
      if (!acc) {
        return
      }
      const magnitude = Math.sqrt((acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2)
      const filtered = lowPassFilter(magnitude, accelMagnitudeRef.current, 0.25)
      accelMagnitudeRef.current = filtered

      const shock = Math.abs(filtered - 9.81)
      const now = Date.now()
      if (shock > CRASH_ACCEL_THRESHOLD && now > crashCooldownRef.current) {
        crashCooldownRef.current = now + 8_000
        setMetrics((prev) => ({ ...prev, crashDetected: true }))
      }
    }

    window.addEventListener('devicemotion', handleMotion)
    return () => window.removeEventListener('devicemotion', handleMotion)
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      return
    }
    if (!('ondevicepressure' in window)) {
      return
    }
    const handlePressure = (event: Event & { value?: number; pressure?: number }) => {
      const pressure = event.value ?? event.pressure
      if (typeof pressure === 'number' && pressure > 100 && pressure < 1200) {
        barometricPressureRef.current = pressure
      }
    }
    window.addEventListener('devicepressure', handlePressure as EventListener)
    return () => window.removeEventListener('devicepressure', handlePressure as EventListener)
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      return
    }
    if (!navigator.geolocation) {
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = position.timestamp
        const coords = position.coords
        const prevCoords = lastCoordsRef.current
        const prevTs = lastTsRef.current
        const currentPoint = { lat: coords.latitude, lng: coords.longitude }

        if (!prevCoords || !prevTs) {
          lastCoordsRef.current = coords
          lastTsRef.current = now
          const firstElevation =
            barometricPressureRef.current !== null
              ? pressureToAltitudeMeters(barometricPressureRef.current)
              : (coords.altitude ?? 0)
          elevationRef.current = firstElevation
          setMetrics((prev) => ({ ...prev, currentPosition: currentPoint, elevationM: firstElevation }))
          return
        }

        const elapsedSec = Math.max((now - prevTs) / 1000, 0.001)
        const distanceM = haversineDistanceMeters(
          { lat: prevCoords.latitude, lng: prevCoords.longitude },
          currentPoint,
        )
        const gpsSpeed = coords.speed !== null && coords.speed > 0 ? coords.speed * 3.6 : (distanceM / elapsedSec) * 3.6
        const accelBoost = Math.max(0, accelMagnitudeRef.current - 9.81) * 0.2
        const fusedSpeed = gpsSpeed * 0.82 + accelBoost
        const filteredSpeed = lowPassFilter(clamp(fusedSpeed, 0, 80), smoothedSpeedRef.current, 0.28)
        smoothedSpeedRef.current = filteredSpeed

        if (filteredSpeed < AUTO_PAUSE_SPEED) {
          pauseStartRef.current = pauseStartRef.current ?? now
        } else if (filteredSpeed > AUTO_RESUME_SPEED) {
          pauseStartRef.current = null
        }
        const autoPaused = pauseStartRef.current !== null && now - pauseStartRef.current >= AUTO_PAUSE_DELAY
        const moving = !autoPaused

        const elevationNow =
          barometricPressureRef.current !== null
            ? pressureToAltitudeMeters(barometricPressureRef.current)
            : (coords.altitude ?? elevationRef.current)

        const elevationPrev =
          barometricPressureRef.current !== null
            ? elevationRef.current
            : (prevCoords.altitude ?? elevationRef.current)

        const gradeRaw = distanceM > 1 ? ((elevationNow - elevationPrev) / distanceM) * 100 : smoothedGradeRef.current
        const filteredGrade = lowPassFilter(clamp(gradeRaw, -18, 18), smoothedGradeRef.current, 0.2)
        smoothedGradeRef.current = filteredGrade

        setMetrics((prev) => ({
          speedKmh: filteredSpeed,
          distanceKm: moving && distanceM < 80 ? prev.distanceKm + distanceM / 1000 : prev.distanceKm,
          durationSec: moving ? prev.durationSec + elapsedSec : prev.durationSec,
          elevationM: elevationNow,
          gradePercent: filteredGrade,
          autoPaused,
          currentPosition: currentPoint,
          crashDetected: prev.crashDetected,
        }))
        elevationRef.current = elevationNow

        lastCoordsRef.current = coords
        lastTsRef.current = now
      },
      (error) => {
        console.error('위치 추적 오류', error.message)
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 1_000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [enabled])

  useEffect(() => {
    if (enabled) {
      return
    }
    setMetrics((prev) => ({
      ...prev,
      speedKmh: 0,
      autoPaused: false,
      crashDetected: false,
      gradePercent: 0,
    }))
  }, [enabled])

  const dismissCrashAlert = () => {
    setMetrics((prev) => ({ ...prev, crashDetected: false }))
  }

  return useMemo(
    () => ({
      metrics,
      dismissCrashAlert,
    }),
    [metrics],
  )
}
