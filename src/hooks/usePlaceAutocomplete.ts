import { useQuery } from '@tanstack/react-query'
import { searchKakaoPlaces } from '../services/kakaoLocalApi'

export function usePlaceAutocomplete(keyword: string) {
  return useQuery({
    queryKey: ['kakao-places', keyword],
    queryFn: () => searchKakaoPlaces(keyword),
    enabled: keyword.trim().length >= 2,
  })
}
