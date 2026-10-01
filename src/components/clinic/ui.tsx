import type { ReactNode } from 'react'
import { LoaderCircle, Search, TriangleAlert, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <header className="mb-3.5 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:items-center sm:justify-between lg:mb-5">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold leading-tight sm:truncate sm:text-[1.75rem]">{title}</h1>
        {description && <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {action ? <div className="shrink-0 [&_a]:w-full [&_button]:w-full sm:[&_a]:w-auto sm:[&_button]:w-auto">{action}</div> : null}
    </header>
  )
}

export function Field({
  label,
  children,
  hint,
  className,
  dense = false,
}: {
  label: string
  children: ReactNode
  hint?: string
  className?: string
  dense?: boolean
}) {
  return (
    <label className={cn('grid text-sm font-semibold text-foreground', dense ? 'gap-1' : 'gap-1.5', className)}>
      <span className="flex items-center gap-2">
        {label}
        {hint && <span className="text-xs font-normal text-muted-foreground">({hint})</span>}
      </span>
      {children}
    </label>
  )
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'بحث',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="flex h-12 items-center gap-3 rounded-xl border border-input bg-card px-4 transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
      <Search className="size-5 shrink-0 text-muted-foreground" />
      <input
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}

export function FinancialCard({
  label,
  value,
  tone = 'default',
  compact = false,
}: {
  label: string
  value: string
  tone?: 'default' | 'good' | 'warn'
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border shadow-clinic',
        compact ? 'px-3.5 py-3 sm:px-4' : 'p-4 sm:p-5',
        tone === 'good' && 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white',
        tone === 'warn' && 'border-amber-200 bg-gradient-to-br from-amber-50 to-white',
        tone === 'default' && 'border-blue-200 bg-gradient-to-br from-blue-50 to-white',
      )}
    >
      <span
        className={cn(
          'absolute inset-y-0 right-0 w-1',
          tone === 'good' && 'bg-success',
          tone === 'warn' && 'bg-warning',
          tone === 'default' && 'bg-primary',
        )}
      />
      <p className="relative flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <span
          className={cn(
            'size-2 rounded-full',
            tone === 'good' && 'bg-success',
            tone === 'warn' && 'bg-warning',
            tone === 'default' && 'bg-primary',
          )}
        />
        {label}
      </p>
      <p
        className={cn(
          'font-display relative font-semibold',
          compact ? 'mt-1 truncate text-lg sm:text-xl' : 'mt-2 text-xl sm:text-2xl',
          tone === 'good' && 'text-success',
          tone === 'warn' && 'text-warning',
        )}
      >
        {value}
      </p>
    </div>
  )
}

export function StatusBadge({ status, label: labelOverride }: { status: string; label?: string }) {
  const label = labelOverride ??
    (status === 'بانتظار الحساب'
      ? 'بانتظار الحساب'
      : status === 'عند الدكتور'
        ? 'بانتظار الحساب'
        : status)

  const cls =
    status === 'تم الكشف' || status === 'تم الحضور'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : status === 'ملغي' || status === 'لم يحضر'
        ? 'bg-rose-50 text-rose-700 ring-rose-200'
        : status === 'عند الدكتور' || status === 'بانتظار الحساب'
          ? 'bg-blue-50 text-blue-700 ring-blue-200'
          : 'bg-amber-50 text-amber-700 ring-amber-200'
  return <span className={cn('inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1', cls)}>{label}</span>
}

export function EmptyState({
  title = 'لا توجد بيانات حتى الآن',
  action,
  icon,
  className,
}: {
  title?: string
  action?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('glass grid min-h-56 place-items-center rounded-2xl p-5 text-center sm:min-h-64 sm:p-8', className)}>
      <div>
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-accent text-accent-foreground">
          {icon ?? <Users />}
        </div>
        <h3 className="mt-4 font-semibold">{title}</h3>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  )
}

export function ErrorState() {
  return (
    <div className="glass grid min-h-56 place-items-center rounded-2xl p-5 text-center sm:min-h-64 sm:p-8">
      <div>
        <TriangleAlert className="mx-auto size-10 text-destructive" />
        <h3 className="mt-3 text-lg font-semibold">حصلت مشكلة</h3>
        <p className="mt-1 text-sm text-muted-foreground">تعذر عرض البيانات الآن</p>
        <Button className="mt-4">إعادة المحاولة</Button>
      </div>
    </div>
  )
}

export function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-label="جاري التحميل" className="glass space-y-3 rounded-2xl p-4 sm:space-y-4 sm:p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        جاري التحميل
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-2xl bg-muted sm:h-16" />
      ))}
    </div>
  )
}
