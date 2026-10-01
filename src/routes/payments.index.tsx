import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { money, startOfDay, startOfMonth, startOfWeek } from '@/lib/format'
import { usePatients, usePayments } from '@/lib/clinic-hooks'
import { PageSurface } from '@/components/clinic/app-shell'
import { AdminOnly } from '@/components/clinic/admin-only'
import { KindFilterTabs, PaymentList, type KindFilter } from '@/components/clinic/payment-list'
import { EmptyState, LoadingSkeleton, PageHeader, SearchBar } from '@/components/clinic/ui'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Payment } from '@/types'

export const Route = createFileRoute('/payments/')({
  head: () => ({
    meta: [
      { title: 'الدفعات — عيادة الغندور' },
      { name: 'description', content: 'سجل الدفعات والتحصيل.' },
      { property: 'og:title', content: 'الدفعات — عيادة الغندور' },
      { property: 'og:description', content: 'سجل الدفعات والتحصيل.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: () => (
    <AdminOnly>
      <Payments />
    </AdminOnly>
  ),
})

function Payments() {
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<KindFilter>('all')
  const { data: payments = [], isLoading, isError, refetch } = usePayments()
  const { data: patients = [] } = usePatients()
  const byId = useMemo(() => Object.fromEntries(patients.map((p) => [p.id, p.name])), [patients])
  const nameOf = (p: Payment) => byId[p.patientId] ?? p.patient

  const searched = useMemo(() => {
    const term = q.trim()
    if (!term) return payments
    return payments.filter((x) =>
      [byId[x.patientId] ?? x.patient, x.note ?? '', x.method].some((field) => field.includes(term)),
    )
  }, [payments, byId, q])

  const periods = useMemo(() => {
    const now = new Date()
    const sum = (from: number) => payments.reduce((s, p) => ((p.createdAt ?? 0) >= from ? s + p.amount : s), 0)
    return (
      [
        { id: 'day', label: 'النهاردة', from: startOfDay(now).getTime() },
        { id: 'week', label: 'الأسبوع ده', from: startOfWeek(now).getTime() },
        { id: 'month', label: 'الشهر ده', from: startOfMonth(now).getTime() },
        { id: 'all', label: 'الكل', from: 0 },
      ] as const
    ).map((p) => ({ ...p, total: sum(p.from) }))
  }, [payments])
  const [periodId, setPeriodId] = useState<(typeof periods)[number]['id']>('week')
  const from = periods.find((p) => p.id === periodId)?.from ?? 0
  const inPeriod = from ? searched.filter((x) => (x.createdAt ?? 0) >= from) : searched
  const list = kind === 'all' ? inPeriod : inPeriod.filter((x) => x.kind === kind)

  return (
    <PageSurface className="flex h-auto flex-col lg:h-full lg:overflow-hidden">
      <PageHeader
        title="الدفعات"
        description="كل الفلوس اللي اتحصّلت من المرضى"
        action={
          <Button asChild>
            <Link to="/payments/new">
              <Plus />
              تسجيل دفعة
            </Link>
          </Button>
        }
      />

      <section className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {periods.map((p) => {
          const active = p.id === periodId
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriodId(p.id)}
              className={cn(
                'min-w-0 rounded-2xl px-3 py-2 text-start transition sm:px-4',
                active
                  ? 'surface-ink text-white shadow-clinic'
                  : 'border border-border/70 bg-card shadow-sm hover:border-primary/40',
              )}
            >
              <p className={cn('truncate text-xs font-semibold', active ? 'text-white/75' : 'text-muted-foreground')}>
                {p.id === 'all' ? 'كل اللي اتحصّل' : `اتحصّل ${p.label}`}
              </p>
              <p className={cn('font-display truncate text-lg font-bold', !active && 'text-success')}>
                {money(p.total)}
              </p>
            </button>
          )
        })}
      </section>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <SearchBar value={q} onChange={setQ} placeholder="ابحث باسم المريض أو الملاحظة" />
        </div>
        <KindFilterTabs value={kind} onChange={setKind} payments={inPeriod} />
      </div>

      {isLoading ? (
        <div className="mt-3">
          <LoadingSkeleton rows={5} />
        </div>
      ) : isError ? (
        <div className="mt-3">
          <EmptyState
            title="تعذر تحميل الدفعات من Firebase"
            action={<Button onClick={() => void refetch()}>إعادة المحاولة</Button>}
          />
        </div>
      ) : list.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            title={
              payments.length === 0
                ? 'لسه مفيش دفعات مسجّلة'
                : q || kind !== 'all'
                  ? 'مفيش دفعات بالشكل ده'
                  : `مفيش دفعات ${periods.find((p) => p.id === periodId)?.label ?? ''}`
            }
            action={
              payments.length === 0 ? (
                <Button asChild>
                  <Link to="/payments/new">تسجيل دفعة</Link>
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <PaymentList
          payments={list}
          nameOf={nameOf}
          twoColumns
          className="mt-3 min-h-0 flex-1 overflow-auto pe-1"
        />
      )}
    </PageSurface>
  )
}
