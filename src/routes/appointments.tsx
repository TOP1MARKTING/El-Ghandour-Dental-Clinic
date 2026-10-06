import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { CalendarDays, CalendarPlus } from 'lucide-react'
import { PageSurface } from '@/components/clinic/app-shell'
import { EmptyState, LoadingSkeleton, PageHeader } from '@/components/clinic/ui'
import {
  AppointmentForm,
  AppointmentRow,
  daysFromToday,
  daysUntilLabel,
  formatAppointmentDay,
} from '@/components/clinic/appointments'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { apiErrorMessage } from '@/lib/api-errors'
import { useMyDoctor, useUpcomingAppointments } from '@/lib/clinic-hooks'
import { mineFirst } from '@/lib/doctors'
import { DoctorFilter, type DoctorFilterValue } from '@/components/clinic/doctors'
import { dayKey, parseDayKey } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ClinicAppointment } from '@/types'

export const Route = createFileRoute('/appointments')({
  head: () => ({
    meta: [
      { title: 'المواعيد — عيادة الغندور' },
      { name: 'description', content: 'جدول مواعيد المتابعة.' },
      { property: 'og:title', content: 'المواعيد — عيادة الغندور' },
      { property: 'og:description', content: 'جدول مواعيد المتابعة.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: Appointments,
})

function Appointments() {
  const { data: appointments = [], isLoading, isError, error, refetch } = useUpcomingAppointments()
  const [adding, setAdding] = useState(false)
  const myDoctor = useMyDoctor()
  const [doctorFilter, setDoctorFilter] = useState<DoctorFilterValue>('all')

  const groups = useMemo(() => {
    const today = dayKey()
    const map = new Map<string, ClinicAppointment[]>()
    for (const a of appointments) {
      if (a.status === 'cancelled') continue
      if (a.status === 'arrived' && a.date !== today) continue
      if (doctorFilter !== 'all' && a.doctor !== doctorFilter) continue
      const list = map.get(a.date) ?? []
      list.push(a)
      map.set(a.date, list)
    }
    return [...map.entries()].map(([date, list]) => [date, mineFirst(list, (a) => a.doctor, myDoctor)] as const)
  }, [appointments, doctorFilter, myDoctor])

  const upcoming = appointments.filter(
    (a) => a.status === 'upcoming' && (doctorFilter === 'all' || a.doctor === doctorFilter),
  )
  const nearest = upcoming[0] ? (daysUntilLabel(upcoming[0].date) ?? formatAppointmentDay(upcoming[0].date)) : ''
  const summary = upcoming.length
    ? `${upcoming.length} ${upcoming.length === 1 ? 'موعد جاي' : 'مواعيد جاية'} · أقربهم ${nearest}`
    : 'مواعيد المتابعة اللي الدكتور طلبها'

  return (
    <PageSurface className="flex h-auto flex-col lg:h-full lg:overflow-hidden">
      <PageHeader
        title="المواعيد"
        description={summary}
        action={
          <Dialog open={adding} onOpenChange={setAdding}>
            <DialogTrigger asChild>
              <Button className="h-11 rounded-xl sm:h-10">
                <CalendarPlus className="size-4" />
                موعد جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg rounded-2xl" dir="rtl">
              <DialogHeader className="text-start">
                <DialogTitle>حجز موعد متابعة</DialogTitle>
              </DialogHeader>
              <AppointmentForm onDone={() => setAdding(false)} />
            </DialogContent>
          </Dialog>
        }
      />

      <DoctorFilter value={doctorFilter} onChange={setDoctorFilter} className="mb-3 self-start max-sm:self-stretch" />

      <div className="min-h-0 flex-1 overflow-auto pe-1">
        {isLoading ? (
          <LoadingSkeleton rows={4} />
        ) : isError ? (
          <EmptyState
            title="تعذر تحميل المواعيد"
            description={apiErrorMessage(error)}
            action={<Button onClick={() => void refetch()}>إعادة المحاولة</Button>}
          />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={<CalendarDays />}
            title="مفيش مواعيد جاية"
            action={
              <Button onClick={() => setAdding(true)}>
                <CalendarPlus className="size-4" />
                احجز موعد
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {groups.map(([date, list]) => {
              const today = daysFromToday(date) === 0
              const day = parseDayKey(date)
              return (
                <section
                  key={date}
                  className={cn('glass min-w-0 rounded-2xl p-3 sm:p-4', today && 'ring-2 ring-teal-500/30')}
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div
                      className={cn(
                        'grid size-12 shrink-0 place-items-center rounded-xl text-center leading-none',
                        today ? 'bg-teal-600 text-white' : 'bg-violet-500/10 text-violet-700',
                      )}
                    >
                      <span className="font-display text-lg font-bold">{day.getDate()}</span>
                      <span className="text-[10px] font-semibold">
                        {day.toLocaleDateString('ar-EG', { month: 'short' })}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-bold">{formatAppointmentDay(date)}</h2>
                      <p className="text-xs text-muted-foreground">
                        {[daysUntilLabel(date), `${list.length} ${list.length === 1 ? 'موعد' : 'مواعيد'}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {list.map((a) => (
                      <AppointmentRow key={a.id} appointment={a} />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </PageSurface>
  )
}
