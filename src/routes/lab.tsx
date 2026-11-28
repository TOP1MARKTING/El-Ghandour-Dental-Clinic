import { createFileRoute } from '@tanstack/react-router'
import { FormEvent, useMemo, useState } from 'react'
import { FlaskConical, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ArabicDatePicker } from '@/components/clinic/appointments'
import { PageSurface } from '@/components/clinic/app-shell'
import { AdminOnly } from '@/components/clinic/admin-only'
import { inputClass } from '@/components/clinic/form-layout'
import { EmptyState, Field, LoadingSkeleton, PageHeader } from '@/components/clinic/ui'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useCreateLabEntry, useDeleteLabEntry, useLabEntries, useTodayKey } from '@/lib/clinic-hooks'
import { errorText } from '@/lib/api-errors'
import { money, monthKey, parseDayKey } from '@/lib/format'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/lab')({
  head: () => ({
    meta: [
      { title: 'المعمل — عيادة الغندور' },
      { name: 'description', content: 'سجل حالات المعمل وإجمالي الشهر.' },
    ],
  }),
  component: () => (
    <AdminOnly>
      <LabPage />
    </AdminOnly>
  ),
})

function LabPage() {
  const today = useTodayKey()
  const [month, setMonth] = useState(() => monthKey(parseDayKey(today)))
  const { data: entries = [], isLoading, isError, refetch } = useLabEntries()
  const remove = useDeleteLabEntry()

  const months = useMemo(() => {
    const keys = new Set(entries.map((e) => e.dayKey.slice(0, 7)))
    keys.add(monthKey(parseDayKey(today)))
    return [...keys].sort((a, b) => b.localeCompare(a))
  }, [entries, today])

  const filtered = useMemo(
    () => entries.filter((e) => e.dayKey.startsWith(month)),
    [entries, month],
  )
  const monthTotal = filtered.reduce((s, e) => s + e.amount, 0)

  const erase = async (id: string, name: string) => {
    if (!window.confirm(`تمسح سجل «${name}» من المعمل؟`)) return
    try {
      await remove.mutateAsync(id)
      toast.success('اتمسح من سجل المعمل')
    } catch (err) {
      toast.error(errorText(err, 'حصل خطأ أثناء المسح'))
    }
  }

  return (
    <PageSurface className="flex h-auto flex-col lg:h-full lg:overflow-hidden">
      <PageHeader
        title="سجل المعمل"
        description="حالات اتبعتت للمعمل والمبالغ المستحقة أو المدفوعة"
        action={<AddLabEntry />}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-xl bg-muted/70 p-1">
          {months.map((m) => {
            const [y, mo] = m.split('-')
            const active = month === m
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMonth(m)}
                className={cn(
                  'min-h-8 rounded-lg px-2.5 text-xs font-semibold transition',
                  active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
                )}
              >
                {mo}/{y}
              </button>
            )
          })}
        </div>
        <p className="ms-auto rounded-xl bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary">
          إجمالي الشهر: {money(monthTotal)}
        </p>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : isError ? (
        <EmptyState
          title="تعذر تحميل سجل المعمل"
          description="حاول تاني"
          action={
            <Button type="button" variant="outline" onClick={() => void refetch()}>
              إعادة المحاولة
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FlaskConical className="size-6" />}
          title="مفيش حالات في الشهر ده"
          description="ضيف حالة من زرار «حالة جديدة»"
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border/70 bg-card">
          <table className="w-full min-w-[32rem] text-sm">
            <thead className="sticky top-0 bg-muted/80 text-xs font-bold text-muted-foreground backdrop-blur">
              <tr>
                <th className="px-3 py-2.5 text-start">التاريخ</th>
                <th className="px-3 py-2.5 text-start">اسم الحالة</th>
                <th className="px-3 py-2.5 text-start">المبلغ</th>
                <th className="px-3 py-2.5 text-end" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td className="px-3 py-2.5 whitespace-nowrap">{e.date || e.dayKey}</td>
                  <td className="px-3 py-2.5 font-semibold">
                    {e.caseName}
                    {e.note ? <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{e.note}</span> : null}
                  </td>
                  <td className="px-3 py-2.5 font-display font-semibold">{money(e.amount)}</td>
                  <td className="px-3 py-2.5 text-end">
                    <button
                      type="button"
                      className="inline-grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-destructive"
                      onClick={() => void erase(e.id, e.caseName)}
                      aria-label="مسح"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-muted/40 font-bold">
                <td className="px-3 py-2.5" colSpan={2}>
                  إجمالي الشهر
                </td>
                <td className="px-3 py-2.5 font-display text-primary">{money(monthTotal)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </PageSurface>
  )
}

function AddLabEntry() {
  const create = useCreateLabEntry()
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
        caseName: String(data.get('caseName') ?? ''),
        amount: Number(data.get('amount') || 0),
        note: String(data.get('note') ?? ''),
        spentAt,
      })
      toast.success('اتسجلت الحالة في المعمل ✅')
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
          حالة جديدة
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-2xl" dir="rtl">
        <DialogHeader className="text-start">
          <DialogTitle>تسجيل حالة معمل</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <Field dense label="اسم الحالة">
            <input className={inputClass} name="caseName" required placeholder="مثلاً: تاج زيركونيا — أحمد" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field dense label="المبلغ">
              <input className={inputClass} name="amount" type="number" min="0" step="1" required placeholder="0" />
            </Field>
            <div className="grid gap-1 text-sm font-semibold">
              التاريخ
              <ArabicDatePicker past value={date} onChange={setDate} />
            </div>
          </div>
          <Field dense label="ملاحظة" hint="اختياري">
            <input className={inputClass} name="note" placeholder="تفاصيل إضافية" />
          </Field>
          <Button type="submit" className="h-11 rounded-xl" disabled={create.isPending}>
            {create.isPending ? 'جاري الحفظ...' : 'حفظ'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
