import { createFileRoute } from '@tanstack/react-router'
import { FormEvent, useMemo, useState } from 'react'
import { Package, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ArabicDatePicker } from '@/components/clinic/appointments'
import { PageSurface } from '@/components/clinic/app-shell'
import { AdminOnly } from '@/components/clinic/admin-only'
import { inputClass } from '@/components/clinic/form-layout'
import { EmptyState, Field, LoadingSkeleton, PageHeader } from '@/components/clinic/ui'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  useAddMaterialMovement,
  useCreateMaterialInvoice,
  useDeleteMaterialInvoice,
  useMaterialInvoices,
  useMaterialMovements,
  useTodayKey,
} from '@/lib/clinic-hooks'
import { errorText } from '@/lib/api-errors'
import { money, parseDayKey } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { MaterialInvoice, MaterialMovement } from '@/types'

export const Route = createFileRoute('/materials')({
  head: () => ({
    meta: [
      { title: 'الخامات — عيادة الغندور' },
      { name: 'description', content: 'فواتير الخامات وحركات السداد والخصم.' },
    ],
  }),
  component: () => (
    <AdminOnly>
      <MaterialsPage />
    </AdminOnly>
  ),
})

function MaterialsPage() {
  const invoicesQ = useMaterialInvoices()
  const movesQ = useMaterialMovements()
  const remove = useDeleteMaterialInvoice()
  const invoices = invoicesQ.data ?? []
  const movements = movesQ.data ?? []
  const isLoading = invoicesQ.isLoading || movesQ.isLoading

  const byInvoice = useMemo(() => {
    const map = new Map<string, MaterialMovement[]>()
    for (const m of movements) {
      const list = map.get(m.invoiceId) ?? []
      list.push(m)
      map.set(m.invoiceId, list)
    }
    for (const list of map.values()) list.sort((a, b) => a.createdAt - b.createdAt)
    return map
  }, [movements])

  const rows = useMemo(() => {
    return invoices.map((inv) => {
      const moves = byInvoice.get(inv.id) ?? []
      const paid = moves.reduce((s, m) => s + m.paid, 0)
      const discount = moves.reduce((s, m) => s + m.discount, 0)
      const remaining = Math.max(0, inv.total - paid - discount)
      return { inv, moves, paid, discount, remaining }
    })
  }, [invoices, byInvoice])

  const erase = async (inv: MaterialInvoice) => {
    if (!window.confirm(`تمسح فاتورة «${inv.name}» وكل حركاتها؟`)) return
    try {
      await remove.mutateAsync(inv.id)
      toast.success('اتمسحت الفاتورة')
    } catch (err) {
      toast.error(errorText(err, 'حصل خطأ أثناء المسح'))
    }
  }

  return (
    <PageSurface className="flex h-auto flex-col lg:h-full lg:overflow-hidden">
      <PageHeader
        title="فواتير الخامات"
        description="كل فاتورة وحركات السداد والخصم — عشان تراجع أي غلط"
        action={<AddInvoice />}
      />

      {isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : invoicesQ.isError || movesQ.isError ? (
        <EmptyState title="تعذر تحميل الفواتير" description="حاول تاني" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Package className="size-6" />}
          title="لسه مفيش فواتير خامات"
          description="سجّل أول فاتورة من المورد"
        />
      ) : (
        <div className="grid min-h-0 flex-1 content-start gap-3 overflow-auto">
          {rows.map(({ inv, moves, paid, discount, remaining }) => (
            <article key={inv.id} className="rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:p-4">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-bold">{inv.name}</h2>
                  <p className="text-xs text-muted-foreground">{inv.date}</p>
                </div>
                <button
                  type="button"
                  className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-destructive"
                  onClick={() => void erase(inv)}
                  aria-label="مسح الفاتورة"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="إجمالي الفاتورة" value={money(inv.total)} />
                <Stat label="المدفوع" value={money(paid)} tone="text-success" />
                <Stat label="الخصم" value={money(discount)} />
                <Stat
                  label="المتبقي"
                  value={remaining ? money(remaining) : 'خالص'}
                  tone={remaining ? 'text-warning' : 'text-success'}
                />
              </div>

              <div className="mt-3 overflow-x-auto rounded-xl border border-border/60">
                <table className="w-full min-w-[28rem] text-xs sm:text-sm">
                  <thead className="bg-muted/60 text-[11px] font-bold text-muted-foreground">
                    <tr>
                      <th className="px-2.5 py-2 text-start">التاريخ</th>
                      <th className="px-2.5 py-2 text-start">دفعت</th>
                      <th className="px-2.5 py-2 text-start">خصمت</th>
                      <th className="px-2.5 py-2 text-start">فاضل</th>
                      <th className="px-2.5 py-2 text-start">ملاحظة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {moves.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-2.5 py-3 text-muted-foreground">
                          لسه مفيش سداد على الفاتورة دي
                        </td>
                      </tr>
                    ) : (
                      moves.map((m) => (
                        <tr key={m.id}>
                          <td className="px-2.5 py-2 whitespace-nowrap">{m.date}</td>
                          <td className="px-2.5 py-2 font-semibold text-success">{m.paid ? money(m.paid) : '—'}</td>
                          <td className="px-2.5 py-2">{m.discount ? money(m.discount) : '—'}</td>
                          <td className="px-2.5 py-2 font-semibold">{money(m.remainingAfter)}</td>
                          <td className="px-2.5 py-2 text-muted-foreground">{m.note || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {remaining > 0 ? (
                <div className="mt-2">
                  <AddMovement invoiceId={inv.id} remaining={remaining} />
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </PageSurface>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-muted/40 px-2.5 py-2">
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <p className={cn('font-display text-sm font-bold', tone)}>{value}</p>
    </div>
  )
}

function AddInvoice() {
  const create = useCreateMaterialInvoice()
  const today = useTodayKey()
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(today)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const dateStr = date || today
    const spentAt = dateStr === today ? new Date() : new Date(parseDayKey(dateStr).setHours(12))
    try {
      await create.mutateAsync({
        name: String(data.get('name') ?? ''),
        total: Number(data.get('total') || 0),
        paid: Number(data.get('paid') || 0),
        discount: Number(data.get('discount') || 0),
        spentAt,
      })
      toast.success('اتسجلت فاتورة الخامات ✅')
      form.reset()
      setDate(today)
      setOpen(false)
    } catch (err) {
      toast.error(errorText(err, 'حصل خطأ أثناء الحفظ'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-9 rounded-xl">
          <Plus className="size-4" />
          فاتورة جديدة
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-2xl" dir="rtl">
        <DialogHeader className="text-start">
          <DialogTitle>فاتورة خامات</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <Field dense label="اسم المورد / الفاتورة">
            <input className={inputClass} name="name" required placeholder="مثلاً: شركة الأسنان — فاتورة 12" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field dense label="إجمالي الفاتورة">
              <input className={inputClass} name="total" type="number" min="1" step="1" required placeholder="0" />
            </Field>
            <div className="grid gap-1 text-sm font-semibold">
              التاريخ
              <ArabicDatePicker past value={date} onChange={setDate} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field dense label="مدفوع دلوقتي" hint="اختياري">
              <input className={inputClass} name="paid" type="number" min="0" step="1" placeholder="0" />
            </Field>
            <Field dense label="خصم" hint="اختياري">
              <input className={inputClass} name="discount" type="number" min="0" step="1" placeholder="0" />
            </Field>
          </div>
          <Button type="submit" className="h-11 rounded-xl" disabled={create.isPending}>
            {create.isPending ? 'جاري الحفظ...' : 'حفظ الفاتورة'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddMovement({ invoiceId, remaining }: { invoiceId: string; remaining: number }) {
  const add = useAddMaterialMovement()
  const today = useTodayKey()
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(today)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const dateStr = date || today
    const spentAt = dateStr === today ? new Date() : new Date(parseDayKey(dateStr).setHours(12))
    try {
      const result = await add.mutateAsync({
        invoiceId,
        paid: Number(data.get('paid') || 0),
        discount: Number(data.get('discount') || 0),
        note: String(data.get('note') ?? ''),
        spentAt,
      })
      toast.success(
        result.remainingAfter > 0
          ? `اتسجل السداد · فاضل ${money(result.remainingAfter)}`
          : 'اتقفل الحساب على الفاتورة ✅',
      )
      form.reset()
      setDate(today)
      setOpen(false)
    } catch (err) {
      toast.error(errorText(err, 'حصل خطأ أثناء التسجيل'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl">
          <Plus className="size-4" />
          سداد / خصم
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm rounded-2xl" dir="rtl">
        <DialogHeader className="text-start">
          <DialogTitle>حركة سداد — متبقي {money(remaining)}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Field dense label="دفعت">
              <input className={inputClass} name="paid" type="number" min="0" step="1" placeholder="0" />
            </Field>
            <Field dense label="خصمت">
              <input className={inputClass} name="discount" type="number" min="0" step="1" placeholder="0" />
            </Field>
          </div>
          <div className="grid gap-1 text-sm font-semibold">
            التاريخ
            <ArabicDatePicker past value={date} onChange={setDate} />
          </div>
          <Field dense label="ملاحظة" hint="اختياري">
            <input className={inputClass} name="note" placeholder="مثلاً: دفعة جزئية" />
          </Field>
          <Button type="submit" className="h-11 rounded-xl" disabled={add.isPending}>
            {add.isPending ? 'جاري...' : 'تسجيل الحركة'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
