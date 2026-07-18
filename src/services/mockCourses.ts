import type { LatLng, NearbyCourse } from '../types/geo'
import { haversineDistanceMeters } from '../utils/geo'

const seedCourses = (center: LatLng): NearbyCourse[] => [
  {
    id: 'hangang-loop',
    name: '한강 스피드 루프',
    totalDistanceKm: 22.4,
    gainElevationM: 135,
    coordinates: [
      { lat: center.lat + 0.004, lng: center.lng - 0.017 },
      { lat: center.lat + 0.016, lng: center.lng - 0.006 },
      { lat: center.lat + 0.019, lng: center.lng + 0.008 },
      { lat: center.lat + 0.007, lng: center.lng + 0.018 },
      { lat: center.lat - 0.005, lng: center.lng + 0.009 },
      { lat: center.lat - 0.008, lng: center.lng - 0.011 },
      { lat: center.lat + 0.004, lng: center.lng - 0.017 },
    ],
  },
  {
    id: 'night-river',
    name: '야간 리버 크루즈',
    totalDistanceKm: 14.8,
    gainElevationM: 88,
    coordinates: [
      { lat: center.lat + 0.002, lng: center.lng - 0.007 },
      { lat: center.lat + 0.008, lng: center.lng - 0.003 },
      { lat: center.lat + 0.011, lng: center.lng + 0.003 },
      { lat: center.lat + 0.004, lng: center.lng + 0.01 },
      { lat: center.lat - 0.002, lng: center.lng + 0.005 },
      { lat: center.lat + 0.002, lng: center.lng - 0.007 },
    ],
  },
  {
    id: 'city-climb',
    name: '도심 업힐 챌린지',
    totalDistanceKm: 33.2,
    gainElevationM: 510,
    coordinates: [
      { lat: center.lat - 0.009, lng: center.lng - 0.018 },
      { lat: center.lat + 0.005, lng: center.lng - 0.011 },
      { lat: center.lat + 0.017, lng: center.lng + 0.003 },
      { lat: center.lat + 0.021, lng: center.lng + 0.016 },
      { lat: center.lat + 0.008, lng: center.lng + 0.023 },
      { lat: center.lat - 0.006, lng: center.lng + 0.011 },
      { lat: center.lat - 0.009, lng: center.lng - 0.018 },
    ],
  },
]

export async function getNearbyMockCourses(center: LatLng, radiusKm: 5 | 10) {
  const courses = seedCourses(center)
  return courses.filter((course) => {
    const start = course.coordinates[0]
    const distance = haversineDistanceMeters(center, start) / 1000
    return distance <= radiusKm
  })
}
