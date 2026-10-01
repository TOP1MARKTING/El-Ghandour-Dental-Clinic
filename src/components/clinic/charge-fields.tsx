import { useEffect, useState, type ReactNode } from 'react'
import { Field } from '@/components/clinic/ui'
import { inputClass } from '@/components/clinic/form-layout'
import { ReasonSelect, splitReasons } from '@/components/clinic/reason-select'
import { useClinicSettings, useIsAdmin, useServices } from '@/lib/clinic-hooks'
import { money } from '@/lib/format'
import { applyDiscount, clampPercent } from '@/lib/pricing'
import { cn } from '@/lib/utils'

export function useChargeForm(initialTreatment = '') {
  const { data: services = [] } = useServices()
  const isAdmin = useIsAdmin()
  const [treatment, setTreatmentState] = useState(initialTreatment)
  const [price, setPrice] = useState('')
  const [discount, setDiscount] = useState(0)
  const [paid, setPaid] = useState('')

  /** مجموع أسعار الخدمات المختارة، وهل كلها ليها سعر ثابت */
  const priceOf = (value: string) => {
    const parts = splitReasons(value)
    const prices = parts.map((name) => services.find((s) => s.name === name)?.price ?? 0)
    return {
      total: prices.reduce((s, p) => s + p, 0),
      allFixed: parts.length > 0 && prices.every((p) => p > 0),
    }
  }

  useEffect(() => {
    if (price || !treatment) return
    const { total } = priceOf(treatment)
    if (total > 0) setPrice(String(total))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services])

  const setTreatment = (value: string) => {
    setTreatmentState(value)
    const { total } = priceOf(value)
    setPrice(total > 0 ? String(total) : '')
  }

  // الأسعار ثابتة من صفحة الأسعار — الاستقبال ما يكتبش سعر، الأدمن بس يقدر يعدّل
  const auto = priceOf(treatment)
  const effectivePrice = isAdmin ? price : auto.total > 0 ? String(auto.total) : ''
  const unpriced = isAdmin
    ? []
    : splitReasons(treatment).filter((name) => !(services.find((s) => s.name === name)?.price ?? 0))
  const charge = applyDiscount(Number(effectivePrice || 0), isAdmin ? discount : 0)
  const paidN = Number(paid || 0)

  return {
    isAdmin,
    treatment,
    setTreatment,
    price: effectivePrice,
    setPrice,
    priceLocked: !isAdmin,
    unpriced,
    discount: isAdmin ? discount : 0,
    setDiscount: (v: number) => setDiscount(clampPercent(v)),
    paid,
    setPaid,
    paidN,
    charge,
    remaining: Math.max(0, charge.final - paidN),
  }
}

export type ChargeForm = ReturnType<typeof useChargeForm>

export function ChargeFields({
  form,
  treatmentLabel = 'العلاج',
  treatmentName = 'treatment',
  treatmentPlaceholder = 'اختار نوع العلاج',
  autoFocusPrice = false,
  priceRequired = true,
  treatmentRequired = true,
  treatmentClassName,
  panelClassName,
}: {
  form: ChargeForm
  treatmentLabel?: string
  treatmentName?: string
  treatmentPlaceholder?: string
  autoFocusPrice?: boolean
  /** في الحجز السعر اختياري — لو فاضي بيتحاسب بعد الكشف */
  priceRequired?: boolean
  treatmentRequired?: boolean
  treatmentClassName?: string
  panelClassName?: string
}) {
  const { charge } = form
  const { settings } = useClinicSettings()
  const presets = settings.discountPresets
  const customDiscount = !presets.includes(form.discount)
  const priceHint = form.priceLocked ? 'بيتحسب من الخدمات' : !priceRequired ? 'اختياري' : undefined

  return (
    <>
      <Field
        dense
        label={treatmentLabel}
        className={cn('col-span-full', treatmentClassName)}
        {...(treatmentRequired ? {} : { hint: 'اختياري' })}
      >
        <ReasonSelect
          name={treatmentName}
          required={treatmentRequired}
          dense
          value={form.treatment}
          onValueChange={form.setTreatment}
          placeholder={treatmentPlaceholder}
        />
      </Field>

      <div className={cn('@container col-span-full rounded-2xl border border-border/70 bg-muted/25 p-3', panelClassName)}>
        <div className="grid grid-cols-2 gap-3 @xl:grid-cols-3">
          <Field dense label="إجمالي السعر" {...(priceHint ? { hint: priceHint } : {})}>
            <input
              className={cn(
                inputClass,
                'bg-card',
                form.priceLocked && 'pointer-events-none bg-muted/60 font-semibold text-foreground',
              )}
              name="price"
              type="number"
              min={priceRequired ? 1 : 0}
              step="1"
              required={priceRequired && !form.priceLocked}
              readOnly={form.priceLocked}
              tabIndex={form.priceLocked ? -1 : undefined}
              value={form.price}
              onChange={(e) => form.setPrice(e.target.value)}
              placeholder="0"
              autoFocus={autoFocusPrice && !form.priceLocked}
            />
          </Field>

          <Field dense label="دفع">
            <div className="relative">
              <input
                className={cn(inputClass, 'bg-card pl-20')}
                name="paidToday"
                type="number"
                min="0"
                step="1"
                required={priceRequired}
                value={form.paid}
                onChange={(e) => form.setPaid(e.target.value)}
                placeholder="0"
              />
              {charge.final > 0 ? (
                <button
                  type="button"
                  onClick={() => form.setPaid(String(charge.final))}
                  className="absolute left-1.5 top-1/2 h-8 -translate-y-1/2 rounded-xl bg-primary/10 px-2.5 text-xs font-semibold text-primary"
                >
                  دفع كامل
                </button>
              ) : null}
            </div>
          </Field>

          <Stat
            label="لسه عليه"
            className="col-span-2 @xl:col-span-1"
            tone={form.remaining > 0 ? 'text-warning' : 'text-success'}
          >
            {money(form.remaining)}
            {charge.discountAmount > 0 ? (
              <span className="text-xs font-normal text-muted-foreground">(بعد الخصم {money(charge.final)})</span>
            ) : null}
          </Stat>

          {form.unpriced.length > 0 ? (
            <p className="col-span-full rounded-xl bg-warning/10 px-3 py-2 text-xs font-semibold text-warning">
              {form.unpriced.join('، ')} — مالهاش سعر متحدد. الدكتور يحدد سعرها من صفحة الأسعار.
            </p>
          ) : null}

          {form.isAdmin ? (
            <Field dense label="خصم" hint="للأدمن بس" className="col-span-full">
              <div className="flex flex-wrap items-center gap-1.5">
                {presets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => form.setDiscount(p)}
                    className={cn(
                      'min-h-10 rounded-xl border px-3.5 text-sm font-semibold transition',
                      form.discount === p
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border/80 bg-card hover:border-primary/35',
                    )}
                  >
                    {p === 0 ? 'بدون' : `${p}%`}
                  </button>
                ))}
                <div className="relative w-28">
                  <input
                    className={cn(
                      inputClass,
                      'h-10 bg-card pl-8',
                      customDiscount && form.discount > 0 && 'border-primary',
                    )}
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    placeholder="نسبة"
                    value={customDiscount && form.discount > 0 ? form.discount : ''}
                    onChange={(e) => form.setDiscount(Number(e.target.value || 0))}
                    aria-label="نسبة خصم مخصوصة"
                  />
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    %
                  </span>
                </div>
              </div>
            </Field>
          ) : null}
        </div>
      </div>
    </>
  )
}

function Stat({
  label,
  tone,
  className,
  children,
}: {
  label: string
  tone?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('grid min-w-0 gap-1 text-sm font-semibold', className)}>
      <span className="truncate text-muted-foreground">{label}</span>
      <div
        className={cn(
          'font-display flex h-11 items-center justify-center gap-1.5 truncate rounded-xl border border-border/70 bg-card px-2 sm:h-10',
          tone,
        )}
      >
        {children}
      </div>
    </div>
  )
}
