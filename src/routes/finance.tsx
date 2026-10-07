import { createFileRoute } from '@tanstack/react-router'
import { ArabicDatePicker } from '@/components/clinic/appointments'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import type { PaymentKind } from '@/types'
import { FormEvent, useMemo, useState, type ReactNode } from 'react'
import { Clock3, PiggyBank, Plus, Receipt, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import { KindFilterTabs, PaymentList, type KindFilter } from '@/components/clinic/payment-list'
import { toast } from 'sonner'
import { errorText } from '@/lib/api-errors'
import { PageSurface } from '@/components/clinic/app-shell'
import { AdminOnly } from '@/components/clinic/admin-only'
import { inputClass } from '@/components/clinic/form-layout'
import { EmptyState, Field, LoadingSkeleton } from '@/components/clinic/ui'
import { Button } from '@/components/ui/button'
import {
  useClinicSettings,
  useCreateExpense,
  useDeleteExpense,
  useFinance,
  useOutstandingTotal,
  usePatients,
  useTodayKey,
} from '@/lib/clinic-hooks'
import { DEFAULT_DOCTOR, DOCTORS, type DoctorId } from '@/lib/doctors'
import { MoneyDonut, type DonutSlice } from '@/components/clinic/money-donut'
import {
  addDays,
  money,
  parseDayKey,
  relativeDayLabel,
  startOfDay,
  startOfMonth,
  startOfWeek,
  timeLabel,
  withWeekday,
} from '@/lib/format'
import { cn } from '@/lib/utils'

const DOCTOR_COLORS: Record<DoctorId, string> = { ashraf: '#2563eb', heba: '#ec4899' }

export const Route = createFileRoute('/finance')({
  head: () => ({
    meta: [
      { title: 'الخزنة — عيادة الغندور' },
      { name: 'description', content: 'الدخل والمصروفات والصافي يومي وأسبوعي وشهري.' },
    ],
  }),
  component: () => (
    <AdminOnly>
      <Finance />
    </AdminOnly>
  ),
})

const PERIODS = [
  { id: 'day', label: 'النهاردة', start: startOfDay },
  { id: 'week', label: 'الأسبوع', start: startOfWeek },
  { id: 'month', label: 'الشهر', start: startOfMonth },
] as const

type PeriodId = (typeof PERIODS)[number]['id'] | 'custom'

function StatCard({
  icon,
  tone,
  label,
  value,
  sub,
  className,
}: {
  icon: ReactNode
  tone: 'good' | 'bad' | 'warn'
  label: string
  value: string
  sub: string
  className?: string
}) {
  return (
    <div className={cn('min-w-0 rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-sm', className)}>
      <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-muted-foreground">
        <span
          className={cn(
            'grid size-6 shrink-0 place-items-center rounded-lg',
            tone === 'good' && 'bg-success/10 text-success',
            tone === 'bad' && 'bg-destructive/10 text-destructive',
            tone === 'warn' && 'bg-warning/10 text-warning',
          )}
        >
          {icon}
        </span>
        {label}
      </p>
      <p
        className={cn(
          'font-display mt-1 text-xl font-bold',
          tone === 'good' && 'text-success',
          tone === 'bad' && 'text-destructive',
          tone === 'warn' && 'text-warning',
        )}
      >
        {value}
      </p>
      <p className="truncate text-[11px] text-muted-foreground">{sub}</p>
    </div>
  )
}

function Finance() {
  const [period, setPeriod] = useState<PeriodId>('day')
  const todayKey = useTodayKey()
  const [customDay, setCustomDay] = useState(todayKey)
  const starts = useMemo(() => {
    const now = parseDayKey(todayKey)
    return Object.fromEntries(PERIODS.map((p) => [p.id, p.start(now).getTime()])) as Record<
      (typeof PERIODS)[number]['id'],
      number
    >
  }, [todayKey])
  const customStart = parseDayKey(customDay).getTime()
  const customEnd = addDays(parseDayKey(customDay), 1).getTime()

  const custom = period === 'custom'
  const { data, isLoading, isError, refetch } = useFinance(
    custom ? customStart : starts[period],
    custom ? customEnd : undefined,
  )
  const { data: outstanding, isError: outstandingFailed } = useOutstandingTotal()
  const { data: patients } = usePatients()
  const patientDoctor = useMemo(() => new Map((patients ?? []).map((p) => [p.id, p.doctor])), [patients])

  const stats = useMemo(() => {
    const from = period === 'custom' ? customStart : starts[period]
    const payments = (data?.payments ?? []).filter((p) => (p.createdAt ?? 0) >= from)
    const expenses = (data?.expenses ?? []).filter((x) => x.spentAt >= from)
    const visits = (data?.visits ?? []).filter((v) => (v.createdAt ?? 0) >= from)
    const income = payments.reduce((s, p) => s + p.amount, 0)
    const spent = expenses.reduce((s, x) => s + x.amount, 0)
    const discounts = visits.reduce((s, v) => s + Math.max(0, (v.basePrice ?? v.price) - v.price), 0)
    const byKind: Record<PaymentKind, number> = { كشف: 0, علاج: 0, دفعة: 0 }
    for (const p of payments) byKind[p.kind] += p.amount
    const byCategory = new Map<string, number>()
    for (const x of expenses) byCategory.set(x.category, (byCategory.get(x.category) ?? 0) + x.amount)
    const byDoctor: Record<DoctorId, number> = { ashraf: 0, heba: 0 }
    for (const p of payments) byDoctor[p.doctor ?? patientDoctor.get(p.patientId) ?? DEFAULT_DOCTOR] += p.amount
    return {
      income,
      spent,
      net: income - spent,
      discounts,
      byKind,
      byDoctor,
      payments,
      expenses,
      byCategory: [...byCategory.entries()].sort((a, b) => b[1] - a[1]),
    }
  }, [data, period, starts, customStart, patientDoctor])

  const donutSlices: DonutSlice[] = [
    ...DOCTORS.map((d): DonutSlice => {
      const value = stats.byDoctor[d.id]
      const slice: DonutSlice = { id: d.id, label: `دخل ${d.short}`, value, color: DOCTOR_COLORS[d.id] }
      if (stats.income > 0) slice.hint = `${Math.round((value / stats.income) * 100)}%`
      return slice
    }),
    { id: 'discounts', label: 'الخصومات', value: stats.discounts, color: '#f59e0b' },
    { id: 'expenses', label: 'المصروفات', value: stats.spent, color: '#ef4444' },
  ]

  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const shownPayments = kindFilter === 'all' ? stats.payments : stats.payments.filter((p) => p.kind === kindFilter)
  const periodLabel =
    period === 'custom'
      ? customDay === todayKey
        ? 'النهاردة'
        : `يوم ${relativeDayLabel(customStart)}`
      : period === 'day'
        ? 'النهاردة'
        : period === 'week'
          ? 'الأسبوع ده'
          : 'الشهر ده'

  return (
    <PageSurface className="flex h-auto flex-col lg:h-full lg:overflow-hidden">
      <header className="mb-3 flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight sm:text-[1.75rem]">الخزنة</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">دخل الكشف والعلاج، كل دفعة، والمصروفات — للدكتور بس</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="grid flex-1 grid-cols-4 gap-1 rounded-2xl bg-muted/70 p-1 lg:w-[26rem] lg:flex-none">
            {[...PERIODS, { id: 'custom' as const, label: 'يوم معين' }].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={cn(
                  'min-h-10 rounded-xl px-1 text-xs font-semibold transition sm:text-sm',
                  period === p.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {custom ? (
            <ArabicDatePicker past value={customDay} onChange={setCustomDay} className="w-full sm:w-56" />
          ) : null}
        </div>
      </header>

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : isError ? (
        <EmptyState
          title="تعذر تحميل الخزنة"
          action={<Button onClick={() => void refetch()}>إعادة المحاولة</Button>}
        />
      ) : (
        <>
          <section className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <div className="surface-ink col-span-2 rounded-2xl px-4 py-3 text-white shadow-clinic lg:col-span-1">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-white/75">
                <PiggyBank className="size-4" />
                الصافي {periodLabel}
              </p>
              <p className="font-display mt-1 text-2xl font-bold">{money(stats.net)}</p>
              <p className="mt-0.5 text-[11px] text-white/70">الدخل ناقص المصروفات</p>
            </div>
            <StatCard
              icon={<TrendingUp className="size-4" />}
              tone="good"
              label={`الدخل · ${stats.payments.length} دفعة`}
              value={money(stats.income)}
              sub={`كشف ${money(stats.byKind['كشف'])} · علاج ${money(stats.byKind['علاج'] + stats.byKind['دفعة'])}`}
            />
            <StatCard
              icon={<TrendingDown className="size-4" />}
              tone="bad"
              label={`المصروفات · ${stats.expenses.length}`}
              value={money(stats.spent)}
              sub={stats.byCategory[0] ? `أكتر حاجة: ${stats.byCategory[0][0]}` : 'مفيش مصروفات'}
            />
            <StatCard
              className="max-lg:col-span-2"
              icon={<Clock3 className="size-4" />}
              tone="warn"
              label="لسه عند المرضى"
              value={outstanding === undefined ? (outstandingFailed ? 'تعذر الحساب' : '…') : money(outstanding)}
              sub={stats.discounts > 0 ? `خصومات ${periodLabel}: ${money(stats.discounts)}` : 'كل الفلوس اللي لسه مادفعتش'}
            />
          </section>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <section className="glass flex min-h-0 flex-col rounded-2xl p-3.5 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">الدفعات</h2>
                <KindFilterTabs value={kindFilter} onChange={setKindFilter} payments={stats.payments} />
              </div>
              {shownPayments.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                  مفيش دفعات في الفترة دي
                </p>
              ) : (
                <PaymentList
                  payments={shownPayments}
                  dayHeaders={period !== 'day' && period !== 'custom'}
                  className="mt-3 min-h-0 flex-1 overflow-auto pe-1 max-lg:max-h-[28rem]"
                />
              )}
            </section>

            <div className="flex min-h-0 flex-col gap-3">
            <section className="glass shrink-0 rounded-2xl p-3.5 sm:p-4">
              <h2 className="mb-2 text-lg font-semibold">فلوس {periodLabel} على بعض</h2>
              <MoneyDonut slices={donutSlices} centerLabel="الدخل" centerValue={money(stats.income)} />
            </section>
            <section className="glass flex min-h-0 flex-1 flex-col rounded-2xl p-3.5 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">المصروفات</h2>
                <AddExpense />
              </div>
              {stats.byCategory.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {stats.byCategory.map(([cat, total]) => (
                    <span key={cat} className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
                      {cat} · {money(total)}
                    </span>
                  ))}
                </div>
              ) : null}
              {stats.expenses.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                  مفيش مصروفات في الفترة دي
                </p>
              ) : (
                <ul className="mt-3 min-h-0 divide-y divide-border/60 overflow-auto rounded-xl border border-border/60 bg-card max-lg:max-h-96">
                  {stats.expenses.map((x) => (
                    <ExpenseRow
                      key={x.id}
                      id={x.id}
                      category={x.category}
                      amount={x.amount}
                      note={x.note}
                      when={period === 'day' || period === 'custom' ? timeLabel(x.spentAt) : withWeekday(x.date, x.spentAt) || relativeDayLabel(x.spentAt)}
                    />
                  ))}
                </ul>
              )}
            </section>
            </div>
          </div>
        </>
      )}
    </PageSurface>
  )
}

function AddExpense() {
  const create = useCreateExpense()
  const [open, setOpen] = useState(false)
  const categories = useClinicSettings().settings.expenseCategories
  const [picked, setCategory] = useState('')
  const category = categories.includes(picked) ? picked : (categories[0] ?? 'أخرى')
  const today = useTodayKey()
  const [date, setDate] = useState(today)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formEl = e.currentTarget
    const data = new FormData(formEl)
    const dateStr = date || today
    const spentAt = dateStr === today ? new Date() : new Date(parseDayKey(dateStr).setHours(12))
    try {
      await create.mutateAsync({
        category,
        amount: Number(data.get('amount') || 0),
        note: String(data.get('note') ?? ''),
        spentAt,
      })
      toast.success('اتسجل المصروف واتخصم من الصافي ✅')
      formEl.reset()
      setDate(today)
      setOpen(false)
    } catch (err) {
      toast.error(errorText(err, 'حصل خطأ أثناء الحفظ'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-9 rounded-xl">
          <Plus className="size-4" />
          مصروف جديد
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-2xl" dir="rtl">
        <DialogHeader className="text-start">
          <DialogTitle>تسجيل مصروف</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid content-start gap-3">
          <Field dense label="النوع">
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    'min-h-10 rounded-xl border px-2 text-xs font-semibold transition',
                    category === c
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border/80 bg-muted/40 hover:border-primary/35',
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field dense label="المبلغ">
              <input className={inputClass} name="amount" type="number" min="1" step="1" required placeholder="0" />
            </Field>
            <div className="grid gap-1 text-sm font-semibold">
              التاريخ
              <ArabicDatePicker past value={date} onChange={setDate} />
            </div>
          </div>
          <Field dense label="ملاحظة" hint="اختياري">
            <input className={inputClass} name="note" placeholder="مثلاً: فاتورة المعمل لشهر 9" />
          </Field>
          <Button type="submit" className="h-11 rounded-xl" disabled={create.isPending}>
            <Plus />
            {create.isPending ? 'جاري الحفظ...' : 'خصم المصروف'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ExpenseRow({
  id,
  category,
  amount,
  note,
  when,
}: {
  id: string
  category: string
  amount: number
  note: string
  when: string
}) {
  const remove = useDeleteExpense()

  const del = async () => {
    if (!window.confirm(`حذف مصروف ${category} (${money(amount)})؟`)) return
    try {
      await remove.mutateAsync(id)
      toast.success('اتحذف المصروف')
    } catch (err) {
      toast.error(errorText(err, 'حصل خطأ أثناء الحذف'))
    }
  }

  return (
    <li className="group flex items-center gap-3 px-3 py-2">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
        <Receipt className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{category}</p>
        <p className="truncate text-xs text-muted-foreground">{note || 'من غير ملاحظة'}</p>
      </div>
      <div className="shrink-0 text-end">
        <p className="font-display text-sm font-semibold text-destructive">−{money(amount)}</p>
        <p className="text-[11px] text-muted-foreground">{when}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-9 shrink-0 rounded-xl text-muted-foreground hover:text-destructive"
        disabled={remove.isPending}
        onClick={() => void del()}
        aria-label="حذف المصروف"
      >
        <Trash2 className="size-4" />
      </Button>
    </li>
  )
}
