import { create } from 'zustand'
import type { LatLng, Place, RoutePoint, RouteSummary } from '../types/geo'

type NavigationStore = {
  origin: Place | null
  destination: Place | null
  waypoints: Place[]
  activePath: RoutePoint[]
  activeSummary: RouteSummary | null
  setOrigin: (place: Place | null) => void
  setDestination: (place: Place | null) => void
  addWaypoint: (place: Place) => void
  updateWaypoint: (index: number, place: Place | null) => void
  reorderWaypoint: (index: number, direction: 'up' | 'down') => void
  removeWaypoint: (index: number) => void
  setRoute: (path: RoutePoint[], summary: RouteSummary) => void
  clearRoute: () => void
  setPathOnly: (path: LatLng[]) => void
}

export const useNavigationStore = create<NavigationStore>((set) => ({
  origin: null,
  destination: null,
  waypoints: [],
  activePath: [],
  activeSummary: null,
  setOrigin: (origin) => set({ origin }),
  setDestination: (destination) => set({ destination }),
  addWaypoint: (place) =>
    set((state) => {
      if (state.waypoints.length >= 5) {
        return state
      }
      return { waypoints: [...state.waypoints, place] }
    }),
  updateWaypoint: (index, place) =>
    set((state) => {
      const waypoints = [...state.waypoints]
      if (place) {
        waypoints[index] = place
      } else {
        waypoints.splice(index, 1)
      }
      return { waypoints }
    }),
  reorderWaypoint: (index, direction) =>
    set((state) => {
      const swapIndex = direction === 'up' ? index - 1 : index + 1
      if (swapIndex < 0 || swapIndex >= state.waypoints.length) {
        return state
      }
      const waypoints = [...state.waypoints]
      ;[waypoints[index], waypoints[swapIndex]] = [waypoints[swapIndex], waypoints[index]]
      return { waypoints }
    }),
  removeWaypoint: (index) =>
    set((state) => ({ waypoints: state.waypoints.filter((_, waypointIndex) => waypointIndex !== index) })),
  setRoute: (activePath, activeSummary) => set({ activePath, activeSummary }),
  clearRoute: () => set({ activePath: [], activeSummary: null }),
  setPathOnly: (path) =>
    set({
      activePath: path.map((point) => ({ ...point })),
      activeSummary: null,
    }),
}))
