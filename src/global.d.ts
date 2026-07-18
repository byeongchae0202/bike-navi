type DevicePressureSample = {
  value?: number
  pressure?: number
}

interface WindowEventMap {
  devicepressure: Event & DevicePressureSample
}

interface Window {
  ondevicepressure: ((this: Window, ev: Event & DevicePressureSample) => unknown) | null
  kakao?: {
    maps: {
      load(callback: () => void): void
      LatLng: new (lat: number, lng: number) => KakaoLatLng
      Map: new (container: HTMLElement, options: KakaoMapOptions) => KakaoMap
      Marker: new (options: { map?: KakaoMap; position: KakaoLatLng }) => KakaoMarker
      Polyline: new (options: KakaoPolylineOptions) => KakaoPolyline
      CustomOverlay: new (options: KakaoCustomOverlayOptions) => KakaoCustomOverlay
      event: {
        addListener: (
          target: KakaoMap,
          type: 'click',
          handler: (event: KakaoMapMouseEvent) => void,
        ) => void
      }
      services?: {
        Status: { OK: string }
        Geocoder: new () => {
          coord2Address: (
            lng: number,
            lat: number,
            callback: (
              result: Array<{
                road_address?: { address_name?: string }
                address?: { address_name?: string }
              }>,
              status: string,
            ) => void,
          ) => void
        }
      }
    }
  }
}

type KakaoLatLng = {
  getLat(): number
  getLng(): number
}

type KakaoMapOptions = {
  center: KakaoLatLng
  level: number
}

type KakaoMap = {
  setCenter(latlng: KakaoLatLng): void
}

type KakaoMapMouseEvent = {
  latLng: KakaoLatLng
}

type KakaoMarker = {
  setMap(map: KakaoMap | null): void
}

type KakaoPolylineOptions = {
  map?: KakaoMap
  path: KakaoLatLng[]
  strokeWeight?: number
  strokeColor?: string
  strokeOpacity?: number
  strokeStyle?: string
}

type KakaoPolyline = {
  setMap(map: KakaoMap | null): void
}

type KakaoCustomOverlayOptions = {
  map?: KakaoMap
  position: KakaoLatLng
  content: string | HTMLElement
  yAnchor?: number
  xAnchor?: number
}

type KakaoCustomOverlay = {
  setMap(map: KakaoMap | null): void
  setPosition(position: KakaoLatLng): void
  setContent(content: string | HTMLElement): void
}
