import { useState } from 'react'
import { ChevronLeft, Phone, UserRound } from 'lucide-react'
import { money } from '@/lib/format'
import { cn } from '@/lib/utils'
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
import { StatusBadge } from './ui'
import type { Appointment, Patient } from '@/types'
import { Link } from '@tanstack/react-router'

export function AppointmentCard({ item, compact = false }: { item: Appointment; compact?: boolean }) {
  const [status, setStatus] = useState(item.status)
  const actions = (
    <div className={compact ? 'flex shrink-0 flex-wrap items-center gap-1' : 'mt-3 flex flex-wrap gap-2'}>
      {status === 'في الانتظار' && (
        <Button size="sm" className={compact ? 'h-8 px-2.5' : undefined} onClick={() => setStatus('عند الدكتور')}>
          دخول للدكتور
        </Button>
      )}
      {(status === 'في الانتظار' || status === 'عند الدكتور') && (
        <Button
          size="sm"
          variant={status === 'عند الدكتور' ? 'default' : 'outline'}
          className={compact ? 'h-8 px-2.5' : undefined}
          onClick={() => setStatus('تم الكشف')}
        >
          تم الكشف
        </Button>
      )}
      {status !== 'تم الكشف' && status !== 'ملغي' && (
        <ConfirmCancel compact={compact} onConfirm={() => setStatus('ملغي')} />
      )}
    </div>
  )

  return (
    <article className={compact ? 'rounded-2xl bg-muted/50 px-3 py-2' : 'glass-soft rounded-2xl p-4'}>
      <div className={compact ? 'flex items-center gap-3' : 'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3'}>
        <div
          className={
            compact
              ? 'grid min-h-11 min-w-12 shrink-0 place-items-center rounded-xl bg-accent px-2 font-display text-sm font-semibold text-accent-foreground'
              : 'grid min-h-14 min-w-14 place-items-center rounded-2xl bg-accent px-2 font-display text-base font-semibold text-accent-foreground'
          }
          title="رقم الدور"
        >
          {item.order}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className={`truncate ${compact ? 'text-sm font-semibold' : 'font-semibold'}`}>{item.patient}</h3>
            {compact && <StatusBadge status={status} />}
          </div>
          <p className={`truncate text-muted-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
            {item.reason} · حضر {item.arrivedAt} · {item.phone}
          </p>
        </div>
        {!compact && <StatusBadge status={status} />}
        {compact && actions}
      </div>
      {!compact && actions}
    </article>
  )
}

function ConfirmCancel({ onConfirm, compact = false }: { onConfirm: () => void; compact?: boolean }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className={compact ? 'h-8 px-2.5 text-destructive' : 'text-destructive'}>
          إلغاء
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="rounded-3xl">
        <DialogHeader className="text-right">
          <DialogTitle>هل أنت متأكد من إلغاء الدور؟</DialogTitle>
          <DialogDescription>هيتشال من قائمة الانتظار.</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:flex-row-reverse">
          <DialogClose asChild>
            <Button variant="destructive" onClick={onConfirm}>
              إلغاء الدور
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="outline">رجوع</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PatientCard({ patient }: { patient: Patient }) {
  const remaining = Math.max(0, patient.total - patient.paid)
  return (
    <Link
      to="/patients/$patientId"
      params={{ patientId: patient.id }}
      className="glass flex items-center gap-3 rounded-2xl px-3 py-2.5 transition active:scale-[0.99]"
    >
      <div className="surface-ink grid size-11 shrink-0 place-items-center rounded-xl font-display font-bold text-white">
        {patient.name.trim().charAt(0) || <UserRound className="size-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-semibold">{patient.name}</h3>
        <p className="flex items-center gap-x-2 truncate text-xs text-muted-foreground">
          <span dir="ltr" className="inline-flex items-center gap-1">
            <Phone className="size-3" />
            {patient.phone}
          </span>
          {patient.lastVisit && patient.lastVisit !== '—' ? <span>· آخر زيارة: {patient.lastVisit}</span> : null}
        </p>
      </div>
      <div className="shrink-0 text-left">
        {remaining > 0 ? (
          <>
            <p className="text-[11px] text-muted-foreground">الباقي</p>
            <p className="font-display text-sm font-semibold text-warning">{money(remaining)}</p>
          </>
        ) : (
          <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">خالص</span>
        )}
      </div>
      <ChevronLeft className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}

export function MiniPatient({ patient, compact = false }: { patient: Patient; compact?: boolean }) {
  return (
    <Link
      to="/patients/$patientId"
      params={{ patientId: patient.id }}
      className={cn(
        'flex items-center gap-3 rounded-2xl transition-colors hover:bg-card',
        compact ? 'bg-muted/50 px-2.5 py-2' : 'glass-soft p-3',
      )}
    >
      <span
        className={cn(
          'grid shrink-0 place-items-center rounded-full bg-accent font-display font-semibold text-accent-foreground',
          compact ? 'size-9 text-sm' : 'size-10',
        )}
      >
        {patient.name[0]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{patient.name}</p>
        <p className="text-xs text-muted-foreground">{patient.phone}</p>
      </div>
      <span className="text-xs font-semibold text-primary">عرض</span>
    </Link>
  )
}
