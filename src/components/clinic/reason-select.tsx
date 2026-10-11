import { useMemo, useState } from 'react'
import { Check, ChevronDown, Minus, Plus, X } from 'lucide-react'
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

const MAX_QTY = 50

/** "زراعة ×3" ⇄ { name: 'زراعة', qty: 3 } */
export function parseReason(part: string) {
  const match = /^(.+?)\s*×\s*(\d+)$/.exec(part.trim())
  if (!match) return { name: part.trim(), qty: 1 }
  return { name: match[1]!.trim(), qty: Math.min(MAX_QTY, Math.max(1, Number(match[2]))) }
}

export function reasonPart(name: string, qty: number) {
  return qty > 1 ? `${name} ×${qty}` : name
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
  const picked = useMemo(() => splitReasons(value).map(parseReason), [value])
  const selected = useMemo(() => picked.map((p) => p.name), [picked])
  const options = useReasonOptions(selected)
  const { data: services = [] } = useServices()
  const priceOf = (reason: string) => services.find((s) => s.name === reason)?.price ?? 0

  const groups = useMemo(() => groupByFirstWord(options, (o) => o), [options])
  const [openGroup, setOpenGroup] = useState<string | null>(null)

  const commit = (next: Array<{ name: string; qty: number }>) => {
    const joined = joinReasons(next.map((p) => reasonPart(p.name, p.qty)))
    setInnerValue(joined)
    onValueChange?.(joined)
  }

  const toggle = (reason: string) =>
    commit(selected.includes(reason) ? picked.filter((p) => p.name !== reason) : [...picked, { name: reason, qty: 1 }])

  const setQty = (reason: string, qty: number) =>
    commit(picked.map((p) => (p.name === reason ? { ...p, qty: Math.min(MAX_QTY, Math.max(1, qty)) } : p)))

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

      {picked.length > 0 ? (
        <div className="grid gap-1.5 rounded-2xl border border-primary/25 bg-primary/5 p-2">
          <p className="px-1 text-xs font-bold text-primary">اخترت ({picked.length}) — حدد العدد</p>
          <ul className="grid gap-1.5">
            {picked.map(({ name: reason, qty }) => {
              const price = priceOf(reason)
              return (
                <li key={reason} className="flex items-center gap-2 rounded-xl bg-card px-2.5 py-1.5 shadow-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{reason}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {price <= 0
                        ? 'مالهاش سعر متحدد'
                        : qty > 1
                          ? `${money(price)} × ${qty} = ${money(price * qty)}`
                          : money(price)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center rounded-xl border border-border bg-muted/40" title="العدد">
                    <button
                      type="button"
                      onClick={() => setQty(reason, qty + 1)}
                      disabled={qty >= MAX_QTY}
                      className="grid size-9 place-items-center rounded-xl text-primary hover:bg-primary/10 disabled:opacity-35"
                      aria-label={`زوّد عدد ${reason}`}
                    >
                      <Plus className="size-4" />
                    </button>
                    <span className="font-display min-w-7 text-center text-base font-bold tabular-nums">{qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(reason, qty - 1)}
                      disabled={qty <= 1}
                      className="grid size-9 place-items-center rounded-xl text-primary hover:bg-primary/10 disabled:opacity-35"
                      aria-label={`قلّل عدد ${reason}`}
                    >
                      <Minus className="size-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(reason)}
                    className="grid size-9 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-rose-50 hover:text-destructive"
                    aria-label={`شيل ${reason}`}
                  >
                    <X className="size-4" />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <p className="text-[11px] font-medium text-muted-foreground">
          {required ? `${placeholder} — تقدر تختار أكتر من حاجة` : 'تقدر تختار أكتر من حاجة'}
        </p>
      )}
    </div>
  )
}