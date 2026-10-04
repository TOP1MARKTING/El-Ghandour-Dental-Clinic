import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, CalendarDays, CalendarPlus, Users, Wallet } from 'lucide-react'
import { PageSurface } from '@/components/clinic/app-shell'
import { EmptyState, LoadingSkeleton } from '@/components/clinic/ui'
import { Button } from '@/components/ui/button'
import { FollowupIcon, NewPatientIcon, ToothIcon } from '@/components/clinic/dental-icons'
import { useAuth } from '@/lib/auth-context'
import { useIsAdmin, usePayments, useTodayKey, useTodayQueue, useUpcomingAppointments } from '@/lib/clinic-hooks'
import { formatArabicWeekday, money, parseDayKey } from '@/lib/format'
import { AppointmentForm, AppointmentRow, formatAppointmentDay } from '@/components/clinic/appointments'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { apiErrorMessage } from '@/lib/api-errors'
import type { QueueEntry } from '@/types'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'الرئيسية — عيادة الغندور' },
      { name: 'description', content: 'حجز المرضى وترتيب الحضور داخل العيادة.' },
      { property: 'og:title', content: 'الرئيسية — عيادة الغندور' },
      { property: 'og:description', content: 'حجز المرضى وترتيب الحضور داخل العيادة.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: Home,
})

function Home() {
  return useIsAdmin() ? <DoctorHome /> : <ReceptionHome />
}

function useTodayVisitors() {
  const query = useTodayQueue()
  const visitors = useMemo(
    () => (query.data ?? []).filter((x) => x.status !== 'ملغي').sort((a, b) => b.order - a.order),
    [query.data],
  )
  return { ...query, visitors }
}

function useTodayAppointments() {
  const { data: appointments = [] } = useUpcomingAppointments()
  const todayKey = useTodayKey()
  return appointments.filter((a) => a.date === todayKey && a.status === 'upcoming')
}

function HomeHeader() {
  const { user } = useAuth()
  const greeting = new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير'
  return (
    <header className="mb-3.5 flex flex-wrap items-end justify-between gap-2 sm:mb-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted-foreground">
          {greeting}، {user?.name}
        </p>
        <h1 className="text-2xl font-bold leading-tight sm:text-[1.75rem]">الرئيسية</h1>
      </div>
      <span className="rounded-full border border-border/80 bg-card/80 px-3 py-1 text-xs font-semibold text-foreground/80 shadow-sm sm:px-3.5 sm:py-1.5 sm:text-sm">
        {formatArabicWeekday()}
      </span>
    </header>
  )
}

function BookingActions() {
  return (
    <div className="grid shrink-0 gap-2.5 sm:grid-cols-2">
      <ActionCard
        to="/check-in/new"
        primary
        icon={<NewPatientIcon className="size-6" strokeWidth={1.6} />}
        title="حجز مريض جديد"
        subtitle="أول مرة — تسجيل البيانات والكشف"
      />
      <ActionCard
        to="/check-in/followup"
        icon={<FollowupIcon className="size-6" strokeWidth={1.6} />}
        title="متابعة مريض"
        subtitle="جه قبل كده — بحث بالاسم أو الموبايل"
      />
    </div>
  )
}

/* ───────── رئيسية الدكتور ───────── */

function DoctorHome() {
  const { visitors } = useTodayVisitors()
  const todayKey = useTodayKey()
  const { data: payments = [], isLoading: financeLoading } = usePayments(parseDayKey(todayKey).getTime())
  const income = payments.reduce((s, p) => s + p.amount, 0)
  const todayAppointments = useTodayAppointments()
  const { data: allAppointments = [] } = useUpcomingAppointments()
  const nextAppointment = allAppointments.find((a) => a.status === 'upcoming' && a.date > todayKey)

  const newCount = visitors.filter((v) => v.kind === 'new').length

  return (
    <PageSurface className="flex h-auto flex-col lg:h-full lg:overflow-hidden">
      <HomeHeader />

      <div className="mb-3 grid shrink-0 grid-cols-2 gap-2.5 lg:grid-cols-3">
        <HomeStat
          dark
          icon={<Users className="size-4" />}
          label="جم النهاردة"
          value={`${visitors.length} ${visitors.length === 1 ? 'مريض' : 'مرضى'}`}
          sub={visitors.length ? `${newCount} جديد · ${visitors.length - newCount} متابعة` : 'لسه محدش جه'}
        />
        <HomeStat
          tone="good"
          icon={<Wallet className="size-4" />}
          label="فلوس النهاردة"
          value={financeLoading ? '…' : money(income)}
          sub={payments.length ? `${payments.length} دفعة` : 'لسه مفيش دفع'}
        />
        <HomeStat
          className="max-lg:col-span-2"
          tone="violet"
          icon={<CalendarDays className="size-4" />}
          label="مواعيد النهاردة"
          value={`${todayAppointments.length}`}
          sub={
            nextAppointment
              ? `الجاي: ${formatAppointmentDay(nextAppointment.date)}`
              : 'مفيش مواعيد جاية'
          }
        />
      </div>

      <BookingActions />

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        <section className="glass flex min-h-0 flex-1 flex-col rounded-2xl p-3">
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <h2 className="inline-flex items-center gap-1.5 font-semibold">
              <CalendarDays className="size-4 text-violet-600" />
              مواعيد النهاردة
            </h2>
            <div className="flex items-center gap-3">
              <Link to="/appointments" className="text-xs font-semibold text-primary hover:underline">
                كل المواعيد
              </Link>
              <AddAppointmentButton />
            </div>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-2 overflow-auto pe-1">
            {todayAppointments.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                مفيش مواعيد النهاردة
              </p>
            ) : (
              todayAppointments.map((a) => <AppointmentRow key={a.id} appointment={a} />)
            )}
          </div>
        </section>
      </div>
    </PageSurface>
  )
}

function HomeStat({
  icon,
  label,
  value,
  sub,
  tone,
  dark = false,
  className,
}: {
  icon: ReactNode
  label: string
  value: string
  sub: string
  tone?: 'good' | 'violet'
  dark?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-2xl px-4 py-3',
        dark ? 'surface-ink text-white shadow-clinic' : 'border border-border/70 bg-card shadow-sm',
        className,
      )}
    >
      <p
        className={cn(
          'flex items-center gap-1.5 truncate text-xs font-semibold',
          dark ? 'text-white/75' : 'text-muted-foreground',
        )}
      >
        <span
          className={cn(
            'grid size-6 shrink-0 place-items-center rounded-lg',
            dark && 'bg-white/15',
            tone === 'good' && 'bg-success/10 text-success',
            tone === 'violet' && 'bg-violet-500/10 text-violet-700',
          )}
        >
          {icon}
        </span>
        {label}
      </p>
      <p
        className={cn(
          'font-display mt-1 truncate text-2xl font-bold',
          tone === 'good' && 'text-success',
          tone === 'violet' && 'text-violet-700',
        )}
      >
        {value}
      </p>
      <p className={cn('truncate text-[11px]', dark ? 'text-white/70' : 'text-muted-foreground')}>{sub}</p>
    </div>
  )
}

function AddAppointmentButton() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-9 rounded-xl">
          <CalendarPlus className="size-4" />
          إضافة ميعاد
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg rounded-2xl" dir="rtl">
        <DialogHeader className="text-start">
          <DialogTitle>حجز موعد متابعة</DialogTitle>
        </DialogHeader>
        <AppointmentForm onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

/* ───────── رئيسية الاستقبال ───────── */

function ReceptionHome() {
  const { visitors, isLoading, isError, error, refetch } = useTodayVisitors()
  const todayAppointments = useTodayAppointments()

  return (
    <PageSurface className="flex h-auto flex-col lg:h-full lg:overflow-hidden">
      <HomeHeader />

      <BookingActions />

      {todayAppointments.length > 0 ? (
        <section className="mt-3 shrink-0 rounded-2xl border border-primary/15 bg-primary/5 p-2.5 sm:mt-4 sm:p-3">
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold">
              <CalendarDays className="size-4 text-primary" />
              مواعيد النهاردة ({todayAppointments.length})
            </h2>
            <Link to="/appointments" className="text-xs font-semibold text-primary hover:underline">
              كل المواعيد
            </Link>
          </div>
          <div className="grid max-h-44 gap-2 overflow-auto">
            {todayAppointments.map((a) => (
              <AppointmentRow key={a.id} appointment={a} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden lg:mt-5">
        <div className="mb-3 flex items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">اللي جم النهاردة</h2>
            <p className="text-sm text-muted-foreground">آخر واحد جه بيظهر فوق</p>
          </div>
          {visitors.length > 0 ? (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {visitors.length} {visitors.length === 1 ? 'مريض' : 'مرضى'}
            </span>
          ) : null}
        </div>

        {isLoading ? (
          <LoadingSkeleton rows={4} />
        ) : isError ? (
          <EmptyState
            title="تعذر تحميل زيارات النهاردة"
            action={
              <div className="grid justify-items-center gap-3">
                <p className="max-w-md text-sm text-muted-foreground">{apiErrorMessage(error)}</p>
                <Button onClick={() => void refetch()}>إعادة المحاولة</Button>
              </div>
            }
          />
        ) : visitors.length === 0 ? (
          <EmptyState
            className="min-h-48 flex-1 sm:min-h-48"
            icon={<ToothIcon className="size-7" strokeWidth={1.6} />}
            title="لسه محدش جه النهاردة — أول ما حد يوصل سجّله من فوق"
          />
        ) : (
          <div className="min-h-0 flex-1 space-y-2 overflow-auto pb-2">
            {visitors.map((item, i) => (
              <div key={item.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}>
                <VisitorRow item={item} />
              </div>
            ))}
          </div>
        )}
      </section>
    </PageSurface>
  )
}

function ActionCard({
  to,
  icon,
  title,
  subtitle,
  primary = false,
}: {
  to: '/check-in/new' | '/check-in/followup'
  icon: ReactNode
  title: string
  subtitle: string
  primary?: boolean
}) {
  return (
    <Link
      to={to}
      className={cn(
        'lift lift-hover group flex items-center gap-3 rounded-2xl p-3 sm:gap-3.5 sm:p-4',
        primary
          ? 'surface-ink text-white shadow-clinic'
          : 'border border-teal-200 bg-gradient-to-br from-teal-50 via-white to-white shadow-clinic',
      )}
    >
      <span
        className={cn(
          'grid size-12 shrink-0 place-items-center rounded-2xl transition group-hover:scale-105',
          primary ? 'bg-white/15 text-white ring-1 ring-white/20' : 'bg-teal-500 text-white shadow-sm',
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-base font-semibold sm:text-lg">{title}</h2>
        <p className={cn('truncate text-sm', primary ? 'text-white/65' : 'text-muted-foreground')}>{subtitle}</p>
      </div>
      <ArrowLeft
        className={cn(
          'size-5 shrink-0 transition group-hover:-translate-x-1',
          primary ? 'text-white/60 group-hover:text-white' : 'text-muted-foreground group-hover:text-foreground',
        )}
      />
    </Link>
  )
}

function VisitorRow({ item }: { item: QueueEntry }) {
  return (
    <article className="glass flex items-center gap-3 rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3">
      <span
        className={cn(
          'grid size-11 shrink-0 place-items-center rounded-full font-bold',
          item.kind === 'new' ? 'surface-ink text-white' : 'bg-teal-100 text-teal-700',
        )}
      >
        {item.patientName.trim().charAt(0) || '؟'}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-semibold">{item.patientName}</h3>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-semibold',
              item.kind === 'new' ? 'bg-blue-50 text-blue-700' : 'bg-teal-50 text-teal-700',
            )}
          >
            {item.kind === 'new' ? 'جديد' : 'متابعة'}
          </span>
        </div>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          جه الساعة {item.arrivedAt}
          {item.reason && !['كشف جديد', 'متابعة', 'كشف'].includes(item.reason) ? ` · ${item.reason}` : ''}
          {item.phone ? ` · ${item.phone}` : ''}
        </p>
      </div>

      {item.patientId ? (
        <Button asChild variant="outline" className="h-10 shrink-0 rounded-xl px-4">
          <Link to="/patients/$patientId" params={{ patientId: item.patientId }}>
            الملف
          </Link>
        </Button>
      ) : null}
    </article>
  )
}
