export const money = (value: number) => `${value.toLocaleString('en-EG')} جنيه`

const arabicLocale: Intl.LocalesArgument = 'ar-EG'
const latinDigits: Intl.DateTimeFormatOptions = {
  numberingSystem: 'latn',
}

/** الثلاثاء، 29 سبتمبر 2026 */
export function formatArabicDate(date = new Date()) {
  return date.toLocaleDateString(arabicLocale, {
    ...latinDigits,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function weekdayName(date: Date) {
  return date.toLocaleDateString(arabicLocale, { weekday: 'long' })
}

/** التواريخ القديمة متخزنة من غير اسم اليوم — بيتحسب من وقت التسجيل */
export function withWeekday(text: string, ms?: number) {
  if (!text || !ms) return text
  const day = weekdayName(new Date(ms))
  return text.includes(day) ? text : `${day}، ${text}`
}

/** الاثنين، 28 سبتمبر */
export function formatArabicWeekday(date = new Date()) {
  return date.toLocaleDateString(arabicLocale, {
    ...latinDigits,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function formatArabicDateTime(date = new Date()) {
  const dayPart = date.toLocaleDateString(arabicLocale, {
    ...latinDigits,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const timePart = date.toLocaleTimeString(arabicLocale, {
    ...latinDigits,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return `${dayPart} · ${timePart}`
}

export function formatClock(date = new Date()) {
  return date.toLocaleTimeString(arabicLocale, {
    ...latinDigits,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/** مفتاح يوم ثابت للدور اليومي: 2026-09-24 */
export function dayKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function startOfDay(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/** الأسبوع بيبدأ السبت */
export function startOfWeek(date = new Date()) {
  const d = startOfDay(date)
  const diff = (d.getDay() + 1) % 7
  d.setDate(d.getDate() - diff)
  return d
}

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}
