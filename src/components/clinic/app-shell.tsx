import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { CalendarDays, LogOut, Menu } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { roleLabel, useAuth } from '@/lib/auth-context'
import {
  ClinicHomeIcon,
  ClinicPayIcon,
  FinanceIcon,
  PatientFileIcon,
  ServicesIcon,
  ToothIcon,
} from '@/components/clinic/dental-icons'

const staffItems = [
  { to: '/' as const, label: 'الرئيسية', icon: ClinicHomeIcon, match: (path: string) => path === '/' },
  {
    to: '/patients' as const,
    label: 'المرضى',
    icon: PatientFileIcon,
    match: (path: string) => path.startsWith('/patients'),
  },
  {
    to: '/appointments' as const,
    label: 'المواعيد',
    icon: CalendarDays,
    match: (path: string) => path.startsWith('/appointments'),
  },
]

const adminItems = [
  {
    to: '/payments' as const,
    label: 'الحسابات',
    icon: ClinicPayIcon,
    match: (path: string) => path.startsWith('/payments'),
  },
  {
    to: '/finance' as const,
    label: 'الخزنة',
    icon: FinanceIcon,
    match: (path: string) => path.startsWith('/finance'),
  },
  {
    to: '/services' as const,
    label: 'الأسعار',
    icon: ServicesIcon,
    match: (path: string) => path.startsWith('/services'),
  },
]

function BootScreen() {
  return (
    <div dir="rtl" className="grid min-h-dvh place-items-center bg-scene">
      <div className="animate-rise text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-clinic">
          <ToothIcon className="size-8" strokeWidth={1.6} />
        </span>
        <p className="font-display mt-4 text-lg font-semibold">عيادة الغندور للأسنان</p>
        <p className="mt-1 text-sm text-muted-foreground">جاري التجهيز...</p>
      </div>
    </div>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()
  const { user, loading, logout } = useAuth()
  const login = path === '/login'
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [path])

  useEffect(() => {
    if (loading) return
    if (!user && !login) {
      void navigate({ to: '/login', replace: true })
    }
    if (user && login) {
      void navigate({ to: '/', replace: true })
    }
  }, [loading, user, login, navigate])

  if (login) return <>{children}</>
  if (loading || !user) return <BootScreen />

  const formPage = path.endsWith('/new') || path.startsWith('/check-in/')
  const listPage = path === '/' || path === '/patients' || path === '/payments' || path === '/finance'
  const fitHeight = formPage || listPage
  const initial = user.name.trim().charAt(0) || 'د'

  return (
    <div dir="rtl" className="app-shell bg-scene text-foreground max-lg:flex max-lg:h-dvh max-lg:flex-col max-lg:overflow-hidden lg:min-h-dvh lg:overflow-x-clip">
      {/* Mobile top bar — full bleed like a native app */}
      <header className="app-topbar surface-ink sticky top-0 z-30 shrink-0 pt-[env(safe-area-inset-top)] text-white shadow-clinic lg:hidden">
        <div className="flex h-14 items-center gap-3 px-3 sm:px-5">
          <Link
            to="/"
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25"
          >
            <ToothIcon className="size-5" strokeWidth={1.7} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold leading-tight">عيادة الغندور</p>
            <p className="truncate text-xs leading-tight text-white/75">
              {user.name} · {roleLabel(user.role)}
            </p>
          </div>
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="القايمة"
                className="grid size-11 shrink-0 place-items-center rounded-full bg-white/15 ring-1 ring-white/25 transition active:scale-95"
              >
                <Menu className="size-5" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="right"
              dir="rtl"
              className="flex w-[82%] max-w-xs flex-col gap-0 border-border bg-card p-3 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>button.absolute]:hidden"
            >
              <SheetTitle className="sr-only">القايمة</SheetTitle>
              <SheetDescription className="sr-only">صفحات العيادة</SheetDescription>
              <Link to="/" className="surface-ink flex items-center gap-3 rounded-xl px-3 py-3 text-white shadow-clinic">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25">
                  <ToothIcon className="size-6" strokeWidth={1.6} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold">عيادة الغندور</p>
                  <p className="text-xs text-white/75">للأسنان والتجميل</p>
                </div>
              </Link>

              <nav className="mt-4 flex flex-1 flex-col gap-5 overflow-y-auto">
                <NavGroup title="العيادة" items={staffItems} path={path} />
                {user.role === 'admin' ? <NavGroup title="الإدارة" items={adminItems} path={path} /> : null}
              </nav>

              <div className="mt-2 flex items-center gap-3 rounded-xl border border-border bg-accent/50 p-2.5">
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 font-bold text-white">
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{roleLabel(user.role)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void logout()}
                  aria-label="تسجيل الخروج"
                  className="flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-destructive transition hover:bg-card"
                >
                  <LogOut className="size-[18px]" />
                  خروج
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[1500px] flex-1 gap-0 max-lg:overflow-hidden lg:min-h-dvh lg:gap-4 lg:p-4 xl:gap-5 xl:p-5">
        <aside className="sticky top-4 hidden h-[calc(100dvh-2rem)] w-[232px] shrink-0 flex-col rounded-2xl border border-border bg-card p-3 shadow-clinic lg:flex xl:top-5 xl:h-[calc(100dvh-2.5rem)] xl:w-[256px]">
          <Link to="/" className="surface-ink flex items-center gap-3 rounded-xl px-3 py-3 text-white shadow-clinic">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25">
              <ToothIcon className="size-6" strokeWidth={1.6} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-bold">عيادة الغندور</p>
              <p className="text-xs text-white/75">للأسنان والتجميل</p>
            </div>
          </Link>

          <div className="my-2" />

          <nav className="flex flex-1 flex-col gap-5 overflow-y-auto py-1">
            <NavGroup title="العيادة" items={staffItems} path={path} />
            {user.role === 'admin' ? <NavGroup title="الإدارة" items={adminItems} path={path} /> : null}
          </nav>

          <div className="mt-2 flex items-center gap-3 rounded-xl border border-border bg-accent/50 p-2.5">
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 font-bold text-white">

              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{roleLabel(user.role)}</p>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              aria-label="تسجيل الخروج"
              title="تسجيل الخروج"
              className="grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-card hover:text-destructive"
            >
              <LogOut className="size-[18px]" />
            </button>
          </div>
        </aside>

        <main
          className={cn(
            'app-main min-w-0 flex-1',
            'max-lg:overflow-y-auto max-lg:overscroll-y-contain max-lg:px-3 max-lg:pb-[calc(1.25rem+env(safe-area-inset-bottom))] max-lg:pt-3 sm:max-lg:px-5 sm:max-lg:pt-4',
            'lg:pb-4 xl:pb-5',
            fitHeight && 'lg:h-[calc(100dvh-2rem)] lg:overflow-hidden lg:pb-0 xl:h-[calc(100dvh-2.5rem)]',
          )}
        >
          <div className="animate-rise lg:h-full">{children}</div>
        </main>
      </div>
    </div>
  )
}

function NavGroup({
  title,
  items,
  path,
}: {
  title: string
  items: typeof staffItems | typeof adminItems
  path: string
}) {
  return (
    <div>
      <p className="mb-1.5 px-3 text-xs font-semibold text-muted-foreground">{title}</p>
      <div className="flex flex-col gap-1">
        {items.map(({ to, label, icon: Icon, match }) => {
          const active = match(path)
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition-colors duration-200',
                active
                  ? 'surface-ink text-white shadow-clinic'
                  : 'text-foreground/70 hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Icon className={cn('size-5', active ? 'text-white' : 'text-primary/70')} />
              {label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export function PageSurface({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mx-auto w-full max-w-6xl py-1 lg:px-2 lg:py-2 xl:px-3 xl:py-3', className)}>
      {children}
    </div>
  )
}
