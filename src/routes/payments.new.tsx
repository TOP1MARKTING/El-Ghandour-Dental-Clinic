import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { errorText } from '@/lib/api-errors'
import { money } from '@/lib/format'
import { patientBalance } from '@/lib/pricing'
import { useCreatePayment, usePatients } from '@/lib/clinic-hooks'
import { Field } from '@/components/clinic/ui'
import { FormPage, inputClass } from '@/components/clinic/form-layout'
import { PatientSearchPicker } from '@/components/clinic/patient-search-picker'

type Search = { patient?: string }

export const Route = createFileRoute('/payments/new')({
  validateSearch: (s: Record<string, unknown>): Search => {
    const patient = s['patient']
    return typeof patient === 'string' ? { patient } : {}
  },
  head: () => ({
    meta: [
      { title: 'تسجيل دفعة — عيادة الغندور' },
      { name: 'description', content: 'تسجيل دفعة على حساب مريض.' },
      { property: 'og:title', content: 'تسجيل دفعة — عيادة الغندور' },
      { property: 'og:description', content: 'تسجيل دفعة على حساب مريض.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: AddPayment,
})

function AddPayment() {
  const { patient: initialPatient } = Route.useSearch()
  const nav = useNavigate()
  const { data: patients = [] } = usePatients()
  const create = useCreatePayment()
  const [patientId, setPatientId] = useState(initialPatient ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (initialPatient) setPatientId(initialPatient)
  }, [initialPatient])

  const selected = useMemo(() => patients.find((p) => p.id === patientId), [patients, patientId])
  const remaining = selected ? patientBalance(selected) : 0
  const knownPatient = Boolean(initialPatient && selected)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (saving) return
    if (!patientId) {
      toast.error('اختار المريض أولاً')
      return
    }
    const data = new FormData(e.currentTarget)
    const amount = Number(data.get('amount') || 0)
    if (amount <= 0) {
      toast.error('أدخل المبلغ المدفوع')
      return
    }
    if (selected && amount > remaining) {
      toast.error('المبلغ أكبر من الباقي على المريض')
      return
    }
    setSaving(true)
    try {
      await create.mutateAsync({
        patientId,
        amount,
        method: 'نقدي',
      })
      toast.success('تم تسجيل الدفعة ✅')
      void nav({ to: '/patients/$patientId', params: { patientId } })
    } catch (err) {
      toast.error(errorText(err, 'حصل خطأ أثناء الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormPage
      mode="compact"
      title="تسجيل دفعة"
      description={
        knownPatient
          ? `الباقي على ${selected?.name}: ${money(remaining)}`
          : 'اختار المريض وسجّل المبلغ المدفوع فقط'
      }
      submitLabel={saving ? 'جاري الحفظ...' : 'تحصيل'}
      submitDisabled={saving}
      onSubmit={submit}
    >
      {!knownPatient ? (
        <Field dense label="المريض" className="sm:col-span-2">
          <PatientSearchPicker value={patientId} onChange={setPatientId} required />
        </Field>
      ) : null}

      {selected && !knownPatient ? (
        <p className="sm:col-span-2 text-sm text-muted-foreground">
          الباقي: <strong className="text-warning">{money(remaining)}</strong>
        </p>
      ) : null}

      <Field dense label="المبلغ المدفوع" className="sm:col-span-2">
        <input
          className={inputClass}
          name="amount"
          type="number"
          min="1"
          step="1"
          required
          autoFocus
          placeholder="0"
        />
      </Field>
    </FormPage>
  )
}
