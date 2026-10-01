import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2, ExternalLink, Plus, UserRoundSearch, X } from 'lucide-react'
import { toast } from 'sonner'
import { errorText } from '@/lib/api-errors'
import { Field } from '@/components/clinic/ui'
import { FormPage, inputClass } from '@/components/clinic/form-layout'
import { PatientSearchPicker } from '@/components/clinic/patient-search-picker'
import { ChargeFields, useChargeForm } from '@/components/clinic/charge-fields'
import { PatientTimeline } from '@/components/clinic/patient-timeline'
import { Button } from '@/components/ui/button'
import { useCheckInFollowup, useCreatePayment, usePatients } from '@/lib/clinic-hooks'
import { money } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Patient } from '@/types'

export const Route = createFileRoute('/check-in/followup')({
  head: () => ({
    meta: [
      { title: 'متابعة مريض — عيادة الغندور' },
      { name: 'description', content: 'تسجيل حضور مريض سابق في الدور.' },
      { property: 'og:title', content: 'متابعة مريض — عيادة الغندور' },
      { property: 'og:description', content: 'تسجيل حضور مريض سابق في الدور.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: CheckInFollowup,
})

function CheckInFollowup() {
  const nav = useNavigate()
  const checkIn = useCheckInFollowup()
  const collect = useCreatePayment()
  const { data: patients = [] } = usePatients()
  const [patientId, setPatientId] = useState('')
  const [oldPaid, setOldPaid] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const form = useChargeForm()

  const selected = useMemo(() => patients.find((p) => p.id === patientId) ?? null, [patients, patientId])
  const oldRemaining = selected ? Math.max(0, selected.total - selected.paid) : 0

  const toggleNew = (open: boolean) => {
    setShowNew(open)
    if (!open) {
      form.setTreatment('')
      form.setPaid('')
      form.setDiscount(0)
    }
  }

  useEffect(() => {
    setOldPaid('')
    toggleNew(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId])

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (saving) return
    if (!patientId || !selected) {
      toast.error('اختار المريض من البحث أولاً')
      return
    }
    const reason = form.treatment.trim()
    const { charge, paidN } = form
    if (showNew && !reason) {
      toast.error('اختار الحاجة الجديدة')
      return
    }
    const oldPaidN = Number(oldPaid || 0)
    if (charge.base <= 0 && paidN > 0) {
      toast.error('حط إجمالي السعر الأول')
      return
    }
    if (paidN > charge.final) {
      toast.error('المدفوع أكبر من الإجمالي')
      return
    }
    if (oldPaidN < 0 || oldPaidN > oldRemaining) {
      toast.error('المدفوع من القديم أكبر من اللي عليه')
      return
    }
    setSaving(true)
    try {
      await checkIn.mutateAsync({
        patientId,
        ...(reason ? { reason, isNewTreatment: true } : {}),
        ...(charge.base > 0
          ? { charge: { basePrice: charge.base, discountPercent: form.discount, paidToday: paidN } }
          : {}),
      })
      if (oldPaidN > 0) {
        await collect.mutateAsync({ patientId, amount: oldPaidN, method: 'نقدي', note: 'من الحساب القديم' })
      }
      toast.success('اتسجل إنه جه النهاردة ✅')
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
      icon={<UserRoundSearch className="size-4" />}
      title="متابعة مريض"
      description="اختار المريض — هتشوف عمل إيه قبل كده وعليه كام"
      submitLabel={saving ? 'جاري التسجيل...' : 'تسجيل الحضور وإعطاء رقم'}
      submitDisabled={saving}
      onSubmit={submit}
      wide={!!selected}
    >
      <Field dense label="المريض" className="col-span-full">
        <PatientSearchPicker value={patientId} onChange={setPatientId} required />
      </Field>

      {selected ? (
        <>
          <div className="col-span-full grid content-start gap-2.5 lg:col-span-1">
            <PatientSummary patient={selected} remaining={oldRemaining} />
            <OldBalance patientId={selected.id} oldPaid={oldPaid} setOldPaid={setOldPaid} remaining={oldRemaining} />

            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-muted-foreground">
                  {showNew ? 'كان بيعمل' : 'هيكمل على'}
                </p>
                <p className={cn('truncate font-semibold', showNew && 'text-muted-foreground line-through')}>
                  {selected.problem?.trim() || 'متابعة'}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={showNew ? 'default' : 'outline'}
                className="h-9 shrink-0 rounded-xl"
                onClick={() => toggleNew(!showNew)}
              >
                {showNew ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
                {showNew ? 'إلغاء الجديدة' : 'حاجة جديدة'}
              </Button>
            </div>

            {showNew ? (
              <ChargeFields
                form={form}
                treatmentLabel="هيعمل إيه النهاردة"
                treatmentName="reason"
                treatmentPlaceholder="اختار الخدمة"
                priceRequired={false}
              />
            ) : null}
          </div>

          <section className="col-span-full rounded-2xl border border-border/70 bg-muted/25 p-3 lg:col-span-1 lg:self-start">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">سجل المريض — آخر اللي حصل</p>
            <PatientTimeline patient={selected} limit={3} />
          </section>
        </>
      ) : null}
    </FormPage>
  )
}

function PatientSummary({ patient: p, remaining }: { patient: Patient; remaining: number }) {
  return (
    <section className="grid content-start gap-2.5 rounded-2xl border border-border/70 bg-muted/25 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarClock className="size-3.5" />
          {p.lastVisit ? `آخر زيارة: ${p.lastVisit}` : 'أول مرة يتابع'}
        </p>
        <Link
          to="/patients/$patientId"
          params={{ patientId: p.id }}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
        >
          الملف كامل
          <ExternalLink className="size-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="إجمالي حسابه" value={money(p.total)} />
        <MiniStat label="دفع" value={money(p.paid)} tone="text-success" />
        <MiniStat
          label="لسه عليه"
          value={remaining > 0 ? money(remaining) : 'خالص'}
          tone={remaining > 0 ? 'text-warning' : 'text-success'}
        />
      </div>
    </section>
  )
}

function OldBalance({
  patientId,
  remaining,
  oldPaid,
  setOldPaid,
}: {
  patientId: string
  remaining: number
  oldPaid: string
  setOldPaid: (v: string) => void
}) {
  const collect = useCreatePayment()

  const payNow = async () => {
    const amount = Number(oldPaid || 0)
    if (amount <= 0) {
      toast.error('اكتب المبلغ الأول')
      return
    }
    if (amount > remaining) {
      toast.error('المبلغ أكبر من اللي عليه')
      return
    }
    try {
      const result = await collect.mutateAsync({ patientId, amount, method: 'نقدي', note: 'من الحساب القديم' })
      toast.success(
        result.remaining > 0
          ? `تم دفع ${money(amount)} — لسه عليه ${money(result.remaining)}`
          : `تم دفع ${money(amount)} — حسابه بقى خالص ✅`,
      )
      setOldPaid('')
    } catch (err) {
      toast.error(errorText(err, 'حصل خطأ أثناء الدفع'))
    }
  }

  if (remaining <= 0) {
    return (
      <p className="inline-flex items-center gap-1.5 rounded-xl border border-success/25 bg-success/5 px-3 py-2.5 text-sm font-semibold text-success">
        <CheckCircle2 className="size-4" />
        مفيش عليه فلوس قديمة
      </p>
    )
  }

  return (
    <div className="grid gap-1.5 rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm font-semibold">
      <label htmlFor="old-paid" className="flex flex-wrap items-center justify-between gap-2">
        <span>
          دفع من الحساب القديم <span className="text-xs font-normal text-muted-foreground">(اختياري)</span>
        </span>
        <span className="text-xs text-warning">عليه {money(remaining)}</span>
      </label>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            id="old-paid"
            className={cn(inputClass, 'bg-card pl-16')}
            type="number"
            min="0"
            max={remaining}
            step="1"
            value={oldPaid}
            onChange={(e) => setOldPaid(e.target.value)}
            placeholder="0"
          />
          <button
            type="button"
            onClick={() => setOldPaid(String(remaining))}
            className="absolute left-1.5 top-1/2 h-8 -translate-y-1/2 rounded-lg bg-primary/10 px-2.5 text-xs font-semibold text-primary"
          >
            الكل
          </button>
        </div>
        <Button
          type="button"
          className="h-11 shrink-0 rounded-xl px-5 sm:h-10"
          disabled={collect.isPending || !Number(oldPaid)}
          onClick={payNow}
        >
          {collect.isPending ? 'جاري...' : 'دفع'}
        </Button>
      </div>
    </div>
  )
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/70 bg-card px-2.5 py-2 text-center">
      <p className="truncate text-[11px] font-semibold text-muted-foreground">{label}</p>
      <p className={cn('font-display truncate font-semibold', tone)}>{value}</p>
    </div>
  )
}