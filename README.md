# Bike Navi Web App (Clean Slate)

React(Vite) + TypeScript + Tailwind CSS 기반의 **반응형 PWA 자전거 내비게이션 웹앱**입니다.  
외부 하드웨어 센서 없이 스마트폰의 GPS, 가속도, 기압(가능 시) + 웹 API만 사용합니다.

## 실행

```bash
npm install
npm run dev
```

## 환경 변수 (`.env.local`)

```bash
VITE_KAKAO_JS_API_KEY=카카오맵_JS_KEY
VITE_KAKAO_REST_API_KEY=카카오_REST_API_KEY
VITE_KAKAO_MOBILITY_BASE_URL=https://apis-navi.kakaomobility.com
```

## 주요 기능

1. 홈(Wahoo 스타일): 속도, 거리, 시간, 고도, 경사도 대시보드
2. 네비(카카오 스타일): 전체 화면 지도 + 검색/자동완성 + 최대 5개 경유지 + 순서 변경
3. 센서 로직: 로우패스 필터 속도, Auto-Pause, Crash Detection, 기압/고도 계산
4. 길찾기: `affiliate/bicycle/v1/directions` 호출 + Polyline 렌더링
5. 경로 분석: 자전거 전용도로 비율(%) + Elevation Profile 차트 스켈레톤
6. 추천 코스: 반경(5km/10km) 기반 Mock 코스 필터

## 폴더 구조

```text
src
├─ components
│  ├─ CrashAlertModal.tsx
│  ├─ ElevationProfileChart.tsx
│  ├─ KakaoMapCanvas.tsx
│  ├─ MetricCard.tsx
│  ├─ NavigationOverlay.tsx
│  ├─ NearbyCoursePanel.tsx
│  ├─ PlaceAutocompleteInput.tsx
│  ├─ RootLayout.tsx
│  └─ RouteInfoPanel.tsx
├─ constants
│  └─ env.ts
├─ hooks
│  ├─ useBicycleRoute.ts
│  ├─ useNearbyCourses.ts
│  ├─ usePlaceAutocomplete.ts
│  └─ useRideSensors.ts
├─ pages
│  ├─ DashboardPage.tsx
│  └─ NavigationPage.tsx
├─ services
│  ├─ kakaoLocalApi.ts
│  ├─ kakaoMobilityApi.ts
│  ├─ kakaoSdk.ts
│  └─ mockCourses.ts
├─ store
│  ├─ RideMetricsProvider.tsx
│  └─ useNavigationStore.ts
├─ types
│  ├─ geo.ts
│  ├─ kakao.ts
│  └─ sensor.ts
├─ utils
│  ├─ filter.ts
│  ├─ format.ts
│  └─ geo.ts
├─ App.tsx
├─ global.d.ts
├─ index.css
├─ main.tsx
└─ router.tsx
```
