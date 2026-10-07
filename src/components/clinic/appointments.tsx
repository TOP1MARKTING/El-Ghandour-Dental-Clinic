import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ar } from 'date-fns/locale'
import { CalendarCheck, CalendarDays, Check, Clock, FileText, Phone, X } from 'lucide-react'
import { toast } from 'sonner'
import { errorText } from '@/lib/api-errors'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Field } from '@/components/clinic/ui'
import { inputClass } from '@/components/clinic/form-layout'
import { PatientSearchPicker } from '@/components/clinic/patient-search-picker'
import { Button } from '@/components/ui/button'
import { splitReasons } from '@/components/clinic/reason-select'
import {
  useCheckInFollowup,
  useCreateAppointment,
  usePatient,
  useUndoAppointmentArrival,
  useUpdateAppointmentStatus,
} from '@/lib/clinic-hooks'
import { ALREADY_HERE_ERROR } from '@/lib/clinic-api'
import { addDays, dayKey, formatArabicWeekday, parseDayKey } from '@/lib/format'
import { cn } from '@/lib/utils'
import { doctorById, type DoctorId } from '@/lib/doctors'
import { DoctorBadge, DoctorPicker } from '@/components/clinic/doctors'
import type { ClinicAppointment } from '@/types'

function keyAfter(days: number) {
  return dayKey(addDays(new Date(), days))
}

/** النهاردة / بكرة / السبت 3 أكتوبر */
export function formatAppointmentDay(key: string) {
  if (key === dayKey()) return 'النهاردة'
  if (key === keyAfter(1)) return 'بكرة'
  return formatArabicWeekday(parseDayKey(key))
}

export function daysFromToday(key: string) {
  return Math.round((parseDayKey(key).getTime() - parseDayKey(dayKey()).getTime()) / 864e5)
}

/** بعد يومين / بعد 5 أيام — النهاردة وبكرة باينين في اسم اليوم نفسه */
export function daysUntilLabel(key: string) {
  const days = daysFromToday(key)
  if (days < 2) return null
  if (days === 2) return 'بعد يومين'
  return days <= 10 ? `بعد ${days} أيام` : `بعد ${days} يوم`
}

/** النهاردة / امبارح / الأحد 27 سبتمبر */
function formatPastDay(key: string) {
  if (key === dayKey()) return 'النهاردة'
  if (key === keyAfter(-1)) return 'امبارح'
  return formatAppointmentDay(key)
}

export function formatAppointmentTime(time: string) {
  if (!time) return ''
  const [h = 0, m = 0] = time.split(':').map(Number)
  const period = h < 12 ? 'ص' : 'م'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

const QUICK_DAYS = [
  { label: 'بكرة', days: 1 },
  { label: 'بعد 3 أيام', days: 3 },
  { label: 'بعد أسبوع', days: 7 },
  { label: 'بعد أسبوعين', days: 14 },
  { label: 'بعد شهر', days: 30 },
]

export function AppointmentDateField({ date, setDate }: { date: string; setDate: (v: string) => void }) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-1.5">
        {QUICK_DAYS.map(({ label, days }) => {
          const value = keyAfter(days)
          const active = date === value
          return (
            <button
              key={days}
              type="button"
              onClick={() => setDate(active ? '' : value)}
              className={cn(
                'min-h-9 rounded-xl border px-3 text-xs font-semibold transition',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border/80 bg-card hover:border-primary/35',
              )}
            >
              {label}
            </button>
          )
        })}
      </div>
      <div className="grid gap-1 text-xs font-semibold text-muted-foreground">
        أو اختار يوم
        <ArabicDatePicker value={date} onChange={setDate} />
      </div>
      {date ? <p className="text-xs font-semibold text-primary">الموعد: {formatAppointmentDay(date)}</p> : null}
    </div>
  )
}

const WEEKDAY_SHORT = ['أحد', 'اتنين', 'تلات', 'أربع', 'خميس', 'جمعة', 'سبت']

/** past: للمراجعة والمصروفات (النهاردة واللي قبله) — غير كده للمواعيد (النهاردة واللي بعده) */
export function ArabicDatePicker({
  value,
  onChange,
  past = false,
  className,
}: {
  value: string
  onChange: (v: string) => void
  past?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = value ? parseDayKey(value) : undefined
  const today = parseDayKey(dayKey())

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(inputClass, 'flex items-center justify-between gap-2 bg-card text-start font-normal', className)}
        >
          <span className={cn('truncate', !value && 'text-muted-foreground')}>
            {!value ? 'اختار من التقويم' : past ? formatPastDay(value) : formatAppointmentDay(value)}
          </span>
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        collisionPadding={12}
        className="w-auto rounded-2xl border-border bg-card p-0 shadow-lg"
      >
        <Calendar
          mode="single"
          dir="rtl"
          locale={ar}
          weekStartsOn={6}
          showOutsideDays={false}
          selected={selected}
          defaultMonth={selected ?? today}
          disabled={past ? { after: today } : { before: today }}
          onSelect={(d) => {
            if (!d) return
            onChange(dayKey(d))
            setOpen(false)
          }}
          formatters={{ formatWeekdayName: (d) => WEEKDAY_SHORT[d.getDay()] ?? '' }}
          classNames={{ weekday: 'flex-1 select-none text-[11px] font-semibold text-muted-foreground', week: 'mt-1 flex w-full' }}
          className="rounded-2xl bg-card p-2.5 [--cell-size:2.15rem]"
        />
      </PopoverContent>
    </Popover>
  )
}

/** فورم حجز موعد متابعة — لو المريض معروف بيتبعت patientId */
export function AppointmentForm({
  patientId: fixedPatientId,
  onDone,
  className,
}: {
  patientId?: string
  onDone?: () => void
  className?: string
}) {
  const create = useCreateAppointment()
  const [patientId, setPatientId] = useState(fixedPatientId ?? '')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [doctor, setDoctor] = useState<DoctorId | ''>('')
  const patientDoctor = usePatient(patientId).data?.doctor

  useEffect(() => {
    setDoctor(patientDoctor ?? '')
  }, [patientId, patientDoctor])

  const save = async () => {
    if (!patientId) {
      toast.error('اختار المريض الأول')
      return
    }
    if (!date) {
      toast.error('اختار يوم الموعد')
      return
    }
    try {
      await create.mutateAsync({ patientId, date, time: '', note, ...(doctor ? { doctor } : {}) })
      toast.success(
        `اتحجز الموعد — ${formatAppointmentDay(date)}${doctor ? ` مع ${doctorById(doctor).short}` : ''}`,
      )
      setDate('')
      setNote('')
      if (!fixedPatientId) setPatientId('')
      onDone?.()
    } catch (err) {
      toast.error(errorText(err, 'حصل خطأ أثناء حجز الموعد'))
    }
  }

  return (
    <div className={cn('grid gap-3', className)}>
      {fixedPatientId ? null : (
        <Field dense label="المريض">
          <PatientSearchPicker value={patientId} onChange={setPatientId} />
        </Field>
      )}
      {patientId ? (
        <Field dense label="الموعد مع مين">
          <DoctorPicker value={doctor} onChange={setDoctor} />
        </Field>
      ) : null}
      <div className="grid gap-1 text-sm font-semibold">
        يرجع إمتى
        <AppointmentDateField date={date} setDate={setDate} />
      </div>
      <Field dense label="ملاحظة" hint="اختياري">
        <div className="grid gap-2">
          <NoteSuggestions patientId={patientId} note={note} setNote={setNote} />
          <input
            className={cn(inputClass, 'bg-card')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="أو اكتب ملاحظة"
          />
        </div>
      </Field>
      <Button type="button" className="h-11 rounded-xl sm:h-10" disabled={create.isPending} onClick={save}>
        <CalendarCheck className="size-4" />
        {create.isPending ? 'جاري الحجز...' : 'حجز الموعد'}
      </Button>
    </div>
  )
}

function NoteSuggestions({
  patientId,
  note,
  setNote,
}: {
  patientId: string
  note: string
  setNote: (v: string) => void
}) {
  const { data: patient } = usePatient(patientId)
  const current = splitReasons(patient?.problem ?? '').filter((r) => !r.includes('كشف'))
  const options = [...current.map((r) => `تكملة ${r}`), 'متابعة', 'مراجعة']

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option, i) => {
        const active = note === option
        return (
          <button
            key={option}
            type="button"
            onClick={() => setNote(active ? '' : option)}
            className={cn(
              'min-h-9 rounded-xl border px-3 text-xs font-semibold transition',
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : i < current.length
                  ? 'border-primary/30 bg-primary/5 text-primary hover:border-primary/50'
                  : 'border-border/80 bg-card hover:border-primary/35',
            )}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}

/** موعد النهاردة بعلامة صح — الاستقبال بيعلّم عليها أول ما المريض يوصل */
export function AppointmentCheckRow({ appointment: a }: { appointment: ClinicAppointment }) {
  const checkIn = useCheckInFollowup()
  const update = useUpdateAppointmentStatus()
  const undo = useUndoAppointmentArrival()
  const arrived = a.status === 'arrived'
  const busy = checkIn.isPending || update.isPending || undo.isPending

  const toggle = async () => {
    try {
      if (arrived) {
        if (!window.confirm(`تشيل علامة الحضور من ${a.patientName}؟`)) return
        await undo.mutateAsync({ id: a.id, patientId: a.patientId, date: a.date })
        toast.success(`اتشالت علامة الحضور من ${a.patientName}`)
        return
      }
      try {
        await checkIn.mutateAsync({ patientId: a.patientId, doctor: a.doctor })
      } catch (err) {
        if (!(err instanceof Error && err.message === ALREADY_HERE_ERROR)) throw err
        await update.mutateAsync({ id: a.id, status: 'arrived' })
      }
      toast.success(`${a.patientName} حضر ✅`)
    } catch (err) {
      toast.error(errorText(err, 'حصل خطأ'))
    }
  }

  const cancel = async () => {
    if (!window.confirm(`إلغاء موعد ${a.patientName}؟`)) return
    try {
      await update.mutateAsync({ id: a.id, status: 'cancelled' })
      toast.success('اتلغى الموعد')
    } catch (err) {
      toast.error(errorText(err, 'حصل خطأ أثناء الإلغاء'))
    }
  }

  return (
    <article
      className={cn(
        'flex min-w-0 items-center gap-3 rounded-2xl border px-3 py-2.5 shadow-sm transition',
        arrived ? 'border-success/30 bg-success/5' : 'border-border/70 bg-card',
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={arrived}
        aria-label={arrived ? `${a.patientName} حضر — شيل العلامة` : `علّم إن ${a.patientName} حضر`}
        title={arrived ? 'حضر — دوس تاني لو اتعملت غلط' : 'دوس لما المريض يوصل'}
        disabled={busy}
        onClick={() => void toggle()}
        className={cn(
          'grid size-11 shrink-0 place-items-center rounded-full border-2 transition active:scale-95 disabled:opacity-60',
          arrived
            ? 'border-success bg-success text-white shadow-sm'
            : 'border-dashed border-primary/45 text-primary/40 hover:border-primary hover:bg-primary/5 hover:text-primary',
        )}
      >
        <Check className="size-5" strokeWidth={3} />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/patients/$patientId"
            params={{ patientId: a.patientId }}
            className="truncate font-semibold hover:text-primary"
          >
            {a.patientName}
          </Link>
          <DoctorBadge id={a.doctor} />
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-semibold',
              arrived ? 'bg-success/15 text-success' : 'bg-warning/10 text-warning',
            )}
          >
            {arrived ? 'حضر' : 'لسه ماجاش'}
          </span>
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
          {a.phone ? (
            <a href={`tel:${a.phone}`} dir="ltr" className="inline-flex items-center gap-1 hover:text-primary">
              <Phone className="size-3" />
              {a.phone}
            </a>
          ) : null}
          {a.note ? (
            <span className="truncate rounded-full bg-violet-500/10 px-2 py-0.5 font-semibold text-violet-700">
              {a.note}
            </span>
          ) : null}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button asChild variant="outline" className="h-10 rounded-xl px-3">
          <Link to="/patients/$patientId" params={{ patientId: a.patientId }}>
            الملف
          </Link>
        </Button>
        {arrived ? null : (
          <Button
            variant="ghost"
            className="size-10 rounded-xl px-0 text-destructive"
            disabled={busy}
            onClick={() => void cancel()}
            aria-label={`إلغاء موعد ${a.patientName}`}
            title="إلغاء الموعد"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
    </article>
  )
}

export function AppointmentRow({ appointment: a, showDate = false }: { appointment: ClinicAppointment; showDate?: boolean }) {
  const nav = useNavigate()
  const checkIn = useCheckInFollowup()
  const update = useUpdateAppointmentStatus()
  const isToday = a.date === dayKey()
  const done = a.status !== 'upcoming'
  const busy = checkIn.isPending || update.isPending

  const arrived = async () => {
    try {
      try {
        await checkIn.mutateAsync({ patientId: a.patientId, doctor: a.doctor })
      } catch (err) {
        if (!(err instanceof Error && err.message === ALREADY_HERE_ERROR)) throw err
        await update.mutateAsync({ id: a.id, status: 'arrived' })
      }
      toast.success(`${a.patientName} اتسجل إنه جه ✅`)
      void nav({ to: '/' })
    } catch (err) {
      toast.error(errorText(err, 'حصل خطأ'))
    }
  }

  const cancel = async () => {
    if (!window.confirm(`إلغاء موعد ${a.patientName}؟`)) return
    try {
      await update.mutateAsync({ id: a.id, status: 'cancelled' })
      toast.success('اتلغى الموعد')
    } catch (err) {
      toast.error(errorText(err, 'حصل خطأ أثناء الإلغاء'))
    }
  }

  return (
    <div className="@container">
    <article
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-2.5 rounded-2xl border border-border/70 bg-card px-3 py-2.5 shadow-sm @lg:flex-nowrap @lg:gap-3 @lg:px-3.5',
        done && 'opacity-55',
      )}
    >
      {a.time ? (
        <div className="grid min-w-16 shrink-0 place-items-center rounded-xl bg-accent px-2 py-1.5 text-center text-accent-foreground">
          <Clock className="size-3.5" />
          <span className="mt-0.5 text-xs font-semibold">{formatAppointmentTime(a.time)}</span>
        </div>
      ) : (
        <div className="surface-ink grid size-11 shrink-0 place-items-center rounded-xl font-display font-bold text-white">
          {a.patientName.trim().charAt(0) || '؟'}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/patients/$patientId"
            params={{ patientId: a.patientId }}
            className="truncate font-semibold hover:text-primary"
          >
            {a.patientName}
          </Link>
          <DoctorBadge id={a.doctor} />
          {a.status === 'arrived' ? (
            <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">وصل</span>
          ) : a.status === 'cancelled' ? (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
              اتلغى
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
          {showDate ? <span className="font-semibold text-foreground/80">{formatAppointmentDay(a.date)}</span> : null}
          {a.phone ? (
            <a href={`tel:${a.phone}`} dir="ltr" className="inline-flex items-center gap-1 hover:text-primary">
              <Phone className="size-3" />
              {a.phone}
            </a>
          ) : null}
          {a.note ? (
            <span className="truncate rounded-full bg-violet-500/10 px-2 py-0.5 font-semibold text-violet-700">
              {a.note}
            </span>
          ) : null}
        </p>
      </div>

      <div className={cn('flex gap-2 @lg:w-auto', isToday && !done ? 'w-full' : 'ms-auto')}>
        {isToday && !done ? (
          <Button className="h-10 min-w-0 flex-1 rounded-xl @lg:h-9 @lg:flex-none" disabled={busy} onClick={arrived}>
            <CalendarCheck className="size-4" />
            <span className="@xl:hidden">وصل</span>
            <span className="@max-xl:hidden">وصل — سجّل إنه جه</span>
          </Button>
        ) : null}
        <Button asChild variant="outline" className="h-10 shrink-0 rounded-xl px-3 @lg:h-9">
          <Link to="/patients/$patientId" params={{ patientId: a.patientId }}>
            <FileText className="size-4" />
            <span className="@xl:hidden">الملف</span>
            <span className="@max-xl:hidden">عرض الملف</span>
          </Link>
        </Button>
        {done ? null : (
          <Button
            variant="ghost"
            className="h-10 rounded-xl px-3 text-destructive @lg:h-9"
            disabled={busy}
            onClick={cancel}
            aria-label="إلغاء الموعد"
          >
            <X className="size-4" />
            <span className="@max-xl:hidden">إلغاء</span>
          </Button>
        )}
      </div>
    </article>
    </div>
  )
}
