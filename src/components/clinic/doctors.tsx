import { Stethoscope } from 'lucide-react'
import { DOCTORS, doctorById, type DoctorId } from '@/lib/doctors'
import { cn } from '@/lib/utils'

const TONE: Record<DoctorId, { badge: string; active: string; dot: string }> = {
  ashraf: {
    badge: 'bg-blue-500/10 text-blue-700',
    active: 'border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-500/20',
    dot: 'bg-blue-500',
  },
  heba: {
    badge: 'bg-pink-500/10 text-pink-700',
    active: 'border-pink-500 bg-pink-50 text-pink-800 ring-2 ring-pink-500/20',
    dot: 'bg-pink-500',
  },
}

export function DoctorBadge({ id, className }: { id: DoctorId; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        TONE[id].badge,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', TONE[id].dot)} />
      {doctorById(id).short}
    </span>
  )
}

/** اختيار الدكتور عند الحجز */
export function DoctorPicker({
  value,
  onChange,
  className,
}: {
  value: DoctorId | ''
  onChange: (id: DoctorId) => void
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label="الدكتور" className={cn('grid grid-cols-2 gap-2', className)}>
      {DOCTORS.map((d) => {
        const active = value === d.id
        return (
          <button
            key={d.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(d.id)}
            className={cn(
              'flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition',
              active ? TONE[d.id].active : 'border-border bg-card text-foreground/75 hover:border-foreground/25',
            )}
          >
            <Stethoscope className="size-4 shrink-0" />
            {d.short}
          </button>
        )
      })}
    </div>
  )
}

export type DoctorFilterValue = DoctorId | 'all'

/** الكل / مرضى د. أشرف / مرضى د. هبة */
export function DoctorFilter({
  value,
  onChange,
  counts,
  className,
}: {
  value: DoctorFilterValue
  onChange: (v: DoctorFilterValue) => void
  counts?: Partial<Record<DoctorFilterValue, number>>
  className?: string
}) {
  const options: { id: DoctorFilterValue; label: string }[] = [
    { id: 'all', label: 'الكل' },
    ...DOCTORS.map((d) => ({ id: d.id, label: d.short })),
  ]
  return (
    <div className={cn('flex gap-1 rounded-xl bg-muted/70 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            'min-h-8 flex-1 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition sm:flex-none',
            value === o.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
          )}
        >
          {o.label}
          {counts?.[o.id] !== undefined ? <span className="ms-1 text-[10px] opacity-70">{counts[o.id]}</span> : null}
        </button>
      ))}
    </div>
  )
}
