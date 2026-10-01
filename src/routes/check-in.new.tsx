import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { FormEvent, useState } from 'react'
import { Check, ClipboardPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Field } from '@/components/clinic/ui'
import { FormPage, inputClass } from '@/components/clinic/form-layout'
import { ChargeFields, useChargeForm } from '@/components/clinic/charge-fields'
import { useCheckInNew, useClinicSettings } from '@/lib/clinic-hooks'
import { money } from '@/lib/format'

export const Route = createFileRoute('/check-in/new')({
  head: () => ({
    meta: [
      { title: 'حجز مريض جديد — عيادة الغندور' },
      { name: 'description', content: 'تسجيل مريض جديد في دور العيادة.' },
      { property: 'og:title', content: 'حجز مريض جديد — عيادة الغندور' },
      { property: 'og:description', content: 'تسجيل مريض جديد في دور العيادة.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: CheckInNew,
})

function CheckInNew() {
  const nav = useNavigate()
  const checkIn = useCheckInNew()
  const [saving, setSaving] = useState(false)
  const form = useChargeForm()
  const { settings, isLoading: settingsLoading } = useClinicSettings()
  const fee = settings.newPatientFee

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (saving) return
    const data = new FormData(e.currentTarget)
    const reason = form.treatment.trim()
    const { charge, paidN } = form
    if (charge.base <= 0 && paidN > 0) {
      toast.error('حط إجمالي السعر الأول')
      return
    }
    if (paidN > charge.final) {
      toast.error('المدفوع أكبر من الإجمالي')
      return
    }
    setSaving(true)
    try {
      const name = String(data.get('name') ?? '').trim()
      await checkIn.mutateAsync({
        name,
        age: Number(data.get('age') || 0),
        phone: String(data.get('phone') ?? ''),
        address: String(data.get('address') ?? ''),
        feePrice: fee,
        feePaid: true,
        ...(reason ? { reason } : {}),
        ...(charge.base > 0
          ? { charge: { basePrice: charge.base, discountPercent: form.discount, paidToday: paidN } }
          : {}),
      })
      const owed = charge.base > 0 ? form.remaining : 0
      toast.success(
        owed > 0
          ? `${name} اتسجل · لسه عليه ${money(owed)}`
          : `${name} اتسجل ✅`,
      )
      void nav({ to: '/', replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'حصل خطأ أثناء الحجز')
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormPage
      mode="compact"
      icon={<ClipboardPlus className="size-4" />}
      title="حجز مريض جديد"
      description="أول مرة — سجّل بياناته والكشف"
      submitLabel={saving ? 'جاري التسجيل...' : 'تسجيل المريض'}
      submitDisabled={saving || settingsLoading}
      onSubmit={submit}
      wide
      gridClassName="lg:grid-rows-[auto_1fr]"
    >
      <div className="col-span-full grid content-start gap-2.5 sm:grid-cols-2 sm:gap-x-3 lg:col-span-1 lg:col-start-1 lg:row-start-1">
        <Field dense label="اسم المريض">
          <input className={inputClass} name="name" required autoFocus placeholder="الاسم بالكامل" />
        </Field>

        <Field dense label="السن">
          <input className={inputClass} name="age" type="number" min="1" required placeholder="مثال: 34" />
        </Field>

        <Field dense label="رقم الموبايل">
          <input
            className={inputClass}
            name="phone"
            required
            inputMode="tel"
            placeholder="01xxxxxxxxx"
            dir="ltr"
          />
        </Field>

        <Field dense label="العنوان">
          <input className={inputClass} name="address" required placeholder="المنطقة والعنوان" />
        </Field>

        <div className="flex items-center gap-2.5 rounded-xl border border-success/25 bg-success/5 px-3 py-2.5 sm:col-span-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-success/15 text-success">
            <Check className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">الكشف {money(fee)}</p>
            <p className="text-[11px] text-muted-foreground">هيتسجل إنه دفع الكشف</p>
          </div>
        </div>
      </div>

      <ChargeFields
        form={form}
        treatmentLabel="الخدمة"
        treatmentName="reason"
        treatmentPlaceholder="اختار الخدمة"
        priceRequired={false}
        treatmentRequired={false}
        treatmentClassName="lg:col-span-1 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start"
        panelClassName="lg:col-span-1 lg:col-start-1 lg:row-start-2 lg:self-start"
      />
    </FormPage>
  )
}
