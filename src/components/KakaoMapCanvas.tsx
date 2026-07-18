import { useEffect, useMemo, useRef } from 'react'
import type { LatLng, Place, RoutePoint } from '../types/geo'
import { ensureKakaoMapSdk, reverseGeocodeLatLng } from '../services/kakaoSdk'

type KakaoMapCanvasProps = {
  center: LatLng
  markers: LatLng[]
  routePath: RoutePoint[]
  onMapSelection: (action: 'origin' | 'waypoint' | 'destination', place: Place) => void
}

export function KakaoMapCanvas({ center, markers, routePath, onMapSelection }: KakaoMapCanvasProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<KakaoMap | null>(null)
  const markerRef = useRef<KakaoMarker[]>([])
  const polylineRef = useRef<KakaoPolyline | null>(null)
  const clickedPinRef = useRef<KakaoCustomOverlay | null>(null)
  const actionOverlayRef = useRef<KakaoCustomOverlay | null>(null)
  const onMapSelectionRef = useRef(onMapSelection)

  useEffect(() => {
    onMapSelectionRef.current = onMapSelection
  }, [onMapSelection])

  useEffect(() => {
    const init = async () => {
      await ensureKakaoMapSdk()
      const kakao = window.kakao
      if (!mapContainerRef.current || !kakao?.maps) {
        return
      }
      const map = new kakao.maps.Map(mapContainerRef.current, {
        center: new kakao.maps.LatLng(center.lat, center.lng),
        level: 4,
      })
      mapRef.current = map

      kakao.maps.event.addListener(map, 'click', (event) => {
        const point = {
          lat: event.latLng.getLat(),
          lng: event.latLng.getLng(),
        }

        clickedPinRef.current?.setMap(null)
        actionOverlayRef.current?.setMap(null)

        const markerElement = document.createElement('div')
        markerElement.className =
          'h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow-[0_0_0_6px_rgba(37,99,235,0.25)]'
        const pinOverlay = new kakao.maps.CustomOverlay({
          map,
          position: new kakao.maps.LatLng(point.lat, point.lng),
          content: markerElement,
          yAnchor: 1.8,
        })
        clickedPinRef.current = pinOverlay

        const overlayRoot = document.createElement('div')
        overlayRoot.className = 'w-52 rounded-xl border border-slate-600 bg-slate-950/95 p-2 text-white shadow-xl'

        const title = document.createElement('p')
        title.className = 'mb-2 text-[11px] font-semibold text-slate-300'
        title.textContent = '선택한 위치로 경로 설정'
        overlayRoot.appendChild(title)

        const buttonWrap = document.createElement('div')
        buttonWrap.className = 'grid gap-1'

        const createActionButton = (label: string, action: 'origin' | 'waypoint' | 'destination') => {
          const button = document.createElement('button')
          button.type = 'button'
          button.className =
            'rounded-md bg-slate-800 px-2 py-1 text-left text-[11px] font-semibold text-slate-100 hover:bg-slate-700'
          button.textContent = label
          button.onclick = async () => {
            const address = await reverseGeocodeLatLng(point)
            const place: Place = {
              id: `map-${Date.now()}-${action}`,
              name: address.split(' ')[0] ?? '지도 선택 지점',
              address,
              location: point,
            }
            onMapSelectionRef.current(action, place)
            actionOverlayRef.current?.setMap(null)
          }
          return button
        }

        buttonWrap.appendChild(createActionButton('출발지로 설정', 'origin'))
        buttonWrap.appendChild(createActionButton('경유지 추가', 'waypoint'))
        buttonWrap.appendChild(createActionButton('도착지로 설정', 'destination'))
        overlayRoot.appendChild(buttonWrap)

        const actionOverlay = new kakao.maps.CustomOverlay({
          map,
          position: new kakao.maps.LatLng(point.lat, point.lng),
          content: overlayRoot,
          yAnchor: 2.9,
        })
        actionOverlayRef.current = actionOverlay
      })
    }
    void init()
  }, [])

  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) {
      return
    }
    mapRef.current.setCenter(new window.kakao.maps.LatLng(center.lat, center.lng))
  }, [center.lat, center.lng])

  const markerPoints = useMemo(() => markers, [markers])

  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) {
      return
    }
    markerRef.current.forEach((marker) => marker.setMap(null))
    markerRef.current = markerPoints.map(
      (point) =>
        new window.kakao!.maps.Marker({
          map: mapRef.current ?? undefined,
          position: new window.kakao!.maps.LatLng(point.lat, point.lng),
        }),
    )
  }, [markerPoints])

  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) {
      return
    }
    polylineRef.current?.setMap(null)
    if (!routePath.length) {
      return
    }
    const line = new window.kakao.maps.Polyline({
      map: mapRef.current,
      path: routePath.map((point) => new window.kakao!.maps.LatLng(point.lat, point.lng)),
      strokeWeight: 6,
      strokeColor: '#2563eb',
      strokeOpacity: 0.9,
      strokeStyle: 'solid',
    })
    polylineRef.current = line
  }, [routePath])

  return <div ref={mapContainerRef} className="h-full w-full" />
}
