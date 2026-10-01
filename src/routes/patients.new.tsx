import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { FormEvent, useState } from 'react'
import { UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Field } from '@/components/clinic/ui'
import { FormPage, areaClass, inputClass } from '@/components/clinic/form-layout'
import { ReasonSelect } from '@/components/clinic/reason-select'
import { useCreatePatient } from '@/lib/clinic-hooks'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/patients/new')({
  head: () => ({
    meta: [
      { title: 'إضافة مريض — عيادة الغندور' },
      { name: 'description', content: 'إضافة ملف مريض جديد.' },
      { property: 'og:title', content: 'إضافة مريض — عيادة الغندور' },
      { property: 'og:description', content: 'إضافة ملف مريض جديد.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: AddPatient,
})

function AddPatient() {
  const nav = useNavigate()
  const create = useCreatePatient()
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (saving) return
    const data = new FormData(e.currentTarget)
    setSaving(true)
    try {
      const id = await create.mutateAsync({
        name: String(data.get('name') ?? ''),
        phone: String(data.get('phone') ?? ''),
        age: Number(data.get('age') || 0),
        address: String(data.get('address') ?? ''),
        problem: String(data.get('problem') ?? ''),
        notes: String(data.get('notes') ?? ''),
      })
      toast.success('تم إضافة المريض بنجاح ✅')
      void nav({ to: '/patients/$patientId', params: { patientId: id } })
    } catch {
      toast.error('حصل خطأ أثناء الحفظ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormPage
      mode="compact"
      icon={<UserPlus className="size-4" />}
      title="إضافة مريض جديد"
      description="اكتب البيانات الأساسية بس، وكمّل الملف بعدين."
      submitLabel={saving ? 'جاري الحفظ...' : 'حفظ المريض'}
      submitDisabled={saving}
      onSubmit={submit}
      wide
      gridClassName="lg:grid-rows-[auto_1fr]"
    >
      <div className="col-span-full grid content-start gap-2.5 sm:grid-cols-2 sm:gap-x-3 lg:col-span-1 lg:col-start-1 lg:row-start-1">
        <Field dense label="اسم المريض">
          <input className={inputClass} name="name" required autoFocus placeholder="الاسم بالكامل" />
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
        <Field dense label="السن">
          <input className={inputClass} name="age" type="number" min="1" placeholder="مثال: 34" />
        </Field>
        <Field dense label="العنوان">
          <input className={inputClass} name="address" placeholder="المنطقة والعنوان" />
        </Field>
      </div>

      <Field
        dense
        label="المشكلة / سبب الزيارة"
        className="col-span-full lg:col-span-1 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start"
      >
        <ReasonSelect name="problem" />
      </Field>

      <Field
        dense
        label="ملاحظات"
        hint="اختياري"
        className="col-span-full lg:col-span-1 lg:col-start-1 lg:row-start-2 lg:self-start"
      >
        <textarea className={cn(areaClass, 'min-h-24')} name="notes" placeholder="أي تفاصيل إضافية" />
      </Field>
    </FormPage>
  )
}
