import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { FormEvent, useState } from 'react'
import { ExternalLink, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/clinic/ui'
import { inputClass } from '@/components/clinic/form-layout'
import { useAuth } from '@/lib/auth-context'
import { ToothIcon } from '@/components/clinic/dental-icons'

export const Route = createFileRoute('/login')({
  head: () => ({
    meta: [
      { title: 'تسجيل الدخول — عيادة الغندور للأسنان' },
      { name: 'description', content: 'الدخول إلى نظام إدارة عيادة الغندور.' },
      { property: 'og:title', content: 'تسجيل الدخول — عيادة الغندور للأسنان' },
      { property: 'og:description', content: 'الدخول إلى نظام إدارة عيادة الغندور.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: Login,
})

function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const email = String(data.get('email') ?? '').trim()
    const password = String(data.get('password') ?? '')
    if (!email || !password || loading) return
    setLoading(true)
    try {
      await login(email, password)
      toast.success('تم تسجيل الدخول ✅')
      void navigate({ to: '/', replace: true })
    } catch {
      toast.error('البريد أو كلمة المرور غلط')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      dir="rtl"
      className="login-dental relative h-dvh overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"
    >
      <div className="relative flex h-full flex-col overflow-y-auto">
        <div className="relative h-48 shrink-0 overflow-hidden sm:h-56 lg:hidden [@media(max-height:700px)]:hidden">
          <img src="/login-clinic.jpg" alt="عيادة أسنان" className="size-full object-cover object-[center_65%]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/10 to-blue-950/25" />
        </div>

        <div className="flex flex-1 flex-col items-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8">
      <main className="animate-rise relative -mt-14 w-full max-w-[400px] lg:my-auto lg:py-8 [@media(max-height:700px)]:mt-6">
        <div className="mb-5 text-center [@media(max-height:640px)]:mb-3">
          <span className="surface-ink mx-auto grid size-16 place-items-center rounded-2xl text-white shadow-clinic ring-4 ring-[var(--background)] [@media(max-height:640px)]:size-12">
            <ToothIcon className="size-8 [@media(max-height:640px)]:size-6" strokeWidth={1.5} />
          </span>
          <h1 className="mt-4 text-[1.75rem] font-bold leading-tight text-foreground [@media(max-height:640px)]:mt-2 [@media(max-height:640px)]:text-2xl">
            عيادة الغندور
          </h1>
          <p className="mt-1 text-base font-semibold text-primary [@media(max-height:640px)]:text-sm">للأسنان والتجميل</p>
        </div>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-clinic sm:p-7 [@media(max-height:640px)]:p-5">
          <div className="mb-5 flex items-center justify-between gap-3 [@media(max-height:640px)]:mb-3">
            <div>
              <h2 className="text-lg font-bold">تسجيل الدخول</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">ادخل بحساب العيادة</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
              <ShieldCheck className="size-3.5" />
              آمن
            </span>
          </div>

          <form onSubmit={submit} className="space-y-4 [@media(max-height:640px)]:space-y-3">
            <Field dense label="البريد الإلكتروني">
              <div className="relative">
                <Mail className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  name="email"
                  className={`${inputClass} h-11 pr-11`}
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="name@example.com"
                  dir="ltr"
                />
              </div>
            </Field>

            <Field dense label="كلمة المرور">
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  name="password"
                  className={`${inputClass} h-11 px-11`}
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute left-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>

            <Button type="submit" size="lg" className="surface-ink mt-1 h-12 w-full text-base shadow-clinic" disabled={loading}>
              {loading ? (
                <>
                  <LoaderCircle className="animate-spin" />
                  جاري الدخول
                </>
              ) : (
                'دخول للعيادة'
              )}
            </Button>
          </form>
        </section>

      </main>

        <footer className="mt-auto flex shrink-0 justify-center pt-5 lg:mt-0">
          <a
            href="https://www.top1markting.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2.5 rounded-full border border-[#0a2a5e]/15 bg-white py-1.5 pe-3 ps-2 text-sm text-muted-foreground shadow-clinic transition hover:-translate-y-0.5 hover:border-[#f5a623]/60 hover:shadow-md"
          >
            <img src="/top1markting-mark.png" alt="Top1Markting" className="h-7 w-auto" />
            <span>تنفيذ</span>
            <span dir="ltr" className="text-[15px] font-extrabold text-[#0a2a5e]">
              Top<span className="text-[#f5a623]">1</span>Markting
            </span>
            <ExternalLink className="size-3.5 text-muted-foreground transition group-hover:text-[#f5a623]" />
          </a>
        </footer>
        </div>
      </div>

      <aside className="relative m-4 hidden overflow-hidden rounded-3xl shadow-clinic lg:block">
        <img src="/login-clinic.jpg" alt="عيادة أسنان" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-blue-950/85 via-blue-950/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-8 text-white xl:p-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/25 backdrop-blur">
            <ToothIcon className="size-3.5" strokeWidth={1.8} />
            عيادة الغندور للأسنان والتجميل
          </span>
          <h2 className="mt-4 text-3xl font-bold leading-snug xl:text-4xl">ابتسامتك في إيد أمينة</h2>
          <p className="mt-2 max-w-md text-base text-white/80">
            المرضى، الدور، العلاج والحسابات — كل حاجة في مكان واحد.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {['ملف لكل مريض', 'مواعيد المتابعة', 'حسابات مضبوطة'].map((x) => (
              <span key={x} className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold ring-1 ring-white/20 backdrop-blur">
                {x}
              </span>
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}
