import type { ClinicSettings } from '@/types'

/** اسم بند الكشف ثابت عشان الخزنة تفرّق دخل الكشف عن العلاج — السعر نفسه من الإعدادات */
export const NEW_PATIENT_FEE_NAME = 'كشف'

/** لحد ما الإعدادات تتحمّل أو لو لسه ما اتعملتش */
export const DEFAULT_SETTINGS: ClinicSettings = {
  newPatientFee: 150,
  discountPresets: [0, 10, 20],
  expenseCategories: ['معمل', 'كهربا', 'إيجار', 'مرتبات', 'خامات وأدوات', 'مياه ونت', 'صيانة', 'أخرى'],
}

export function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}

export function applyDiscount(basePrice: number, discountPercent = 0) {
  const base = Math.max(0, Math.round(basePrice))
  const percent = clampPercent(discountPercent)
  const discountAmount = Math.round((base * percent) / 100)
  return { base, percent, discountAmount, final: base - discountAmount }
}
