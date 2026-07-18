type MetricCardProps = {
  label: string
  value: string
  unit: string
  highlight?: boolean
}

export function MetricCard({ label, value, unit, highlight }: MetricCardProps) {
  return (
    <section
      className={`rounded-2xl p-4 ${
        highlight
          ? 'bg-gradient-to-br from-blue-500/90 to-blue-700/90 shadow-[0_12px_26px_rgba(37,99,235,0.28)]'
          : 'bg-slate-900/70'
      }`}
    >
      <p className="text-[11px] font-semibold tracking-[0.04em] text-slate-300">{label}</p>
      <div className="mt-1 flex items-end gap-2">
        <span className="text-4xl font-black tracking-[-0.04em] sm:text-5xl">{value}</span>
        {unit && <span className="pb-1 text-[11px] text-slate-300">{unit}</span>}
      </div>
    </section>
  )
}
