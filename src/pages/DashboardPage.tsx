import { MetricCard } from '../components/MetricCard'
import { useRideMetrics } from '../store/RideMetricsProvider'
import { formatDuration } from '../utils/format'

export function DashboardPage() {
  const {
    metrics: { speedKmh, distanceKm, durationSec, elevationM, gradePercent, autoPaused },
  } = useRideMetrics()

  return (
    <section className="mx-auto max-w-3xl px-4 pt-5">
      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard label="속도" value={speedKmh.toFixed(1)} unit="km/h" highlight />
        <MetricCard label="이동 거리" value={distanceKm.toFixed(2)} unit="km" />
        <MetricCard label="주행 시간" value={formatDuration(durationSec)} unit="" />
        <MetricCard label="실시간 고도" value={elevationM.toFixed(1)} unit="m" />
        <div className="col-span-2">
          <MetricCard label="경사도" value={gradePercent.toFixed(1)} unit="%" />
        </div>
      </div>

      <div
        className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-bold ${
          autoPaused ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'
        }`}
      >
        {autoPaused ? '자동 일시정지' : '주행 중'}
      </div>
    </section>
  )
}
