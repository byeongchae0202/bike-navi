import type { RoutePoint } from '../types/geo'

type ElevationProfileChartProps = {
  points: RoutePoint[]
}

export function ElevationProfileChart({ points }: ElevationProfileChartProps) {
  if (points.length < 2) {
    return (
      <section className="rounded-2xl bg-slate-100 p-3">
        <p className="text-xs text-slate-500">고도 프로필 데이터가 없습니다.</p>
      </section>
    )
  }

  const heights = points.map((point) => point.elevationM ?? 0)
  const min = Math.min(...heights)
  const max = Math.max(...heights)
  const range = Math.max(max - min, 1)
  const width = 420
  const height = 120

  const polylinePoints = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width
      const y = height - (((point.elevationM ?? min) - min) / range) * height
      return `${x},${y}`
    })
    .join(' ')

  return (
    <section className="rounded-2xl bg-slate-100 p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-600">
        <span>고도 프로필 (스켈레톤)</span>
        <span>
          {Math.round(min)}m ~ {Math.round(max)}m
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-28 w-full">
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="#60a5fa"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </section>
  )
}
