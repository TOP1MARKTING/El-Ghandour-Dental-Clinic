import { useMemo, useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { groupByFirstWord, subServiceName, VISIT_REASONS } from '@/lib/visit-reasons'
import { useServices } from '@/lib/clinic-hooks'
import { money } from '@/lib/format'
import { cn } from '@/lib/utils'

const OTHER = 'أخرى'
const SEPARATOR = ' + '

/** "حشو عصب + تنضيف جير" ⇄ ['حشو عصب', 'تنضيف جير'] */
export function splitReasons(value: string) {
  return value
    .split('+')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function joinReasons(parts: string[]) {
  return parts.join(SEPARATOR)
}

export function useReasonOptions(selected: string[] = []) {
  const { data: services = [] } = useServices()
  return useMemo(() => {
    const names = services.length > 0 ? services.map((s) => s.name) : [...VISIT_REASONS]
    if (!names.includes(OTHER)) names.push(OTHER)
    const missing = selected.filter((s) => !names.includes(s))
    return [...missing, ...names]
  }, [services, selected])
}

export function ReasonSelect({
  name = 'reason',
  required = false,
  defaultValue = '',
  value: controlledValue,
  onValueChange,
  placeholder = 'اختار سبب الزيارة',
  dense = false,
}: {
  name?: string
  required?: boolean
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  dense?: boolean
}) {
  const [innerValue, setInnerValue] = useState(defaultValue)
  const value = controlledValue ?? innerValue
  const selected = useMemo(() => splitReasons(value), [value])
  const options = useReasonOptions(selected)
  const { data: services = [] } = useServices()
  const priceOf = (reason: string) => services.find((s) => s.name === reason)?.price ?? 0

  const groups = useMemo(() => groupByFirstWord(options, (o) => o), [options])
  const [openGroup, setOpenGroup] = useState<string | null>(null)

  const toggle = (reason: string) => {
    const next = selected.includes(reason) ? selected.filter((r) => r !== reason) : [...selected, reason]
    const joined = joinReasons(next)
    setInnerValue(joined)
    onValueChange?.(joined)
  }

  const rowHeight = dense ? 'min-h-12 sm:min-h-11' : 'min-h-12'
  const cardClass = (highlight: boolean) =>
    cn(
      'rounded-2xl border bg-card shadow-sm transition',
      highlight ? 'border-primary/50 ring-2 ring-primary/10' : 'border-border/60 hover:border-primary/30 hover:shadow-md',
    )

  const checkMark = (active: boolean) => (
    <span
      className={cn(
        'grid size-6 shrink-0 place-items-center rounded-full border-2 transition',
        active ? 'border-primary bg-primary text-primary-foreground scale-105' : 'border-border/90',
      )}
    >
      {active ? <Check className="size-3.5" strokeWidth={3} /> : null}
    </span>
  )

  const nameWithPrice = (reason: string, label: string) => {
    const price = priceOf(reason)
    return (
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-tight">{label}</span>
        {price > 0 ? <span className="block text-[11px] font-medium text-muted-foreground">{money(price)}</span> : null}
      </span>
    )
  }

  return (
    <div className="grid gap-2">
      <input type="hidden" name={name} value={value} required={required} />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] items-start gap-2">
        {groups.map((group) => {
          if (group.items.length === 1) {
            const reason = group.items[0]!
            const active = selected.includes(reason)
            return (
              <button
                key={reason}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(reason)}
                className={cn(cardClass(active), rowHeight, 'flex w-full items-center gap-2 px-3 text-start', active && 'bg-primary/5')}
              >
                {nameWithPrice(reason, reason)}
                {checkMark(active)}
              </button>
            )
          }

          const isOpen = openGroup === group.key
          const picked = group.items.filter((r) => selected.includes(r)).length
          return (
            <div key={group.key} className={cn(cardClass(isOpen || picked > 0), 'overflow-hidden', isOpen && 'col-span-full')}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenGroup(isOpen ? null : group.key)}
                className={cn(rowHeight, 'flex w-full items-center gap-2 px-3 py-1 text-start')}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{group.key}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {picked > 0 ? `اخترت ${picked} من ${group.items.length}` : `${group.items.length} أنواع`}
                  </span>
                </span>
                <span
                  className={cn(
                    'grid size-7 shrink-0 place-items-center rounded-full transition',
                    isOpen ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                  )}
                >
                  <ChevronDown className={cn('size-4 transition-transform', isOpen && 'rotate-180')} />
                </span>
              </button>
              {isOpen ? (
                <div className="grid gap-1 border-t border-border/60 bg-muted/30 p-1.5 grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))]">
                  {group.items.map((reason) => {
                    const active = selected.includes(reason)
                    return (
                      <button
                        key={reason}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggle(reason)}
                        className={cn(
                          'flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-1 text-start transition',
                          active ? 'bg-primary/10 text-primary' : 'hover:bg-card',
                        )}
                      >
                        {nameWithPrice(reason, subServiceName(reason, group.key))}
                        {checkMark(active)}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      {selected.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground">اخترت:</span>
          {selected.map((reason) => (
            <span
              key={reason}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-0.5 ps-2.5 pe-1 text-xs font-semibold text-primary"
            >
              {reason}
              <button
                type="button"
                onClick={() => toggle(reason)}
                className="grid size-5 place-items-center rounded-full hover:bg-primary/15"
                aria-label={`شيل ${reason}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[11px] font-medium text-muted-foreground">
          {required ? `${placeholder} — تقدر تختار أكتر من حاجة` : 'تقدر تختار أكتر من حاجة'}
        </p>
      )}
    </div>
  )
}