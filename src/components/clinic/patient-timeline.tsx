import { useMemo, useState, type ReactNode } from 'react'
import { CalendarCheck, CalendarPlus, CalendarX, CheckCircle2, ChevronDown, Stethoscope, UserPlus, Wallet } from 'lucide-react'
import { splitReasons } from '@/components/clinic/reason-select'
import { actorLabel } from '@/lib/auth-context'
import { usePatientAppointments, usePatientPayments, usePatientVisits } from '@/lib/clinic-hooks'
import { formatArabicWeekday, groupByDay, money, parseDayKey, timeLabel } from '@/lib/format'
import { NEW_PATIENT_FEE_NAME, patientBalance } from '@/lib/pricing'
import { cn } from '@/lib/utils'
import type { ClinicAppointment, Patient, Payment, Visit } from '@/types'

type TimelineEvent = {
  id: string
  at: number
  /** لو حدثين في نفس اللحظة: الأكبر يظهر فوق */
  order: number
  icon: ReactNode
  tone: string
  title: string
  detail?: string | undefined
  amount?: string | undefined
  amountTone?: string | undefined
  /** اللي فاضل عليه بعد الحدث ده */
  balance?: number | undefined
  by?: string | undefined
  fallbackDate?: string | undefined
  highlight?: boolean | undefined
}

export function PatientTimeline({ patient, limit = 0 }: { patient: Patient; limit?: number }) {
  const { data: visits = [], isLoading: visitsLoading } = usePatientVisits(patient.id)
  const { data: payments = [], isLoading: paymentsLoading } = usePatientPayments(patient.id)
  const { data: appointments = [] } = usePatientAppointments(patient.id)
  const [showAll, setShowAll] = useState(false)

  const events = useMemo(
    () => buildEvents(patient, visits, payments, appointments),
    [patient, visits, payments, appointments],
  )

  if (visitsLoading || paymentsLoading) {
    return (
      <div className="grid gap-2">
        <div className="h-14 animate-pulse rounded-xl bg-muted" />
        <div className="h-14 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
        لسه مفيش حاجة متسجلة للمريض ده
      </p>
    )
  }

  const shown = limit > 0 && !showAll ? events.slice(0, limit) : events

  return (
    <div className="grid gap-3">
      {groupByDay(shown, (e) => e.at, (e) => e.fallbackDate ?? '').map((group) => (
        <section key={group.key}>
          <p className="mb-1.5 text-xs font-bold text-muted-foreground">{group.label}</p>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
            {group.items.map((e) => (
              <li key={e.id} className={cn('flex items-center gap-3 px-3 py-2', e.highlight && 'bg-success/5')}>
                <span className={cn('grid size-8 shrink-0 place-items-center rounded-full', e.tone)}>{e.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className={cn('text-sm font-semibold', e.highlight && 'text-success')}>{e.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {[e.detail, e.by ? `بواسطة ${actorLabel(e.by)}` : ''].filter(Boolean).join(' · ')}
                    {e.balance !== undefined ? (
                      <span className={cn('font-semibold', e.balance > 0 ? 'text-warning' : 'text-success')}>
                        {e.detail || e.by ? ' · ' : ''}
                        {e.balance > 0 ? `لسه عليه ${money(e.balance)}` : 'حسابه خالص'}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="shrink-0 text-end">
                  {e.amount ? (
                    <p className={cn('font-display text-sm font-semibold', e.amountTone)}>{e.amount}</p>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground">{e.at ? timeLabel(e.at) : ''}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {limit > 0 && events.length > limit ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="inline-flex items-center justify-center gap-1 rounded-xl py-1.5 text-xs font-semibold text-primary hover:bg-primary/5"
        >
          {showAll ? 'عرض أقل' : `عرض كل السجل (${events.length})`}
          <ChevronDown className={cn('size-3.5 transition-transform', showAll && 'rotate-180')} />
        </button>
      ) : null}
    </div>
  )
}

function dayLabel(key: string) {
  return formatArabicWeekday(parseDayKey(key))
}

function buildEvents(
  patient: Patient,
  visits: Visit[],
  payments: Payment[],
  appointments: ClinicAppointment[],
): TimelineEvent[] {
  const events: TimelineEvent[] = []

  if (patient.createdAt) {
    events.push({
      id: `patient-${patient.id}`,
      at: patient.createdAt,
      order: 0,
      icon: <UserPlus className="size-4" />,
      tone: 'bg-indigo-500/15 text-indigo-700',
      title: 'أول مرة يجي العيادة',
      detail: patient.problem ? `جه عشان: ${patient.problem}` : undefined,
      by: patient.by,
    })
  }

  // الفلوس بالترتيب عشان نعرف كان عليه كام بعد كل حركة وإمتى خلّص
  const moneyEvents: Array<{ event: TimelineEvent; delta: number }> = []
  for (const v of visits) {
    const paid = v.paidToday ?? 0
    const name = splitReasons(v.treatment).join(' + ') || v.treatment || NEW_PATIENT_FEE_NAME
    const parts: string[] = []
    if (v.price > 0) {
      parts.push(paid >= v.price ? 'دفعه كله' : paid > 0 ? `دفع ${money(paid)}` : 'مدفعش حاجة')
    } else {
      parts.push('من غير سعر')
    }
    if (v.discountPercent) parts.push(`خصم ${v.discountPercent}%`)
    if (v.notes) parts.push(v.notes)
    moneyEvents.push({
      delta: v.price - paid,
      event: {
        id: `visit-${v.id}`,
        at: v.createdAt ?? 0,
        order: 1,
        icon: <Stethoscope className="size-4" />,
        tone: 'bg-sky-500/15 text-sky-700',
        title: name === NEW_PATIENT_FEE_NAME ? 'كشف' : `عمل ${name}`,
        detail: parts.join(' · '),
        amount: v.price > 0 ? money(v.price) : undefined,
        by: v.by,
        fallbackDate: v.date,
      },
    })
  }
  for (const x of payments) {
    if (x.kind !== 'دفعة') continue
    moneyEvents.push({
      delta: -x.amount,
      event: {
        id: `payment-${x.id}`,
        at: x.createdAt ?? 0,
        order: 2,
        icon: <Wallet className="size-4" />,
        tone: 'bg-emerald-500/15 text-emerald-700',
        title: 'دفع فلوس',
        detail: [x.note || 'من الباقي', x.method && x.method !== 'نقدي' ? x.method : ''].filter(Boolean).join(' · '),
        amount: `+${money(x.amount)}`,
        amountTone: 'text-success',
        by: x.by,
        fallbackDate: x.date,
      },
    })
  }

  moneyEvents.sort((a, b) => a.event.at - b.event.at || a.event.order - b.event.order)
  const finalBalance = moneyEvents.reduce((s, { delta }) => Math.max(0, s + delta), 0)
  // ملفات قديمة حسابها متسجل من غير زيارات — الباقي بعد كل حركة هيطلع غلط فمش بنعرضه
  const trustBalance = finalBalance === patientBalance(patient)
  let balance = 0
  for (const { event, delta } of moneyEvents) {
    const before = balance
    balance = Math.max(0, balance + delta)
    events.push(trustBalance ? { ...event, balance } : event)
    if (trustBalance && before > 0 && balance === 0) {
      events.push({
        id: `settled-${event.id}`,
        at: event.at,
        order: event.order + 0.5,
        icon: <CheckCircle2 className="size-4" />,
        tone: 'bg-success/15 text-success',
        title: 'خلّص كل الفلوس اللي عليه',
        highlight: true,
        fallbackDate: event.fallbackDate,
      })
    }
  }

  for (const a of appointments) {
    events.push({
      id: `appt-${a.id}`,
      at: a.createdAt,
      order: 3,
      icon: <CalendarPlus className="size-4" />,
      tone: 'bg-violet-500/15 text-violet-700',
      title: 'حجز ميعاد',
      detail: [`يوم ${dayLabel(a.date)}`, a.note].filter(Boolean).join(' · '),
      by: a.by,
    })
    if (a.status !== 'upcoming') {
      const arrived = a.status === 'arrived'
      events.push({
        id: `appt-status-${a.id}`,
        at: a.updatedAt || parseDayKey(a.date).getTime(),
        order: 4,
        icon: arrived ? <CalendarCheck className="size-4" /> : <CalendarX className="size-4" />,
        tone: arrived ? 'bg-teal-500/15 text-teal-700' : 'bg-rose-500/15 text-rose-700',
        title: arrived ? 'جه في ميعاده' : 'الميعاد اتلغى',
        detail: `ميعاد يوم ${dayLabel(a.date)}`,
      })
    }
  }

  return events.sort((a, b) => b.at - a.at || b.order - a.order)
}
