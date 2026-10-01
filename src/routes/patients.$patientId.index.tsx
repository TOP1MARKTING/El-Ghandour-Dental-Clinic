import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { FormEvent, useState, type ReactNode } from 'react'
import {
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  MapPin,
  NotebookPen,
  Phone,
  Stethoscope,
  Trash2,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { errorText } from '@/lib/api-errors'
import { dayKey, money, withWeekday } from '@/lib/format'
import {
  useCreatePayment,
  useCreateVisit,
  useDeletePatient,
  useIsAdmin,
  usePatient,
  usePatientAppointments,
  usePatientPayments,
  usePatientVisits,
  useTodayQueue,
} from '@/lib/clinic-hooks'
import {
  AppointmentForm,
  daysUntilLabel,
  formatAppointmentDay,
  formatAppointmentTime,
} from '@/components/clinic/appointments'
import { PageSurface } from '@/components/clinic/app-shell'
import { EmptyState, LoadingSkeleton } from '@/components/clinic/ui'
import { ChargeFields, useChargeForm } from '@/components/clinic/charge-fields'
import { inputClass } from '@/components/clinic/form-layout'
import { ToothIcon } from '@/components/clinic/dental-icons'
import { PatientTimeline } from '@/components/clinic/patient-timeline'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { ClinicAppointment, Patient, Payment, Visit } from '@/types'

export const Route = createFileRoute('/patients/$patientId/')({
  head: () => ({
    meta: [
      { title: 'ملف المريض — عيادة الغندور' },
      { name: 'description', content: 'بيانات المريض وسجل العلاج والحساب.' },
      { property: 'og:title', content: 'ملف المريض — عيادة الغندور' },
      { property: 'og:description', content: 'بيانات المريض وسجل العلاج والحساب.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: Profile,
})

function Profile() {
  const { patientId } = Route.useParams()
  const { data: p, isLoading, isError } = usePatient(patientId)
  const { data: visits = [] } = usePatientVisits(patientId)
  if (isLoading) {
    return (
      <PageSurface>
        <LoadingSkeleton rows={6} />
      </PageSurface>
    )
  }

  if (isError || !p) {
    return (
      <PageSurface>
        <EmptyState
          title="ملف المريض غير موجود"
          action={
            <Button asChild>
              <Link to="/patients">رجوع للمرضى</Link>
            </Button>
          }
        />
      </PageSurface>
    )
  }

  return (
    <PageSurface>
      <ProfileHeader patient={p} />

      <div className="mt-3 grid items-start gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_250px] xl:grid-cols-[minmax(0,1fr)_300px]">
        <PatientTabs patient={p} visits={visits} />
        <aside className="max-lg:order-first">
          <AccountCard patient={p} />
        </aside>
      </div>
    </PageSurface>
  )
}

type TabId = 'new' | 'history' | 'appointments'

function PatientTabs({ patient, visits }: { patient: Patient; visits: Visit[] }) {
  const patientId = patient.id
  const [tab, setTab] = useState<TabId>('new')
  const [formKey, setFormKey] = useState(0)
  const { data: payments = [], isLoading: paymentsLoading } = usePatientPayments(patientId)
  const upcoming = useUpcomingPatientAppointments(patientId)

  const tabs: { id: TabId; label: string; icon: ReactNode; count?: number }[] = [
    { id: 'appointments', label: 'المواعيد', icon: <CalendarDays className="size-4" />, count: upcoming.length },
    { id: 'new', label: 'علاج جديد', icon: <NotebookPen className="size-4" /> },
    { id: 'history', label: 'السجل', icon: <ToothIcon className="size-4" />, count: visits.length },
  ]

  return (
    <section className="glass overflow-hidden rounded-2xl">
      <div className="flex gap-1 border-b border-border bg-muted/40 p-1.5" role="tablist">
        {tabs.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-semibold transition max-sm:min-h-14 max-sm:flex-col max-sm:gap-0.5 max-sm:px-1 max-sm:text-xs',
                active ? 'surface-ink text-white shadow-clinic' : 'text-muted-foreground hover:bg-card hover:text-foreground',
              )}
            >
              {t.icon}
              <span className="truncate">{t.label}</span>
              {t.count ? (
                <span
                  className={cn(
                    'rounded-full px-1.5 text-[11px] leading-5',
                    active ? 'bg-white/20 text-white' : 'bg-card text-muted-foreground',
                  )}
                >
                  {t.count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="p-3.5 sm:p-5">
        {tab === 'new' ? (
          <AddTreatmentForm
            key={formKey}
            patientId={patientId}
            onSaved={() => {
              setFormKey((k) => k + 1)
              setTab('history')
            }}
          />
        ) : tab === 'history' ? (
          <PatientHistory
            patient={patient}
            visits={visits}
            payments={payments}
            paymentsLoading={paymentsLoading}
            onAdd={() => setTab('new')}
          />
        ) : (
          <AppointmentsPanel patientId={patientId} upcoming={upcoming} />
        )}
      </div>
    </section>
  )
}

function ProfileHeader({ patient: p }: { patient: Patient }) {
  const isAdmin = useIsAdmin()
  const initials = p.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join(' ')

  return (
    <section className="glass rounded-2xl p-3.5 sm:p-4">
      <div className="flex items-start gap-3 sm:items-center sm:gap-4">
        <div className="surface-ink grid size-12 shrink-0 place-items-center rounded-2xl font-display text-lg font-bold text-white shadow-clinic sm:size-14">
          {initials || <UserRound className="size-6" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 text-xl font-bold leading-snug sm:truncate sm:text-2xl">{p.name}</h1>
            {p.problem ? (
              <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
                <ToothIcon className="size-3.5 shrink-0" />
                <span className="truncate">{p.problem}</span>
              </span>
            ) : null}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground sm:gap-x-4 sm:text-sm">
            {p.phone ? (
              <a href={`tel:${p.phone}`} dir="ltr" className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary">
                <Phone className="size-3.5 text-primary" />
                {p.phone}
              </a>
            ) : null}
            {p.age ? (
              <span className="inline-flex items-center gap-1">
                <UserRound className="size-3.5 text-primary" />
                {p.age} سنة
              </span>
            ) : null}
            {p.address ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5 text-primary" />
                {p.address}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5 text-primary" />
              {p.lastVisit ? `آخر زيارة: ${p.lastVisit}` : `مسجّل من ${withWeekday(p.registeredAt, p.createdAt)}`}
            </span>
          </p>
        </div>

        <div className="-me-1 -mt-1 flex shrink-0 items-center sm:m-0 sm:gap-1">
          <Button asChild variant="ghost" className="size-10 rounded-xl px-0 text-muted-foreground sm:w-auto sm:px-3">
            <Link to="/patients" aria-label="رجوع للمرضى">
              <ArrowRight className="size-4" />
              <span className="max-sm:hidden">المرضى</span>
            </Link>
          </Button>
          {isAdmin ? <DeletePatient id={p.id} name={p.name} /> : null}
        </div>
      </div>
    </section>
  )
}

function AccountCard({ patient: p }: { patient: Patient }) {
  const remaining = Math.max(0, p.total - p.paid)
  const next = useUpcomingPatientAppointments(p.id)[0]

  return (
    <section className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="border-s-4 border-emerald-500 ps-2.5 font-bold">الحساب</h2>
        {p.total > 0 && remaining === 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
            <CheckCircle2 className="size-3.5" />
            خالص
          </span>
        ) : null}
      </div>

      <div
        className={cn(
          'mt-3 rounded-2xl border p-3 text-center sm:p-3.5',
          remaining > 0
            ? 'border-amber-200 bg-gradient-to-br from-amber-50 to-white'
            : 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white',
        )}
      >
        <p className="text-xs font-semibold text-muted-foreground">لسه عليه</p>
        <p
          className={cn(
            'font-display mt-0.5 text-2xl font-semibold sm:mt-1 sm:text-3xl',
            remaining > 0 ? 'text-warning' : 'text-success',
          )}
        >
          {money(remaining)}
        </p>
      </div>

      <TodayStatus patient={p} />

      <dl className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border/70 px-3 py-2">
          <dt className="text-[11px] font-semibold text-muted-foreground">الإجمالي</dt>
          <dd className="font-display font-semibold">{money(p.total)}</dd>
        </div>
        <div className="rounded-xl border border-border/70 px-3 py-2">
          <dt className="text-[11px] font-semibold text-muted-foreground">المدفوع</dt>
          <dd className="font-display font-semibold text-success">{money(p.paid)}</dd>
        </div>
      </dl>

      {next ? (
        <p className="mt-2 flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground">
          <CalendarDays className="size-4 shrink-0" />
          الموعد الجاي: {formatAppointmentDay(next.date)}
          {next.time ? ` · ${formatAppointmentTime(next.time)}` : ''}
        </p>
      ) : null}

      {remaining > 0 ? <QuickCollect patientId={p.id} remaining={remaining} patientName={p.name} /> : null}
    </section>
  )
}

/** المريض جاي النهاردة يعمل إيه — من دور النهاردة */
function TodayStatus({ patient: p }: { patient: Patient }) {
  const { data: queue = [] } = useTodayQueue()
  const entry = queue.filter((q) => q.patientId === p.id && q.status !== 'ملغي').at(-1)
  if (!entry) return null

  const reason = entry.reason.trim()
  const action =
    entry.kind === 'new' || reason.includes('كشف') ? 'هيكشف' : reason === 'متابعة' || !reason ? 'متابعة' : `هيعمل ${reason}`
  const status =
    entry.status === 'في الانتظار'
      ? `مستني دوره (رقم ${entry.order})`
      : entry.status === 'عند الدكتور'
        ? 'عند الدكتور دلوقتي'
        : entry.status === 'بانتظار الحساب'
          ? 'خلّص — مستني الحساب'
          : 'خلّص النهاردة'

  return (
    <div className="mt-2 flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
        <Stethoscope className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-primary">{action}</p>
        <p className="text-[11px] font-semibold text-muted-foreground">النهاردة · {status}</p>
      </div>
    </div>
  )
}

function AddTreatmentForm({ patientId, onSaved }: { patientId: string; onSaved: () => void }) {
  const create = useCreateVisit()
  const form = useChargeForm()

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (create.isPending) return
    const { charge, paidN } = form
    if (!form.treatment) {
      toast.error('اختار نوع العلاج')
      return
    }
    if (charge.base <= 0) {
      toast.error(form.isAdmin ? 'أدخل سعر العلاج' : 'الخدمة دي مالهاش سعر — الدكتور يحدده من صفحة الأسعار')
      return
    }
    if (paidN > charge.final) {
      toast.error('المدفوع النهاردة أكبر من الإجمالي بعد الخصم')
      return
    }
    try {
      await create.mutateAsync({
        patientId,
        treatment: form.treatment,
        basePrice: charge.base,
        discountPercent: form.discount,
        paidToday: paidN,
      })
      toast.success('تم تسجيل العلاج والدفعة ✅')
      onSaved()
    } catch (err) {
      toast.error(errorText(err, 'حصل خطأ أثناء الحفظ'))
    }
  }

  return (
    <form onSubmit={submit} className="@container grid gap-3">
      <div className="grid gap-3 @xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] @xl:items-start">
        <ChargeFields
          form={form}
          treatmentLabel="اللي اتعمل"
          treatmentClassName="@xl:col-span-1"
          panelClassName="@xl:col-span-1"
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" className="h-11 w-full rounded-xl sm:h-10 sm:w-auto sm:min-w-44" disabled={create.isPending}>
          <NotebookPen className="size-4" />
          {create.isPending ? 'جاري الحفظ...' : 'حفظ العلاج والدفعة'}
        </Button>
      </div>
    </form>
  )
}

/** كل اللي حصل للمريض في خط زمني واحد: علاج، دفعات، مواعيد، وإمتى خلّص حسابه */
function PatientHistory({
  patient,
  visits,
  payments,
  paymentsLoading,
  onAdd,
}: {
  patient: Patient
  visits: Visit[]
  payments: Payment[]
  paymentsLoading: boolean
  onAdd: () => void
}) {
  const paidTotal = payments.reduce((s, x) => s + x.amount, 0)

  if (visits.length === 0 && payments.length === 0 && !paymentsLoading) {
    return (
      <div className="grid place-items-center py-10 text-center">
        <div className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
          <ToothIcon className="size-6" />
        </div>
        <p className="mt-3 text-sm font-semibold">لسه مفيش علاج متسجل</p>
        <Button variant="outline" className="mt-3 h-10 rounded-xl" onClick={onAdd}>
          <NotebookPen className="size-4" />
          سجّل أول علاج
        </Button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-muted px-3 py-1">
          {visits.length} {visits.length === 1 ? 'علاج' : 'علاجات'}
        </span>
        {paidTotal > 0 ? (
          <span className="rounded-full bg-success/10 px-3 py-1 text-success">دفع {money(paidTotal)}</span>
        ) : null}
      </div>
      <div className="max-h-[36rem] overflow-auto pe-1">
        <PatientTimeline patient={patient} />
      </div>
    </div>
  )
}

function useUpcomingPatientAppointments(patientId: string) {
  const { data: appointments = [] } = usePatientAppointments(patientId)
  const today = dayKey()
  return appointments
    .filter((a) => a.status === 'upcoming' && a.date >= today)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
}

function AppointmentsPanel({ patientId, upcoming }: { patientId: string; upcoming: ClinicAppointment[] }) {
  return (
    <div className="grid gap-4">
      {upcoming.length > 0 ? (
        <section className="rounded-2xl border border-violet-500/30 bg-gradient-to-l from-violet-500/15 to-fuchsia-500/10 p-3">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-violet-800">
            <CalendarDays className="size-4" />
            {upcoming.length === 1 ? 'عنده ميعاد جاي' : `عنده ${upcoming.length} مواعيد جاية`}
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {upcoming.map((a) => (
              <li key={a.id} className="flex items-center gap-2.5 rounded-xl bg-card/90 px-3 py-2.5 shadow-sm">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-600 text-white">
                  <CalendarDays className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    {formatAppointmentDay(a.date)}
                    {a.time ? ` · ${formatAppointmentTime(a.time)}` : ''}
                  </p>
                  {a.note ? <p className="truncate text-xs text-muted-foreground">{a.note}</p> : null}
                </div>
                {daysUntilLabel(a.date) ? (
                  <span className="shrink-0 rounded-full bg-violet-600/10 px-2.5 py-1 text-xs font-bold text-violet-700">
                    {daysUntilLabel(a.date)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div>
        <h3 className="mb-2.5 flex items-center gap-2 text-sm font-bold">
          <CalendarPlus className="size-4 text-primary" />
          حجز موعد متابعة
        </h3>
        <AppointmentForm patientId={patientId} />
      </div>
    </div>
  )
}

function QuickCollect({
  patientId,
  remaining,
  patientName,
}: {
  patientId: string
  remaining: number
  patientName: string
}) {
  const create = useCreatePayment()
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    const value = Number(amount || 0)
    if (value <= 0) {
      toast.error('أدخل المبلغ المدفوع')
      return
    }
    if (value > remaining) {
      toast.error('المبلغ أكبر من الباقي')
      return
    }
    setSaving(true)
    try {
      await create.mutateAsync({
        patientId,
        amount: value,
        method: 'نقدي',
      })
      toast.success(`تم تحصيل ${money(value)} من ${patientName}`)
      setAmount('')
    } catch {
      toast.error('حصل خطأ أثناء التحصيل')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 border-t border-border/70 pt-3">
      <p className="mb-1.5 text-sm font-semibold">دفع من الباقي</p>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            className={cn(inputClass, 'pl-14')}
            type="number"
            min="1"
            max={remaining}
            step="1"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            aria-label="المبلغ"
          />
          <button
            type="button"
            onClick={() => setAmount(String(remaining))}
            className="absolute left-1.5 top-1/2 h-8 -translate-y-1/2 rounded-lg bg-primary/10 px-2.5 text-xs font-semibold text-primary"
          >
            الكل
          </button>
        </div>
        <Button type="submit" disabled={saving} className="h-11 shrink-0 rounded-xl px-5 sm:h-10">
          {saving ? 'جاري...' : 'دفع'}
        </Button>
      </div>
    </form>
  )
}

function DeletePatient({ id, name }: { id: string; name: string }) {
  const nav = useNavigate()
  const remove = useDeletePatient()

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className="size-10 rounded-xl px-0 text-destructive hover:bg-rose-50 hover:text-destructive" aria-label="حذف المريض">
          <Trash2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="rounded-3xl">
        <DialogHeader className="text-right">
          <DialogTitle>هل أنت متأكد من حذف {name}؟</DialogTitle>
          <DialogDescription>هيتمسح الملف وسجل العلاج والدفعات نهائياً.</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:flex-row-reverse">
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={async () => {
              try {
                await remove.mutateAsync(id)
                toast.success('تم حذف المريض')
                void nav({ to: '/patients' })
              } catch {
                toast.error('حصل خطأ أثناء الحذف')
              }
            }}
          >
            حذف
          </Button>
          <DialogClose asChild>
            <Button variant="outline">إلغاء</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
