import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { FormPage } from '@/components/clinic/form-layout'
import { ChargeFields, useChargeForm } from '@/components/clinic/charge-fields'
import { useCreateVisit } from '@/lib/clinic-hooks'

export const Route = createFileRoute('/patients/$patientId/visits/new')({
  head: () => ({
    meta: [
      { title: 'تسجيل علاج — عيادة الغندور' },
      { name: 'description', content: 'تسجيل علاج وسعر ودفعة اليوم للمريض.' },
      { property: 'og:title', content: 'تسجيل علاج — عيادة الغندور' },
      { property: 'og:description', content: 'تسجيل علاج وسعر ودفعة اليوم للمريض.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: AddVisit,
})

function AddVisit() {
  const { patientId } = Route.useParams()
  const nav = useNavigate()
  const create = useCreateVisit()
  const [saving, setSaving] = useState(false)
  const form = useChargeForm()

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (saving) return
    const { charge, paidN } = form
    if (!form.treatment) {
      toast.error('اختار نوع العلاج')
      return
    }
    if (charge.base <= 0) {
      toast.error(form.isAdmin ? 'أدخل سعر العلاج' : 'الخدمة دي مالهاش سعر — الدكتور يحدده من صفحة الأسعار')
      return
    }
    if (paidN > charge.final) {
      toast.error('المدفوع النهاردة أكبر من الإجمالي بعد الخصم')
      return
    }
    setSaving(true)
    try {
      await create.mutateAsync({
        patientId,
        treatment: form.treatment,
        basePrice: charge.base,
        discountPercent: form.discount,
        paidToday: paidN,
      })
      toast.success('تم تسجيل العلاج والدفعة ✅')
      void nav({ to: '/patients/$patientId', params: { patientId } })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'حصل خطأ أثناء الحفظ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormPage
      mode="compact"
      title="تسجيل علاج ودفعة"
      description="العلاج والسعر والمدفوع النهاردة في شاشة واحدة."
      submitLabel={saving ? 'جاري الحفظ...' : 'حفظ العلاج والدفعة'}
      submitDisabled={saving}
      onSubmit={submit}
    >
      <ChargeFields form={form} />
    </FormPage>
  )
}
