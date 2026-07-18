import { useQuery } from '@tanstack/react-query'
import type { LatLng } from '../types/geo'
import { getNearbyMockCourses } from '../services/mockCourses'

export function useNearbyCourses(center: LatLng | null, radiusKm: 5 | 10) {
  return useQuery({
    queryKey: ['nearby-courses', center?.lat, center?.lng, radiusKm],
    queryFn: () => {
      if (!center) {
        return Promise.resolve([])
      }
      return getNearbyMockCourses(center, radiusKm)
    },
    enabled: Boolean(center),
  })
}
