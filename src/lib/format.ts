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

const weekdayFormat = new Intl.DateTimeFormat(arabicLocale, {
  ...latinDigits,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})
const time12Format = new Intl.DateTimeFormat(arabicLocale, {
  ...latinDigits,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

/** الاثنين، 28 سبتمبر */
export function formatArabicWeekday(date = new Date()) {
  return weekdayFormat.format(date)
}

/** 5:31 م */
export function timeLabel(ms: number) {
  return time12Format.format(ms)
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

/** عكس dayKey — بيرجع نص الليل بالتوقيت المحلي */
export function parseDayKey(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

export function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function startOfDay(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/** النهاردة / امبارح / الاثنين، 28 سبتمبر */
export function relativeDayLabel(ms: number, now = new Date()) {
  const key = dayKey(new Date(ms))
  if (key === dayKey(now)) return 'النهاردة'
  if (key === dayKey(addDays(now, -1))) return 'امبارح'
  return formatArabicWeekday(new Date(ms))
}

/** يجمع العناصر المرتبة حسب اليوم من غير ما يغير ترتيبها */
export function groupByDay<T>(items: T[], at: (item: T) => number, fallbackKey?: (item: T) => string) {
  const groups = new Map<string, { key: string; label: string; items: T[] }>()
  const now = new Date()
  for (const item of items) {
    const ms = at(item)
    const key = ms ? dayKey(new Date(ms)) : fallbackKey?.(item) || '—'
    let group = groups.get(key)
    if (!group) {
      group = { key, label: ms ? relativeDayLabel(ms, now) : key === '—' ? 'من غير تاريخ' : key, items: [] }
      groups.set(key, group)
    }
    group.items.push(item)
  }
  return [...groups.values()]
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
