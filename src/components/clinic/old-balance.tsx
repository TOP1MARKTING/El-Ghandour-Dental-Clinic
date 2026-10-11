import { useState } from 'react'
import { History } from 'lucide-react'
import { toast } from 'sonner'
import { Field } from '@/components/clinic/ui'
import { inputClass } from '@/components/clinic/form-layout'
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
import { errorText } from '@/lib/api-errors'
import { useAddOldBalance } from '@/lib/clinic-hooks'
import { money } from '@/lib/format'
import { cn } from '@/lib/utils'

export function useOldBalanceForm() {
  const [label, setLabel] = useState('')
  const [total, setTotal] = useState('')
  const [paid, setPaid] = useState('')
  const totalN = Math.round(Number(total || 0))
  const paidN = Math.round(Number(paid || 0))
  return {
    label,
    setLabel,
    total,
    setTotal,
    paid,
    setPaid,
    totalN,
    paidN,
    remaining: Math.max(0, totalN - paidN),
    /** "" لو الأرقام سليمة */
    error: totalN <= 0 ? 'اكتب إجمالي الحساب القديم' : paidN < 0 || paidN > totalN ? 'المدفوع أكبر من الإجمالي' : '',
    reset: () => {
      setLabel('')
      setTotal('')
      setPaid('')
    },
  }
}

export type OldBalanceForm = ReturnType<typeof useOldBalanceForm>

export function OldBalanceFields({ form }: { form: OldBalanceForm }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <Field dense label="كان بيعمل إيه" hint="اختياري" className="col-span-2">
        <input
          className={cn(inputClass, 'bg-card')}
          value={form.label}
          onChange={(e) => form.setLabel(e.target.value)}
          placeholder="مثال: تقويم"
        />
      </Field>
      <Field dense label="الإجمالي">
        <input
          className={cn(inputClass, 'bg-card')}
          type="number"
          min="0"
          step="1"
          value={form.total}
          onChange={(e) => form.setTotal(e.target.value)}
          placeholder="0"
        />
      </Field>
      <Field dense label="المدفوع">
        <input
          className={cn(inputClass, 'bg-card')}
          type="number"
          min="0"
          step="1"
          value={form.paid}
          onChange={(e) => form.setPaid(e.target.value)}
          placeholder="0"
        />
      </Field>
      <div className="col-span-2 flex items-center justify-between rounded-xl border border-border/70 bg-card px-3 py-2 text-sm font-semibold">
        <span className="text-muted-foreground">الباقي</span>
        <span className={cn('font-display', form.remaining > 0 ? 'text-warning' : 'text-success')}>
          {money(form.remaining)}
        </span>
      </div>
    </div>
  )
}

export function OldBalanceDialog({ patientId, patientName }: { patientId: string; patientName: string }) {
  const [open, setOpen] = useState(false)
  const add = useAddOldBalance()
  const form = useOldBalanceForm()

  const save = async () => {
    if (form.error) {
      toast.error(form.error)
      return
    }
    try {
      await add.mutateAsync({ patientId, patientName, label: form.label, total: form.totalN, paid: form.paidN })
      toast.success(`اتسجل الحساب القديم · الباقي ${money(form.remaining)}`)
      form.reset()
      setOpen(false)
    } catch (err) {
      toast.error(errorText(err, 'حصل خطأ أثناء الحفظ'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="mt-2 h-10 w-full rounded-xl text-sm">
          <History className="size-4" />
          إضافة حساب قديم
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="rounded-3xl">
        <DialogHeader className="text-right">
          <DialogTitle>حساب قديم — {patientName}</DialogTitle>
          <DialogDescription>
            حساب من قبل السيستم، زي تقويم بأسعار قديمة. بيتزود على حسابه، ومش بيتحسب في فلوس النهاردة.
          </DialogDescription>
        </DialogHeader>
        <OldBalanceFields form={form} />
        <DialogFooter className="gap-2 sm:flex-row-reverse">
          <Button onClick={() => void save()} disabled={add.isPending}>
            {add.isPending ? 'جاري الحفظ...' : 'حفظ الحساب القديم'}
          </Button>
          <DialogClose asChild>
            <Button variant="outline">إلغاء</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
