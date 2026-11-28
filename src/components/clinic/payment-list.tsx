import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Ban, Stethoscope, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { ToothIcon } from '@/components/clinic/dental-icons'
import { actorLabel } from '@/lib/auth-context'
import { errorText } from '@/lib/api-errors'
import { useCancelPayment, useIsAdmin } from '@/lib/clinic-hooks'
import { groupByDay, money, timeLabel, withWeekday } from '@/lib/format'
import { cn } from '@/lib/utils'
import { isActivePayment } from '@/lib/clinic-api'
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
  allowCancel = false,
}: {
  payments: Payment[]
  dayHeaders?: boolean
  nameOf?: (p: Payment) => string
  /** الأيام تتوزع على عمودين في الشاشات الكبيرة */
  twoColumns?: boolean
  className?: string
  allowCancel?: boolean
}) {
  return (
    <div className={cn('grid grid-cols-1 content-start items-start gap-3', twoColumns && 'lg:grid-cols-2', className)}>
      {groupByDay(payments, (p) => p.createdAt ?? 0).map((group) => (
        <div key={group.key}>
          {dayHeaders ? (
            <p className="mb-1.5 flex items-center justify-between text-xs font-bold text-muted-foreground">
              <span>{group.label}</span>
              <span className="text-success">
                {money(group.items.filter(isActivePayment).reduce((s, p) => s + p.amount, 0))}
              </span>
            </p>
          ) : null}
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
            {group.items.map((p) => {
              const cancelled = Boolean(p.cancelled)
              return (
              <li key={p.id} className={cn('flex items-center gap-3 px-3 py-2', cancelled && 'opacity-60')}>
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
                      cancelled ? 'ملغاة' : '',
                      p.note,
                      p.method && p.method !== 'نقدي' ? p.method : '',
                      p.by ? `بواسطة ${actorLabel(p.by)}` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <div className="shrink-0 text-end">
                  <p
                    className={cn(
                      'font-display text-sm font-semibold',
                      cancelled ? 'text-muted-foreground line-through' : 'text-success',
                    )}
                  >
                    +{money(p.amount)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {cancelled && p.cancelledAt
                      ? `اتلغت ${timeLabel(p.cancelledAt)}`
                      : p.createdAt
                        ? timeLabel(p.createdAt)
                        : withWeekday(p.date, p.createdAt)}
                  </p>
                </div>
                {allowCancel && !cancelled ? <CancelPaymentButton paymentId={p.id} amount={p.amount} /> : null}
              </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

function CancelPaymentButton({ paymentId, amount }: { paymentId: string; amount: number }) {
  const admin = useIsAdmin()
  const cancel = useCancelPayment()
  if (!admin) return null

  const run = async () => {
    if (!window.confirm(`تلغي الدفعة ${money(amount)}؟\nهتتشال من الدخل وهتفضل ظاهرة في السجل.`)) return
    try {
      await cancel.mutateAsync(paymentId)
      toast.success('اتلغت الدفعة ✅')
    } catch (err) {
      toast.error(errorText(err, 'حصل خطأ أثناء الإلغاء'))
    }
  }

  return (
    <button
      type="button"
      onClick={() => void run()}
      disabled={cancel.isPending}
      className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-rose-50 hover:text-destructive disabled:opacity-40"
      title="إلغاء الدفعة"
      aria-label="إلغاء الدفعة"
    >
      <Ban className="size-4" />
    </button>
  )
}
