import type { RouteSummary } from '../types/geo'

type RouteInfoPanelProps = {
  summary: RouteSummary | null
}

export function RouteInfoPanel({ summary }: RouteInfoPanelProps) {
  return (
    <section className="rounded-2xl bg-slate-100 p-3">
      <h3 className="text-sm font-bold text-slate-800">경로 요약</h3>
      {!summary ? (
        <p className="mt-2 text-xs text-slate-500">경로를 계산하면 거리/시간/자전거도로 비율이 표시됩니다.</p>
      ) : (
        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl bg-white p-2">
            <p className="text-slate-500">거리</p>
            <p className="mt-1 text-sm font-bold text-slate-800">{summary.distanceKm.toFixed(2)} km</p>
          </div>
          <div className="rounded-xl bg-white p-2">
            <p className="text-slate-500">예상 시간</p>
            <p className="mt-1 text-sm font-bold text-slate-800">{summary.durationMin.toFixed(0)} 분</p>
          </div>
          <div className="rounded-xl bg-white p-2">
            <p className="text-slate-500">자전거도로 비율</p>
            <p className="mt-1 text-sm font-bold text-slate-800">{summary.bicycleRoadRatio.toFixed(1)}%</p>
          </div>
        </div>
      )}
    </section>
  )
}
