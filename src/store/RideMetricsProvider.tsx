import { createContext, useContext, useMemo, useState } from 'react'
import { useRideSensors } from '../hooks/useRideSensors'

type RideMetricsContextValue = ReturnType<typeof useRideSensors> & {
  isRideStarted: boolean
  startRide: () => void
}

const RideMetricsContext = createContext<RideMetricsContextValue | null>(null)

export function RideMetricsProvider({ children }: { children: React.ReactNode }) {
  const [isRideStarted, setIsRideStarted] = useState(false)
  const sensorState = useRideSensors(isRideStarted)
  const value = useMemo(
    () => ({
      ...sensorState,
      isRideStarted,
      startRide: () => setIsRideStarted(true),
    }),
    [isRideStarted, sensorState],
  )
  return <RideMetricsContext.Provider value={value}>{children}</RideMetricsContext.Provider>
}

export function useRideMetrics() {
  const context = useContext(RideMetricsContext)
  if (!context) {
    throw new Error('useRideMetrics는 RideMetricsProvider 내부에서 사용해야 합니다.')
  }
  return context
}
