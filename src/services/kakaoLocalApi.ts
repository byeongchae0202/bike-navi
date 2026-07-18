import { KAKAO_REST_KEY } from '../constants/env'
import type { Place } from '../types/geo'
import type { KakaoSearchResponse } from '../types/kakao'

export async function searchKakaoPlaces(keyword: string): Promise<Place[]> {
  if (!KAKAO_REST_KEY) {
    throw new Error('VITE_KAKAO_REST_API_KEY가 필요합니다.')
  }

  const params = new URLSearchParams({ query: keyword, size: '8' })
  const response = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?${params}`, {
    headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` },
  })
  if (!response.ok) {
    throw new Error(`카카오 장소 검색 실패 (${response.status})`)
  }

  const data = (await response.json()) as KakaoSearchResponse
  return data.documents.map((doc) => ({
    id: doc.id,
    name: doc.place_name,
    address: doc.road_address_name || doc.address_name,
    location: { lat: Number(doc.y), lng: Number(doc.x) },
  }))
}
