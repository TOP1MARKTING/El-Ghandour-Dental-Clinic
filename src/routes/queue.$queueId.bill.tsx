import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { FormEvent, useEffect, useState } from 'react'
import { CalendarDays, WalletCards } from 'lucide-react'
import { toast } from 'sonner'
import { errorText } from '@/lib/api-errors'
import { Field, EmptyState, LoadingSkeleton } from '@/components/clinic/ui'
import { FormPage, inputClass } from '@/components/clinic/form-layout'
import { ChargeFields, useChargeForm } from '@/components/clinic/charge-fields'
import { Button } from '@/components/ui/button'
import { Link } from '@tanstack/react-router'
import { money } from '@/lib/format'
import { useCreateAppointment, useQueueEntry, useSettleQueueBilling } from '@/lib/clinic-hooks'
import { AppointmentDateField, formatAppointmentDay } from '@/components/clinic/appointments'

export const Route = createFileRoute('/queue/$queueId/bill')({
  head: () => ({
    meta: [
      { title: 'تسجيل الحساب — عيادة الغندور' },
      { name: 'description', content: 'تسجيل سعر العلاج والمدفوع بعد الكشف.' },
      { property: 'og:title', content: 'تسجيل الحساب — عيادة الغندور' },
      { property: 'og:description', content: 'تسجيل سعر العلاج والمدفوع بعد الكشف.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: QueueBill,
})

const PLACEHOLDER_REASONS = new Set(['كشف جديد', 'متابعة', 'كشف'])

function QueueBill() {
  const { queueId } = Route.useParams()
  const nav = useNavigate()
  const { data: entry, isLoading, isError } = useQueueEntry(queueId)
  const settle = useSettleQueueBilling()
  const [saving, setSaving] = useState(false)
  const form = useChargeForm()
  const createAppointment = useCreateAppointment()
  const [followDate, setFollowDate] = useState('')

  useEffect(() => {
    const reason = entry?.reason
    if (reason && !PLACEHOLDER_REASONS.has(reason) && !entry.billed && !form.treatment) form.setTreatment(reason)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.reason, entry?.billed])

  if (isLoading) {
    return (
      <FormPage mode="compact" title="تسجيل الحساب" description="جاري التحميل..." submitLabel="..." onSubmit={(e) => e.preventDefault()}>
        <div className="sm:col-span-2">
          <LoadingSkeleton rows={3} />
        </div>
      </FormPage>
    )
  }

  if (isError || !entry) {
    return (
      <FormPage mode="compact" title="تسجيل الحساب" description="الدور غير موجود" submitLabel="رجوع" onSubmit={(e) => { e.preventDefault(); void nav({ to: '/' }) }}>
        <div className="sm:col-span-2">
          <EmptyState
            title="مفيش دور بالرقم ده"
            action={
              <Button asChild>
                <Link to="/">الرئيسية</Link>
              </Button>
            }
          />
        </div>
      </FormPage>
    )
  }

  if (entry.status === 'تم الكشف' || entry.status === 'ملغي') {
    return (
      <FormPage
        mode="compact"
        icon={<WalletCards className="size-4" />}
        title="تسجيل الحساب"
        description="الدور ده خلص بالفعل"
        submitLabel="رجوع للرئيسية"
        onSubmit={(e) => {
          e.preventDefault()
          void nav({ to: '/' })
        }}
      >
        <p className="sm:col-span-2 text-sm text-muted-foreground">
          {entry.patientName} — الحالة: {entry.status}
        </p>
      </FormPage>
    )
  }

  const { charge, paidN, remaining } = form

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (saving) return
    if (!form.treatment.trim()) {
      toast.error('اختار اللي اتعمل')
      return
    }
    if (charge.base <= 0) {
      toast.error(form.isAdmin ? 'أدخل سعر الاتفاق' : 'الخدمة دي مالهاش سعر — الدكتور يحدده من صفحة الأسعار')
      return
    }
    if (paidN < 0 || paidN > charge.final) {
      toast.error('المدفوع لازم يكون بين 0 والإجمالي بعد الخصم')
      return
    }
    setSaving(true)
    try {
      await settle.mutateAsync({
        queueId: entry.id,
        treatment: form.treatment,
        basePrice: charge.base,
        discountPercent: form.discount,
        paidToday: paidN,
        notes: String(new FormData(e.currentTarget).get('notes') ?? ''),
      })
      let followMsg = ''
      if (followDate) {
        try {
          await createAppointment.mutateAsync({
            patientId: entry.patientId,
            date: followDate,
            time: '',
            note: form.treatment,
          })
          followMsg = ` · الموعد الجاي ${formatAppointmentDay(followDate)}`
        } catch (err) {
          toast.error(errorText(err, 'الحساب اتسجل بس الموعد ما اتحجزش'))
        }
      }
      toast.success(
        (paidN >= charge.final ? 'تم تسجيل الحساب — اتدفع كامل ✅' : `تم — الباقي ${money(remaining)}`) + followMsg,
      )
      void nav({ to: '/', replace: true })
    } catch (err) {
      toast.error(errorText(err, 'حصل خطأ أثناء التسجيل'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormPage
      mode="compact"
      icon={<WalletCards className="size-4" />}
      title="تسجيل الحساب"
      description={`${entry.patientName} · دور ${entry.order}`}
      submitLabel={saving ? 'جاري الحفظ...' : 'حفظ الحساب وإنهاء الدور'}
      submitDisabled={saving}
      onSubmit={submit}
    >
      <div className="sm:col-span-2 rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 text-sm">
        {entry.billed
          ? `اتحاسب عند الحجز على "${entry.reason}" بـ ${money(entry.billedTotal ?? 0)} — سجّل هنا اللي اتعمل زيادة بس.`
          : 'بعد ما خرج من عند الدكتور — اختار اللي اتعمل وسجّل كام اتدفع النهاردة.'}
      </div>

      <ChargeFields form={form} treatmentLabel="العلاج اللي اتعمل" autoFocusPrice />

      <div className="col-span-full grid gap-1 rounded-2xl border border-border/70 bg-muted/25 p-3 text-sm font-semibold">
        <span className="flex items-center gap-2">
          <CalendarDays className="size-4 text-primary" />
          موعد المتابعة
          <span className="text-xs font-normal text-muted-foreground">(لو الدكتور قال يرجع يوم معين)</span>
        </span>
        <AppointmentDateField date={followDate} setDate={setFollowDate} />
      </div>

      <Field dense label="ملاحظة" hint="اختياري" className="sm:col-span-2">
        <input className={inputClass} name="notes" placeholder="أي تفاصيل عن الاتفاق" />
      </Field>
    </FormPage>
  )
}
