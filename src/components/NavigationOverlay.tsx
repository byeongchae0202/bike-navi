import { useState } from 'react'
import { useNavigationStore } from '../store/useNavigationStore'
import { PlaceAutocompleteInput } from './PlaceAutocompleteInput'
import type { Place } from '../types/geo'

type NavigationOverlayProps = {
  open: boolean
  onClose: () => void
  loading: boolean
  onRouteRequest: () => void
}

export function NavigationOverlay({ open, onClose, loading, onRouteRequest }: NavigationOverlayProps) {
  const {
    origin,
    destination,
    waypoints,
    setOrigin,
    setDestination,
    updateWaypoint,
    addWaypoint,
    reorderWaypoint,
    removeWaypoint,
  } = useNavigationStore()

  const [waypointInput, setWaypointInput] = useState<Place | null>(null)

  if (!open) {
    return null
  }

  return (
    <div className="absolute inset-0 z-40 bg-black/50 px-3 pt-14 backdrop-blur-[2px]">
      <aside className="mx-auto max-h-[84dvh] w-full max-w-xl overflow-y-auto rounded-3xl bg-slate-950/95 p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-100">경로 설정</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200"
          >
            닫기
          </button>
        </div>

        <div className="space-y-3">
          <PlaceAutocompleteInput label="출발지" value={origin} onSelect={setOrigin} />
          <PlaceAutocompleteInput label="목적지" value={destination} onSelect={setDestination} />

          <div className="rounded-xl bg-slate-900/70 p-2.5">
            <p className="mb-2 text-xs font-semibold text-slate-300">경유지 (최대 5개, 순서 변경 가능)</p>
            {waypoints.length > 0 ? (
              <ul className="space-y-2">
                {waypoints.map((waypoint, index) => (
                  <li key={`${waypoint.id}-${index}`} className="rounded-lg bg-slate-800/85 p-2">
                    <PlaceAutocompleteInput
                      label={`경유지 ${index + 1}`}
                      value={waypoint}
                      onSelect={(place) => updateWaypoint(index, place)}
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="rounded-md bg-slate-700 px-2 py-1 text-xs text-slate-100"
                        onClick={() => reorderWaypoint(index, 'up')}
                        disabled={index === 0}
                      >
                        위로
                      </button>
                      <button
                        type="button"
                        className="rounded-md bg-slate-700 px-2 py-1 text-xs text-slate-100"
                        onClick={() => reorderWaypoint(index, 'down')}
                        disabled={index === waypoints.length - 1}
                      >
                        아래로
                      </button>
                      <button
                        type="button"
                        className="rounded-md bg-red-500/20 px-2 py-1 text-xs text-red-200"
                        onClick={() => removeWaypoint(index)}
                      >
                        삭제
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400">추가된 경유지가 없습니다.</p>
            )}

            <div className="mt-3 space-y-2">
              <PlaceAutocompleteInput label="새 경유지 검색" value={waypointInput} onSelect={setWaypointInput} />
              <button
                type="button"
                disabled={!waypointInput || waypoints.length >= 5}
                onClick={() => {
                  if (!waypointInput) {
                    return
                  }
                  addWaypoint(waypointInput)
                  setWaypointInput(null)
                }}
                className="w-full rounded-lg bg-blue-500/20 px-3 py-2 text-xs font-semibold text-blue-200 disabled:opacity-50"
              >
                경유지 추가 ({waypoints.length}/5)
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              onRouteRequest()
              onClose()
            }}
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:bg-blue-300"
          >
            {loading ? '자전거 경로 계산 중...' : '자전거 최단 경로 요청'}
          </button>
        </div>
      </aside>
    </div>
  )
}
