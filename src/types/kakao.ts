export type KakaoSearchDocument = {
  id: string
  place_name: string
  road_address_name: string
  address_name: string
  x: string
  y: string
}

export type KakaoSearchResponse = {
  documents: KakaoSearchDocument[]
}

export type KakaoBikeRoad = {
  vertexes?: number[]
  elevations?: number[]
  distance?: number
  is_bicycle_only?: boolean
  road_type?: string
}

export type KakaoBikeSection = {
  roads?: KakaoBikeRoad[]
  distance?: number
}

export type KakaoBikeRoute = {
  summary?: {
    distance?: number
    duration?: number
    bicycle_road_distance?: number
  }
  sections?: KakaoBikeSection[]
}

export type KakaoBikeDirectionsResponse = {
  routes?: KakaoBikeRoute[]
}
