import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, UserRound, X } from 'lucide-react'
import { usePatients } from '@/lib/clinic-hooks'
import { cn } from '@/lib/utils'
import { inputClass } from '@/components/clinic/form-layout'
import { DoctorBadge } from '@/components/clinic/doctors'

export function PatientSearchPicker({
  value,
  onChange,
  required = false,
}: {
  value: string
  onChange: (patientId: string) => void
  required?: boolean
}) {
  const { data: patients = [], isLoading } = usePatients()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const selected = useMemo(() => patients.find((p) => p.id === value) ?? null, [patients, value])

  useEffect(() => {
    if (value) setOpen(false)
  }, [value])

  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [])

  const results = useMemo(() => {
    const q = query.trim()
    if (!q) return patients.slice(0, 6)
    return patients.filter((x) => x.name.includes(q) || x.phone.includes(q)).slice(0, 8)
  }, [patients, query])

  if (selected) {
    return (
      <div className="flex h-11 items-center gap-2.5 rounded-xl border border-border bg-card px-3 shadow-sm">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
          {selected.name[0]}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
            <span className="truncate">{selected.name}</span>
            <DoctorBadge id={selected.doctor} />
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            <span dir="ltr">{selected.phone}</span>
          </p>
        </div>
        {selected.problem ? (
          <span className="hidden max-w-[9rem] truncate rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground sm:inline">
            {selected.problem}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => {
            onChange('')
            setQuery('')
            setOpen(true)
          }}
          className="grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="تغيير المريض"
        >
          <X className="size-4" />
        </button>
        <input type="hidden" name="patientId" value={selected.id} required={required} />
      </div>
    )
  }

  return (
    <div ref={rootRef} className="grid gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          className={cn(inputClass, 'h-11 pr-10')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={isLoading ? 'جاري تحميل المرضى...' : 'ابحث بالاسم أو رقم الموبايل'}
          autoComplete="off"
        />
      </div>

      {required && <input type="hidden" name="patientId" value="" required />}

      {open && (
        <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
          <div className="max-h-48 overflow-auto p-1">
            {isLoading ? (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">جاري التحميل...</p>
            ) : results.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">مفيش مريض بالبحث ده</p>
            ) : (
              <ul className="grid gap-0.5">
                {results.map((patient) => (
                  <li key={patient.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(patient.id)
                        setQuery('')
                        setOpen(false)
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-right transition hover:bg-card"
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                        <UserRound className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{patient.name}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          <span dir="ltr">{patient.phone}</span>
                          {patient.problem ? ` · ${patient.problem}` : ''}
                        </span>
                      </span>
                      <DoctorBadge id={patient.doctor} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
