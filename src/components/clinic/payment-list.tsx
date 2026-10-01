import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Stethoscope, Wallet } from 'lucide-react'
import { ToothIcon } from '@/components/clinic/dental-icons'
import { actorLabel } from '@/components/clinic/patient-timeline'
import { dayKey, formatArabicWeekday, money, withWeekday } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Payment, PaymentKind } from '@/types'

export const KIND_LABEL: Record<PaymentKind, string> = {
  كشف: 'كشف',
  علاج: 'علاج',
  دفعة: 'دفعة من الباقي',
}

const KIND_STYLE: Record<PaymentKind, { icon: ReactNode; tone: string }> = {
  كشف: { icon: <Stethoscope className="size-4" />, tone: 'bg-sky-500/15 text-sky-700' },
  علاج: { icon: <ToothIcon className="size-4" />, tone: 'bg-teal-500/15 text-teal-700' },
  دفعة: { icon: <Wallet className="size-4" />, tone: 'bg-emerald-500/15 text-emerald-700' },
}

export type KindFilter = PaymentKind | 'all'

export const KIND_FILTERS: { id: KindFilter; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'كشف', label: 'كشف' },
  { id: 'علاج', label: 'علاج' },
  { id: 'دفعة', label: 'من الباقي' },
]

/** النهاردة / امبارح / الخميس، 1 أكتوبر */
export function dayTitle(ms: number) {
  const key = dayKey(new Date(ms))
  if (key === dayKey()) return 'النهاردة'
  if (key === dayKey(new Date(Date.now() - 864e5))) return 'امبارح'
  return formatArabicWeekday(new Date(ms))
}

/** 5:31 م */
export function timeLabel(ms: number) {
  return new Date(ms).toLocaleTimeString('ar-EG', {
    numberingSystem: 'latn',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function groupByDay<T>(items: T[], at: (item: T) => number) {
  const groups: { key: string; label: string; items: T[] }[] = []
  for (const item of items) {
    const ms = at(item)
    const key = ms ? dayKey(new Date(ms)) : '—'
    let group = groups.find((g) => g.key === key)
    if (!group) {
      group = { key, label: ms ? dayTitle(ms) : 'من غير تاريخ', items: [] }
      groups.push(group)
    }
    group.items.push(item)
  }
  return groups
}

export function KindFilterTabs({
  value,
  onChange,
  payments,
}: {
  value: KindFilter
  onChange: (v: KindFilter) => void
  payments: Payment[]
}) {
  return (
    <div className="grid grid-cols-4 gap-1 rounded-xl bg-muted/70 p-1 max-sm:w-full sm:flex">
      {KIND_FILTERS.map((f) => {
        const count = f.id === 'all' ? payments.length : payments.filter((p) => p.kind === f.id).length
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onChange(f.id)}
            className={cn(
              'min-h-8 whitespace-nowrap rounded-lg px-2 text-xs font-semibold transition sm:px-2.5',
              value === f.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            {f.label}
            {count ? <span className="ms-1 text-[10px] opacity-70">{count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

/** دفعات متجمعة باليوم — كل يوم ومجموعه */
export function PaymentList({
  payments,
  dayHeaders = true,
  nameOf = (p) => p.patient,
  twoColumns = false,
  className,
}: {
  payments: Payment[]
  dayHeaders?: boolean
  nameOf?: (p: Payment) => string
  /** الأيام تتوزع على عمودين في الشاشات الكبيرة */
  twoColumns?: boolean
  className?: string
}) {
  return (
    <div className={cn('grid grid-cols-1 content-start items-start gap-3', twoColumns && 'lg:grid-cols-2', className)}>
      {groupByDay(payments, (p) => p.createdAt ?? 0).map((group) => (
        <div key={group.key}>
          {dayHeaders ? (
            <p className="mb-1.5 flex items-center justify-between text-xs font-bold text-muted-foreground">
              <span>{group.label}</span>
              <span className="text-success">{money(group.items.reduce((s, p) => s + p.amount, 0))}</span>
            </p>
          ) : null}
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
            {group.items.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                <span className={cn('grid size-9 shrink-0 place-items-center rounded-full', KIND_STYLE[p.kind].tone)}>
                  {KIND_STYLE[p.kind].icon}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    to="/patients/$patientId"
                    params={{ patientId: p.patientId }}
                    className="block truncate text-sm font-semibold hover:text-primary"
                  >
                    {nameOf(p) || 'مريض محذوف'}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {[
                      KIND_LABEL[p.kind],
                      p.note,
                      p.method && p.method !== 'نقدي' ? p.method : '',
                      p.by ? `بواسطة ${actorLabel(p.by)}` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <div className="shrink-0 text-end">
                  <p className="font-display text-sm font-semibold text-success">+{money(p.amount)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {p.createdAt ? timeLabel(p.createdAt) : withWeekday(p.date, p.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
