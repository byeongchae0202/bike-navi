import { useEffect, useState } from 'react'
import { usePlaceAutocomplete } from '../hooks/usePlaceAutocomplete'
import type { Place } from '../types/geo'

type PlaceAutocompleteInputProps = {
  label: string
  value: Place | null
  onSelect: (place: Place | null) => void
}

export function PlaceAutocompleteInput({ label, value, onSelect }: PlaceAutocompleteInputProps) {
  const [keyword, setKeyword] = useState(value?.name ?? '')
  const { data = [], isFetching } = usePlaceAutocomplete(keyword)

  useEffect(() => {
    setKeyword(value?.name ?? '')
  }, [value?.id, value?.name])

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <input
        value={keyword}
        onChange={(event) => {
          const text = event.target.value
          setKeyword(text)
          if (!text.trim()) {
            onSelect(null)
          }
        }}
        placeholder={`${label} 검색`}
        className="w-full rounded-lg bg-slate-800/90 px-3 py-2 text-sm text-slate-100 outline-none ring-blue-500 focus:ring-2"
      />
      {isFetching && <p className="text-xs text-slate-400">검색 중...</p>}
      {keyword.trim().length >= 2 && data.length > 0 && (
        <ul className="max-h-48 overflow-y-auto rounded-lg bg-slate-900">
          {data.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                className="w-full border-b border-slate-800 px-3 py-2 text-left last:border-b-0 hover:bg-slate-800"
                onClick={() => {
                  onSelect(place)
                  setKeyword(place.name)
                }}
              >
                <p className="text-sm font-semibold text-slate-100">{place.name}</p>
                <p className="text-xs text-slate-400">{place.address}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
