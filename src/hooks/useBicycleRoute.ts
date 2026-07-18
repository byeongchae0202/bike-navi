import { useMutation } from '@tanstack/react-query'
import { requestBicycleRoute } from '../services/kakaoMobilityApi'

export function useBicycleRoute() {
  return useMutation({
    mutationFn: requestBicycleRoute,
  })
}
