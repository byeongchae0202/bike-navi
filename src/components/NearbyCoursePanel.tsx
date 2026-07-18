import type { NearbyCourse } from '../types/geo'

type NearbyCoursePanelProps = {
  radius: 5 | 10
  onRadiusChange: (radius: 5 | 10) => void
  courses: NearbyCourse[]
  onSelectCourse: (course: NearbyCourse) => void
}

export function NearbyCoursePanel({
  radius,
  onRadiusChange,
  courses,
  onSelectCourse,
}: NearbyCoursePanelProps) {
  return (
    <section className="rounded-2xl bg-slate-100 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">반경 추천 코스</h3>
        <select
          value={radius}
          onChange={(event) => onRadiusChange(Number(event.target.value) as 5 | 10)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
        >
          <option value={5}>5km</option>
          <option value={10}>10km</option>
        </select>
      </div>
      <ul className="space-y-2">
        {courses.length === 0 && <li className="text-xs text-slate-500">선택한 반경 내 코스가 없습니다.</li>}
        {courses.map((course) => (
          <li key={course.id}>
            <button
              type="button"
              onClick={() => onSelectCourse(course)}
              className="w-full rounded-xl bg-white px-3 py-2 text-left hover:bg-slate-50"
            >
              <p className="text-sm font-semibold text-slate-800">{course.name}</p>
              <p className="mt-1 text-xs text-slate-500">
                {course.totalDistanceKm.toFixed(1)}km · 획득고도 {course.gainElevationM}m
              </p>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
