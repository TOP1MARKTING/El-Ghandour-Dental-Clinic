/** خدمات العيادة الأساسية — السعر صفر يعني الأدمن يحدده من صفحة الأسعار */
export const DEFAULT_SERVICES = [
  { name: 'حشو عادي بلاتين', price: 600 },
  { name: 'حشو عادي ليزر تجميلي', price: 1000 },
  { name: 'حشو عادي ديجيتال', price: 1350 },
  { name: 'حشو عصب متوسط', price: 1400 },
  { name: 'حشو عصب عالي', price: 1750 },
  { name: 'حشو عصب أطفال', price: 0 },
  { name: 'حافظ مسافة', price: 0 },
  { name: 'طربوش أطفال', price: 0 },
  { name: 'خلع عادي', price: 0 },
  { name: 'خلع عقل', price: 0 },
  { name: 'خلع جراحي', price: 0 },
  { name: 'زراعة', price: 0 },
  { name: 'تنضيف جير', price: 0 },
  { name: 'تبييض ليزر', price: 0 },
  { name: 'تقويم', price: 0 },
  { name: 'تركيبات بورسلين', price: 0 },
  { name: 'تركيبات زيركون', price: 0 },
] as const

/** بتظهر لو لسه مفيش خدمات متسجلة */
export const VISIT_REASONS = [...DEFAULT_SERVICES.map((s) => s.name), 'أخرى'] as const

export type ServiceGroup<T> = { key: string; items: T[] }

/** الخدمات اللي بتبدأ بنفس الكلمة بتتجمع مع بعض: حشو، خلع، تركيبات... */
export function groupByFirstWord<T>(items: T[], nameOf: (item: T) => string): ServiceGroup<T>[] {
  const groups: ServiceGroup<T>[] = []
  for (const item of items) {
    const name = nameOf(item).trim()
    const key = name.split(/\s+/)[0] || name
    const group = groups.find((g) => g.key === key)
    if (group) group.items.push(item)
    else groups.push({ key, items: [item] })
  }
  return groups
}

/** اسم النوع من غير اسم المجموعة: "حشو عصب عالي" ← "عصب عالي" */
export function subServiceName(name: string, groupKey: string) {
  return name.trim().slice(groupKey.length).trim() || name
}
