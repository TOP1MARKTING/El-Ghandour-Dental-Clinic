import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { FormEvent, useDeferredValue, useMemo, useState } from 'react'
import { Check, ClipboardPlus, FolderOpen, Search, Stethoscope, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { errorText } from '@/lib/api-errors'
import { Field } from '@/components/clinic/ui'
import { FormPage, inputClass } from '@/components/clinic/form-layout'
import { ChargeFields, useChargeForm } from '@/components/clinic/charge-fields'
import { NursePicker, requireNurseName, useSelectedNurse } from '@/components/clinic/nurse-picker'
import { Button } from '@/components/ui/button'
import { useCheckInNew, useClinicSettings, useMyDoctor, usePatients } from '@/lib/clinic-hooks'
import { money } from '@/lib/format'
import { patientBalance } from '@/lib/pricing'
import { doctorById, type DoctorId } from '@/lib/doctors'
import { DoctorBadge, DoctorPicker } from '@/components/clinic/doctors'
import { cn } from '@/lib/utils'
import type { Patient } from '@/types'

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

type FeeMode = 'كشف' | 'بدون كشف'

function normalizePhone(value: string) {
  return value.replace(/\D/g, '')
}

function CheckInNew() {
  const nav = useNavigate()
  const checkIn = useCheckInNew()
  const [saving, setSaving] = useState(false)
  const myDoctor = useMyDoctor()
  const { data: patients = [] } = usePatients()
  const [doctor, setDoctor] = useState<DoctorId | ''>(myDoctor ?? '')
  const form = useChargeForm()
  const [feeMode, setFeeMode] = useState<FeeMode | ''>('')
  const [feePaid, setFeePaid] = useState(true)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const nursePick = useSelectedNurse()
  const { settings, data: loadedSettings, isLoading: settingsLoading, refetch: reloadSettings } = useClinicSettings()
  const fee = settings.newPatientFee
  const feeMissing = !settingsLoading && !loadedSettings
  const withCheckup = feeMode === 'كشف'

  const nameTerm = useDeferredValue(name.trim())
  const phoneDigits = normalizePhone(phone)
  const nameMatches = useMemo(() => {
    if (nameTerm.length < 2) return [] as Patient[]
    return patients.filter((p) => p.name.includes(nameTerm)).slice(0, 5)
  }, [patients, nameTerm])
  const phoneMatch = useMemo(() => {
    if (phoneDigits.length < 8) return undefined
    return patients.find((p) => normalizePhone(p.phone) === phoneDigits)
  }, [patients, phoneDigits])
  const existingHits = useMemo(() => {
    const map = new Map<string, Patient>()
    for (const p of nameMatches) map.set(p.id, p)
    if (phoneMatch) map.set(phoneMatch.id, phoneMatch)
    return [...map.values()]
  }, [nameMatches, phoneMatch])

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (saving) return
    if (!doctor) {
      toast.error('اختار المريض هيدخل لمين — د. أشرف ولا د. هبة')
      return
    }
    if (!feeMode) {
      toast.error('اختار كشف ولا بدون كشف')
      return
    }
    const nurse = requireNurseName(nursePick.nurse, nursePick.nurses)
    if (!nurse.ok) {
      toast.error(nurse.error)
      return
    }
    const reason = form.treatment.trim()
    const { charge, paidN } = form
    const existing = phoneMatch ?? (nameTerm ? patients.find((p) => p.name === nameTerm) : undefined)
    if (
      existing &&
      !window.confirm(
        `المريض «${existing.name}» موجود قبل كده.\nالأصح تستخدم «زيارة جديدة» على نفس الملف عشان الكشف ما يتكررش.\n\nمتأكد تسجّله كمريض جديد؟`,
      )
    ) {
      return
    }
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
      const patientName = name.trim()
      const feePrice = withCheckup ? fee : 0
      await checkIn.mutateAsync({
        name: patientName,
        age: Number((e.currentTarget.elements.namedItem('age') as HTMLInputElement | null)?.value || 0),
        phone,
        address: String((e.currentTarget.elements.namedItem('address') as HTMLInputElement | null)?.value ?? ''),
        feePrice,
        feePaid: withCheckup ? feePaid : true,
        doctor,
        byName: nurse.name,
        ...(reason ? { reason } : {}),
        ...(charge.base > 0
          ? { charge: { basePrice: charge.base, discountPercent: form.discount, paidToday: paidN } }
          : {}),
      })
      const owed = (charge.base > 0 ? form.remaining : 0) + (withCheckup && !feePaid ? fee : 0)
      toast.success(
        owed > 0
          ? `${patientName} اتسجل مع ${doctorById(doctor).short} · لسه عليه ${money(owed)}`
          : `${patientName} اتسجل مع ${doctorById(doctor).short} ✅`,
      )
      void nav({ to: '/', replace: true })
    } catch (err) {
      toast.error(errorText(err, 'حصل خطأ أثناء الحجز'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormPage
      mode="compact"
      icon={<ClipboardPlus className="size-4" />}
      title="حجز مريض جديد"
      description="ابحث بالاسم الأول — لو موجود قبل كده سجّل على نفس الملف"
      submitLabel={saving ? 'جاري التسجيل...' : 'تسجيل المريض'}
      submitDisabled={saving || settingsLoading || feeMissing || !nursePick.ready}
      onSubmit={submit}
      wide
      gridClassName="lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
    >
      <div className="col-span-full grid content-start gap-2.5 sm:grid-cols-2 sm:gap-x-3 lg:col-span-1">
        <NursePicker
          value={nursePick.nurse}
          onChange={nursePick.setNurse}
          nurses={nursePick.nurses}
          className="sm:col-span-2"
        />

        <Field dense label="هيدخل لمين" className="sm:col-span-2">
          <DoctorPicker value={doctor} onChange={setDoctor} />
        </Field>

        <Field dense label="اسم المريض" className="sm:col-span-2" hint="اكتب حرفين وهنطلعلك لو موجود قبل كده">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className={cn(inputClass, 'pr-10')}
              name="name"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="الاسم بالكامل"
              autoComplete="off"
            />
          </div>
        </Field>

        {existingHits.length > 0 ? (
          <div className="grid gap-2 rounded-xl border border-warning/35 bg-warning/5 p-3 sm:col-span-2">
            <p className="text-sm font-bold text-warning">لقينا مريض بنفس الاسم أو الموبايل — متسجلهوش جديد</p>
            <ul className="grid gap-2">
              {existingHits.map((p) => (
                <ExistingPatientCard key={p.id} patient={p} />
              ))}
            </ul>
          </div>
        ) : null}

        <Field dense label="السن">
          <input className={inputClass} name="age" type="number" min="1" required placeholder="مثال: 34" />
        </Field>

        <Field dense label="رقم الموبايل">
          <input
            className={inputClass}
            name="phone"
            required
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01xxxxxxxxx"
            dir="ltr"
          />
        </Field>

        <Field dense label="العنوان" className="sm:col-span-2">
          <input className={inputClass} name="address" required placeholder="المنطقة والعنوان" />
        </Field>

        {feeMissing ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2.5 sm:col-span-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-destructive">تعذر تحميل سعر الكشف</p>
              <p className="text-[11px] text-muted-foreground">مش هينفع التسجيل غير لما السعر يتحمّل</p>
            </div>
            <Button type="button" variant="outline" size="sm" className="shrink-0 rounded-xl" onClick={() => void reloadSettings()}>
              حاول تاني
            </Button>
          </div>
        ) : (
          <div className="grid gap-2 rounded-xl border border-border/70 bg-muted/25 p-3 sm:col-span-2">
            <p className="text-sm font-semibold">نوع الحضور</p>
            <div role="radiogroup" aria-label="كشف أو بدون كشف" className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'كشف' as const, title: 'كشف', hint: fee > 0 ? `يدفع ${money(fee)}` : 'الكشف ببلاش' },
                  { id: 'بدون كشف' as const, title: 'بدون كشف', hint: 'متابعة قديمة — من غير كشف' },
                ] as const
              ).map((opt) => {
                const active = feeMode === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setFeeMode(opt.id)}
                    className={cn(
                      'rounded-xl border px-3 py-2.5 text-start transition',
                      active
                        ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                        : 'border-border bg-card text-foreground/80 hover:border-foreground/25',
                    )}
                  >
                    <span className="block text-sm font-bold">{opt.title}</span>
                    <span className="mt-0.5 block text-[11px] font-medium opacity-80">{opt.hint}</span>
                  </button>
                )
              })}
            </div>

            {withCheckup ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-success/25 bg-success/5 px-3 py-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-success/15 text-success">
                  <Check className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {settingsLoading ? 'جاري تحميل سعر الكشف...' : fee > 0 ? `الكشف ${money(fee)}` : 'الكشف ببلاش'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {fee <= 0 ? 'سعر الكشف صفر في صفحة الأسعار' : feePaid ? 'دفع الكشف' : 'الكشف هيتسجل عليه'}
                  </p>
                </div>
                {fee > 0 ? (
                  <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-card px-2.5 py-1.5 text-xs font-semibold">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={!feePaid}
                      onChange={(e) => setFeePaid(!e.target.checked)}
                    />
                    مدفعش الكشف
                  </label>
                ) : null}
              </div>
            ) : feeMode === 'بدون كشف' ? (
              <p className="rounded-xl border border-border/70 bg-card px-3 py-2.5 text-xs text-muted-foreground">
                هيتسجل من غير بند كشف — مناسب لمتابعة قديمة كانت بتيجي قبل كده.
              </p>
            ) : (
              <p className="text-xs font-semibold text-warning">لازم تختار كشف أو بدون كشف قبل التسجيل</p>
            )}
          </div>
        )}
      </div>

      <div className="col-span-full grid content-start gap-2.5 lg:col-span-1 lg:self-start">
        <ChargeFields
          form={form}
          treatmentLabel="الخدمة"
          treatmentName="reason"
          treatmentPlaceholder="اختار الخدمة"
          priceRequired={false}
          treatmentRequired={false}
        />
      </div>
    </FormPage>
  )
}

function ExistingPatientCard({ patient: p }: { patient: Patient }) {
  const remaining = patientBalance(p)
  return (
    <li className="rounded-xl border border-border/70 bg-card p-3">
      <div className="flex items-start gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
          <UserRound className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
            <span className="truncate">{p.name}</span>
            <DoctorBadge id={p.doctor} />
          </p>
          <p className="truncate text-xs text-muted-foreground">
            <span dir="ltr">{p.phone}</span>
            {p.lastVisit ? ` · آخر زيارة ${p.lastVisit}` : ''}
            {p.problem ? ` · ${p.problem}` : ''}
          </p>
          <p className="mt-0.5 text-xs font-semibold">
            {remaining > 0 ? <span className="text-warning">عليه {money(remaining)}</span> : <span className="text-success">خالص</span>}
            {` · إجمالي ${money(p.total)}`}
          </p>
        </div>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Button asChild size="sm" className="h-9 rounded-xl">
          <Link to="/check-in/followup" search={{ patient: p.id }}>
            <Stethoscope className="size-3.5" />
            زيارة جديدة
          </Link>
        </Button>
        <Button asChild size="sm" variant="secondary" className="h-9 rounded-xl">
          <Link to="/check-in/followup" search={{ patient: p.id, checkup: true }}>
            كشف جديد
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="h-9 rounded-xl col-span-2 sm:col-span-1">
          <Link to="/patients/$patientId" params={{ patientId: p.id }}>
            <FolderOpen className="size-3.5" />
            فتح الملف
          </Link>
        </Button>
      </div>
    </li>
  )
}
