import { createFileRoute } from '@tanstack/react-router'
import { FormEvent, useMemo, useState } from 'react'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageSurface } from '@/components/clinic/app-shell'
import { AdminOnly } from '@/components/clinic/admin-only'
import { inputClass } from '@/components/clinic/form-layout'
import { EmptyState, LoadingSkeleton, PageHeader } from '@/components/clinic/ui'
import { Button } from '@/components/ui/button'
import {
  useClinicSettings,
  useCreateService,
  useDeleteService,
  useSaveClinicSettings,
  useServices,
  useUpdateServicePrice,
} from '@/lib/clinic-hooks'
import { apiErrorMessage, errorText } from '@/lib/api-errors'
import { money } from '@/lib/format'
import { cn } from '@/lib/utils'
import { DEFAULT_SERVICES, groupByFirstWord, subServiceName } from '@/lib/visit-reasons'
import type { Service } from '@/types'

export const Route = createFileRoute('/services')({
  head: () => ({
    meta: [
      { title: 'الخدمات والأسعار — عيادة الغندور' },
      { name: 'description', content: 'أنواع الكشف والعلاج وأسعارها الثابتة.' },
    ],
  }),
  component: () => (
    <AdminOnly>
      <Services />
    </AdminOnly>
  ),
})

function Services() {
  const { data: services = [], isLoading, isError, refetch } = useServices()
  const create = useCreateService()
  const [importing, setImporting] = useState(false)

  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formEl = e.currentTarget
    const data = new FormData(formEl)
    try {
      await create.mutateAsync({
        name: String(data.get('name') ?? ''),
        price: Number(data.get('price') || 0),
      })
      toast.success('تمت إضافة الخدمة ✅')
      formEl.reset()
    } catch (err) {
      toast.error(errorText(err, 'حصل خطأ أثناء الإضافة'))
    }
  }

  const importDefaults = async () => {
    setImporting(true)
    try {
      await create.mutateAsync(DEFAULT_SERVICES.map((s) => ({ name: s.name, price: s.price })))
      toast.success('اتضافت خدمات العيادة — كمّل الأسعار الفاضية')
    } catch (err) {
      toast.error(errorText(err, 'حصل خطأ أثناء الإضافة'))
    } finally {
      setImporting(false)
    }
  }

  return (
    <PageSurface>
      <PageHeader title="الخدمات والأسعار" description="أنواع الكشف والعلاج بسعر ثابت — بيتحط تلقائي في الحساب" />

      <div className="mb-3 grid gap-2 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
        <NewPatientFeeCard />

        <form
          onSubmit={add}
          className="glass grid grid-cols-[minmax(0,1fr)_auto] content-center gap-2 rounded-2xl p-3 sm:grid-cols-[1fr_8rem_auto]"
        >
          <input
            className={cn(inputClass, 'col-span-2 sm:col-span-1')}
            name="name"
            required
            placeholder="اسم الخدمة (مثلاً: حشو عصب)"
          />
          <input className={inputClass} name="price" type="number" min="0" step="1" required placeholder="السعر" />
          <Button type="submit" className="h-11 rounded-xl sm:h-10" disabled={create.isPending}>
            <Plus />
            إضافة
          </Button>
        </form>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : isError ? (
        <EmptyState
          title="تعذر تحميل الخدمات"
          action={<Button onClick={() => void refetch()}>إعادة المحاولة</Button>}
        />
      ) : services.length === 0 ? (
        <EmptyState
          title="لسه مفيش خدمات — ضيف واحدة أو ابدأ بالأساسية"
          action={
            <Button onClick={() => void importDefaults()} disabled={importing}>
              {importing ? 'جاري الإضافة...' : 'إضافة الخدمات الأساسية'}
            </Button>
          }
        />
      ) : (
        <ServiceGroups services={services} />
      )}
    </PageSurface>
  )
}

function ServiceGroups({ services }: { services: Service[] }) {
  const groups = useMemo(() => groupByFirstWord(services, (s) => s.name), [services])
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className="@container">
      <div className="grid items-start gap-2 @2xl:grid-cols-2">
        {groups.map((group) => {
          if (group.items.length === 1) {
            const s = group.items[0]!
            return (
              <article key={s.id} className="glass rounded-2xl px-3 py-2 sm:px-4">
                <ServiceRow service={s} />
              </article>
            )
          }

          const isOpen = open.has(group.key)
          const prices = group.items.map((s) => s.price).filter((p) => p > 0)
          const unpriced = group.items.length - prices.length
          const range =
            prices.length === 0
              ? 'لسه ملهاش أسعار'
              : Math.min(...prices) === Math.max(...prices)
                ? money(prices[0]!)
                : `من ${money(Math.min(...prices))} لـ ${money(Math.max(...prices))}`
          return (
            <article
              key={group.key}
              className={cn('glass overflow-hidden rounded-2xl', isOpen && 'col-span-full ring-2 ring-primary/15')}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggle(group.key)}
                className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-start sm:px-4"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{group.key}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {group.items.length} أنواع · {range}
                  </span>
                </span>
                {unpriced > 0 ? (
                  <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">
                    {unpriced} من غير سعر
                  </span>
                ) : null}
                <span
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-full transition',
                    isOpen ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                  )}
                >
                  <ChevronDown className={cn('size-4 transition-transform', isOpen && 'rotate-180')} />
                </span>
              </button>
              {isOpen ? (
                <div className="grid gap-1 border-t border-border/60 bg-muted/30 p-1.5 sm:p-2 @2xl:grid-cols-2">
                  {group.items.map((s) => (
                    <div key={s.id} className="rounded-xl bg-card px-2.5 py-1.5 sm:px-3">
                      <ServiceRow service={s} label={subServiceName(s.name, group.key)} />
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
    </div>
  )
}

function NewPatientFeeCard() {
  const { settings, isLoading, isError, isFetching, error, dataUpdatedAt, refetch } = useClinicSettings()
  if (isError && !isFetching) {
    return (
      <div className="surface-ink flex items-center gap-3 rounded-2xl p-3 text-white shadow-clinic">
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-bold">سعر الكشف</h2>
          <p className="truncate text-xs text-white/75">تعذر تحميل السعر — {apiErrorMessage(error)}</p>
        </div>
        <Button type="button" variant="secondary" className="h-11 shrink-0 rounded-xl px-4" onClick={() => void refetch()}>
          حاول تاني
        </Button>
      </div>
    )
  }
  return (
    <NewPatientFeeForm
      key={isLoading ? 'loading' : dataUpdatedAt}
      current={settings.newPatientFee}
      loading={isLoading}
    />
  )
}

/** وهو بيحمّل الخانة مقفولة — الحفظ بيبعت كل الإعدادات فلازم تكون اتحمّلت الأول */
function NewPatientFeeForm({ current, loading }: { current: number; loading: boolean }) {
  const { settings } = useClinicSettings()
  const save = useSaveClinicSettings()
  const [fee, setFee] = useState(String(current))
  const dirty = fee !== '' && Number(fee) !== current

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!dirty) return
    try {
      await save.mutateAsync({ ...settings, newPatientFee: Number(fee) })
      toast.success(`سعر الكشف بقى ${money(Number(fee))}`)
    } catch (err) {
      toast.error(errorText(err, 'حصل خطأ أثناء الحفظ'))
    }
  }

  return (
    <form onSubmit={submit} className="surface-ink flex items-center gap-3 rounded-2xl p-3 text-white shadow-clinic">
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-bold">سعر الكشف</h2>
        <p className="truncate text-xs text-white/75">
          {loading ? 'جاري تحميل السعر...' : `للمريض الجديد · دلوقتي ${money(current)}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <input
          className={cn(
            inputClass,
            'h-11 w-24 border-white/30 bg-white px-2.5 text-center font-semibold text-foreground sm:w-28',
          )}
          type="number"
          min="0"
          step="1"
          required
          value={loading ? '' : fee}
          placeholder={loading ? '…' : ''}
          disabled={loading}
          onChange={(e) => setFee(e.target.value)}
          aria-label="سعر الكشف"
        />
        <Button
          type="submit"
          variant="secondary"
          className="h-11 rounded-xl px-4"
          disabled={loading || !dirty || save.isPending}
        >
          حفظ
        </Button>
      </div>
    </form>
  )
}

function ServiceRow({ service, label }: { service: Service; label?: string }) {
  const update = useUpdateServicePrice()
  const remove = useDeleteService()
  const [price, setPrice] = useState(String(service.price))
  const dirty = Number(price || 0) !== service.price

  const save = async () => {
    if (!dirty) return
    try {
      await update.mutateAsync({ id: service.id, price: Number(price || 0) })
      toast.success(`سعر ${service.name} بقى ${money(Number(price || 0))}`)
    } catch (err) {
      toast.error(errorText(err, 'حصل خطأ أثناء الحفظ'))
    }
  }

  const del = async () => {
    if (!window.confirm(`حذف خدمة "${service.name}"؟`)) return
    try {
      await remove.mutateAsync(service.id)
      toast.success('اتحذفت الخدمة')
    } catch (err) {
      toast.error(errorText(err, 'حصل خطأ أثناء الحذف'))
    }
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-semibold">{label ?? service.name}</h3>
        <p className={cn('text-xs', service.price > 0 ? 'text-muted-foreground' : 'font-semibold text-warning')}>
          {service.price > 0 ? money(service.price) : 'لسه ملوش سعر'}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <input
          className={cn(inputClass, 'w-20 px-2.5 text-center sm:w-28')}
          type="number"
          min="0"
          step="1"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save()
          }}
          aria-label={`سعر ${service.name}`}
        />
        <Button
          className="h-11 rounded-xl px-3 sm:h-10"
          variant={dirty ? 'default' : 'outline'}
          disabled={!dirty || update.isPending}
          onClick={() => void save()}
        >
          حفظ
        </Button>
        <Button
          variant="ghost"
          className="size-11 rounded-xl px-0 text-destructive sm:size-10"
          disabled={remove.isPending}
          onClick={() => void del()}
          aria-label={`حذف ${service.name}`}
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  )
}
