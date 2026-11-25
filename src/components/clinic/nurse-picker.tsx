import { useEffect, useState } from 'react'
import { UserRound } from 'lucide-react'
import { Field } from '@/components/clinic/ui'
import { useClinicSettings } from '@/lib/clinic-hooks'
import { cn } from '@/lib/utils'

const NURSE_STORAGE_KEY = 'elghandour.nurse'

/** لو الدكتور لسه ماضافش ممرضات — العمليات بتتسجل باسم الاستقبال */
export const DEFAULT_ACTOR_WHEN_NO_NURSES = 'الاستقبال'

export function getStoredNurse() {
  try {
    return localStorage.getItem(NURSE_STORAGE_KEY)?.trim() ?? ''
  } catch {
    return ''
  }
}

export function setStoredNurse(name: string) {
  try {
    const value = name.trim()
    if (value) localStorage.setItem(NURSE_STORAGE_KEY, value)
    else localStorage.removeItem(NURSE_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/** آخر ممرضة اتاختارت + قايمة الأسماء من إعدادات العيادة */
export function useSelectedNurse() {
  const { settings, isLoading } = useClinicSettings()
  const nurses = settings.nurses
  const [nurse, setNurseState] = useState(getStoredNurse)

  useEffect(() => {
    if (!nurses.length) return
    if (nurse && !nurses.includes(nurse)) setNurseState('')
  }, [nurses, nurse])

  const setNurse = (name: string) => {
    setNurseState(name)
    setStoredNurse(name)
  }

  const needsPick = nurses.length > 0
  const picked = Boolean(nurse.trim() && nurses.includes(nurse))

  return {
    nurse,
    setNurse,
    nurses,
    loading: isLoading,
    /** فاضي = شغّال من غير اختيار · فيه أسماء = لازم اختيار */
    ready: !isLoading && (!needsPick || picked),
  }
}

export function requireNurseName(nurse: string, nurses: string[]) {
  if (!nurses.length) return { ok: true as const, name: DEFAULT_ACTOR_WHEN_NO_NURSES }
  const name = nurse.trim()
  if (!name || !nurses.includes(name)) return { ok: false as const, error: 'اختار اسم الممرضة اللي بتسجّل' }
  return { ok: true as const, name }
}

export function NursePicker({
  value,
  onChange,
  nurses,
  className,
  dense = true,
}: {
  value: string
  onChange: (name: string) => void
  nurses: string[]
  className?: string
  dense?: boolean
}) {
  if (!nurses.length) {
    return (
      <p className={cn('rounded-xl border border-border/70 bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground', className)}>
        لسه مفيش أسماء ممرضات — التسجيل هيتم باسم «الاستقبال». لما الدكتور يضيف أسماء، لازم تختاري مين بتسجّل.
      </p>
    )
  }

  return (
    <Field dense={dense} label="الممرضة اللي بتسجّل" {...(className ? { className } : {})}>
      <div
        role="radiogroup"
        aria-label="الممرضة اللي بتسجّل"
        className={cn('grid gap-2', nurses.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}
      >
        {nurses.map((name) => {
          const active = value === name
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(name)}
              className={cn(
                'flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition',
                active
                  ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                  : 'border-border bg-card text-foreground/75 hover:border-foreground/25',
              )}
            >
              <UserRound className="size-4 shrink-0" />
              <span className="truncate">{name}</span>
            </button>
          )
        })}
      </div>
    </Field>
  )
}
