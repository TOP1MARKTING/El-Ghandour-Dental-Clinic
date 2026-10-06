import { ChevronLeft, Phone, UserRound } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { money } from '@/lib/format'
import { patientBalance } from '@/lib/pricing'
import type { Patient } from '@/types'
import { DoctorBadge } from '@/components/clinic/doctors'

export function PatientCard({ patient }: { patient: Patient }) {
  const remaining = patientBalance(patient)
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
        <div className="flex min-w-0 items-center gap-1.5">
          <h3 className="truncate font-semibold">{patient.name}</h3>
          <DoctorBadge id={patient.doctor} />
        </div>
        <p className="flex items-center gap-x-2 truncate text-xs text-muted-foreground">
          <span dir="ltr" className="inline-flex items-center gap-1">
            <Phone className="size-3" />
            {patient.phone}
          </span>
          {patient.lastVisit ? <span>· آخر زيارة: {patient.lastVisit}</span> : null}
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
