import { KAKAO_JS_KEY } from '../constants/env'
import type { LatLng } from '../types/geo'

let sdkPromise: Promise<void> | null = null

export async function ensureKakaoMapSdk() {
  if (window.kakao?.maps) {
    return
  }
  if (!KAKAO_JS_KEY) {
    throw new Error('VITE_KAKAO_JS_API_KEY가 필요합니다.')
  }

  if (!sdkPromise) {
    sdkPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false&libraries=services`
      script.async = true
      script.onload = () => {
        if (!window.kakao?.maps) {
          reject(new Error('카카오맵 SDK 초기화 실패'))
          return
        }
        window.kakao.maps.load(() => resolve())
      }
      script.onerror = () => reject(new Error('카카오맵 SDK 로드 실패'))
      document.head.appendChild(script)
    })
  }
  await sdkPromise
}

export async function reverseGeocodeLatLng(point: LatLng) {
  await ensureKakaoMapSdk()
  if (!window.kakao?.maps.services) {
    return `지도 선택 지점 (${point.lat.toFixed(5)}, ${point.lng.toFixed(5)})`
  }

  const geocoder = new window.kakao.maps.services.Geocoder()
  return new Promise<string>((resolve) => {
    geocoder.coord2Address(point.lng, point.lat, (result, status) => {
      if (status !== window.kakao?.maps.services?.Status.OK || !result[0]) {
        resolve(`지도 선택 지점 (${point.lat.toFixed(5)}, ${point.lng.toFixed(5)})`)
        return
      }
      const roadAddress = result[0].road_address?.address_name
      const address = result[0].address?.address_name
      resolve(roadAddress || address || `지도 선택 지점 (${point.lat.toFixed(5)}, ${point.lng.toFixed(5)})`)
    })
  })
}
