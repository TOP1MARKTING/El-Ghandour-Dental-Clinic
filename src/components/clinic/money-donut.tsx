import { money } from '@/lib/format'
import { cn } from '@/lib/utils'

export type DonutSlice = {
  id: string
  label: string
  value: number
  /** لون ثابت مش من الثيم — عشان ألوان الدكاترة ما تتغيرش في الثيم البمبي */
  color: string
  hint?: string
}

const RADIUS = 46
const STROKE = 18
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function MoneyDonut({
  slices,
  centerLabel,
  centerValue,
  className,
}: {
  slices: DonutSlice[]
  centerLabel: string
  centerValue: string
  className?: string
}) {
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0)
  let offset = 0
  const arcs = slices
    .filter((x) => x.value > 0)
    .map((x) => {
      const length = (x.value / total) * CIRCUMFERENCE
      const arc = { ...x, length, offset }
      offset += length
      return arc
    })

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <div className="relative size-36 shrink-0 sm:size-40">
        <svg viewBox="0 0 120 120" className="size-full -rotate-90" role="img" aria-label={centerLabel}>
          <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="currentColor" strokeWidth={STROKE} className="text-muted" />
          {arcs.map((a) => (
            <circle
              key={a.id}
              cx="60"
              cy="60"
              r={RADIUS}
              fill="none"
              stroke={a.color}
              strokeWidth={STROKE}
              strokeDasharray={`${a.length} ${CIRCUMFERENCE - a.length}`}
              strokeDashoffset={-a.offset}
              className="transition-[stroke-dasharray,stroke-dashoffset] duration-500"
            >
              <title>{`${a.label}: ${money(a.value)}`}</title>
            </circle>
          ))}
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <span className="text-[11px] font-semibold text-muted-foreground">{centerLabel}</span>
          <span className="font-display text-base font-bold leading-tight sm:text-lg">{centerValue}</span>
        </div>
      </div>

      <ul className="grid min-w-0 flex-1 gap-1.5">
        {slices.map((x) => (
          <li key={x.id} className="flex min-w-0 items-center gap-2 text-sm">
            <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: x.color }} />
            <span className="min-w-0 flex-1 truncate font-semibold">
              {x.label}
              {x.hint ? <span className="ms-1 text-[11px] font-normal text-muted-foreground">{x.hint}</span> : null}
            </span>
            <span className="font-display shrink-0 font-semibold">{money(x.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
