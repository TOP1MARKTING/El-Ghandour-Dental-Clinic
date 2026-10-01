import { cn } from '@/lib/utils'

type IconProps = {
  className?: string
  strokeWidth?: number
}

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** سن — أيقونة العيادة الأساسية */
export function ToothIcon({ className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-5', className)} aria-hidden {...base} strokeWidth={strokeWidth}>
      <path
        fill="currentColor"
        fillOpacity={0.14}
        d="M12 5.3C10.6 4.1 9.2 3.5 7.7 3.5 5.2 3.5 3.8 5.6 3.8 8.2c0 2.1.8 3.7 1.5 5.4.7 1.7 1 3.6 1.4 5.6.2 1.1.9 1.8 1.8 1.8 1 0 1.5-.8 1.7-1.8l.6-2.9c.2-.8.6-1.2 1.2-1.2s1 .4 1.2 1.2l.6 2.9c.2 1 .7 1.8 1.7 1.8.9 0 1.6-.7 1.8-1.8.4-2 .7-3.9 1.4-5.6.7-1.7 1.5-3.3 1.5-5.4 0-2.6-1.4-4.7-3.9-4.7-1.5 0-2.9.6-4.3 1.8Z"
      />
      <path d="M6.9 8.4c0-1.5.9-2.5 2.2-2.6" />
      <path d="M21.2 1.3v2.6M19.9 2.6h2.6" strokeWidth={strokeWidth * 0.8} />
    </svg>
  )
}

/** مرآة أسنان */
export function DentalMirrorIcon({ className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-5', className)} aria-hidden {...base} strokeWidth={strokeWidth}>
      <circle cx="9.5" cy="8.5" r="4.2" />
      <circle cx="9.5" cy="8.5" r="2" opacity="0.45" />
      <path d="M12.8 11.8 20 21" />
    </svg>
  )
}

/** أداة حفر / هاندبيس مبسطة */
export function DentalDrillIcon({ className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-5', className)} aria-hidden {...base} strokeWidth={strokeWidth}>
      <path d="M4 14.5c2.2-1.2 4.2-1.8 6.2-1.8h3.3c1.1 0 2 .9 2 2v.2c0 1.1-.9 2-2 2H11" />
      <path d="M15.5 14.7h2.2c.9 0 1.6-.7 1.6-1.6V11c0-1.8-1.5-3.3-3.3-3.3h-1.4" />
      <path d="M4 14.5v3.2" />
      <path d="M3.2 18.8h1.6" />
    </svg>
  )
}

/** أشعة / بانوراما سن */
export function DentalScanIcon({ className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-5', className)} aria-hidden {...base} strokeWidth={strokeWidth}>
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <path d="M7.5 15.5c1-.8 2.1-1.2 3.2-1.2.9 0 1.7.3 2.4.8" />
      <path d="M13.5 15.2c.8-.5 1.7-.7 2.7-.7.9 0 1.7.2 2.5.7" />
      <path d="M8 11.2v.1M12 10.5v.1M16 11.2v.1" />
    </svg>
  )
}

/** ملف مريض بأسنان */
export function PatientFileIcon({ className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-5', className)} aria-hidden {...base} strokeWidth={strokeWidth}>
      <path d="M8 3.8h5.2L18 8.6v11.6a1.8 1.8 0 0 1-1.8 1.8H8A1.8 1.8 0 0 1 6.2 20.2V5.6A1.8 1.8 0 0 1 8 3.8Z" />
      <path d="M13.2 3.9V8h4.2" />
      <path d="M12 12.2c1.3 0 2.3.8 2.6 1.9.2.7 0 1.5-.3 2.2-.2.5-.4 1.1-.4 1.6 0 .5-.3.9-.8.9-.4 0-.6-.2-.7-.5-.1.3-.3.5-.7.5-.5 0-.8-.4-.8-.9 0-.5-.2-1.1-.4-1.6-.3-.7-.5-1.5-.3-2.2.3-1.1 1.3-1.9 2.6-1.9Z" />
    </svg>
  )
}

/** حسابات / دفعة — محفظة طبية */
export function ClinicPayIcon({ className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-5', className)} aria-hidden {...base} strokeWidth={strokeWidth}>
      <rect x="3.2" y="6.2" width="17.6" height="12.6" rx="2.2" />
      <path d="M3.2 10h17.6" />
      <circle cx="16.2" cy="14.2" r="1.2" />
      <path d="M7.2 6.2V5.4A1.6 1.6 0 0 1 8.8 3.8h3.1" />
    </svg>
  )
}

/** ماليات — أعمدة دخل */
export function FinanceIcon({ className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-5', className)} aria-hidden {...base} strokeWidth={strokeWidth}>
      <path d="M4 20h16" />
      <rect x="5.5" y="12" width="3" height="5.5" rx="1" />
      <rect x="10.5" y="8" width="3" height="9.5" rx="1" />
      <rect x="15.5" y="4.5" width="3" height="13" rx="1" />
    </svg>
  )
}

/** خدمات وأسعار — سن عليه تاج سعر */
export function ServicesIcon({ className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-5', className)} aria-hidden {...base} strokeWidth={strokeWidth}>
      <path d="M9.5 3.5c2.6 0 4.6 1.7 5.1 4.1.4 1.7.1 3.4-.4 5.1-.5 1.5-.9 3-.9 4.4 0 1.3-.9 2.3-2.1 2.3-.8 0-1.4-.5-1.7-1.2-.3.7-.8 1.2-1.7 1.2-1.2 0-2.1-1-2.1-2.3 0-1.4-.4-2.9-.9-4.4-.5-1.7-.8-3.4-.4-5.1.5-2.4 2.5-4.1 5.1-4.1Z" />
      <path d="M16.5 13.5h3.2a.8.8 0 0 1 .8.8v3.2l-3.3 3.3a.8.8 0 0 1-1.1 0l-2.2-2.2" />
      <circle cx="18.4" cy="15.6" r="0.6" />
    </svg>
  )
}

/** رئيسية / لوحة */
export function ClinicHomeIcon({ className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-5', className)} aria-hidden {...base} strokeWidth={strokeWidth}>
      <path d="M4.5 10.5 12 4.2l7.5 6.3" />
      <path d="M6.5 9.8V19a1.2 1.2 0 0 0 1.2 1.2h8.6A1.2 1.2 0 0 0 17.5 19V9.8" />
      <path d="M12 13.2c.9 0 1.6.5 1.8 1.2.1.5 0 1-.2 1.5-.1.4-.3.8-.3 1.2 0 .4-.2.7-.6.7-.3 0-.4-.2-.5-.4-.1.2-.2.4-.5.4-.4 0-.6-.3-.6-.7 0-.4-.2-.8-.3-1.2-.2-.5-.3-1-.2-1.5.2-.7.9-1.2 1.8-1.2Z" />
    </svg>
  )
}

/** إضافة مريض / حجز */
export function NewPatientIcon({ className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-5', className)} aria-hidden {...base} strokeWidth={strokeWidth}>
      <circle cx="10" cy="8" r="3.2" />
      <path d="M4.8 18.5c.6-2.8 2.6-4.3 5.2-4.3 1.2 0 2.2.3 3.1.9" />
      <path d="M17.2 13.2v6.2M14.1 16.3h6.2" />
    </svg>
  )
}

/** بحث متابعة */
export function FollowupIcon({ className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-5', className)} aria-hidden {...base} strokeWidth={strokeWidth}>
      <circle cx="10.2" cy="10.2" r="5.2" />
      <path d="m14.2 14.2 4.6 4.6" />
      <path d="M10.2 7.8v4.8M7.8 10.2h4.8" opacity="0.35" />
    </svg>
  )
}
