export type DoctorId = 'ashraf' | 'heba'

export type Doctor = { id: DoctorId; name: string; short: string; email: string }

/** دكاترة العيادة — نفس الإيميلات لازم تكون في isAdmin في firestore.rules */
export const DOCTORS: readonly Doctor[] = [
  { id: 'ashraf', name: 'د. أشرف الغندور', short: 'د. أشرف', email: 'ashraf@elghandour.com' },
  { id: 'heba', name: 'د. هبة', short: 'د. هبة', email: 'heba@elghandour.com' },
]

/** المرضى القدام اللي اتسجلوا قبل تقسيم المرضى بيتحسبوا على د. أشرف */
export const DEFAULT_DOCTOR: DoctorId = 'ashraf'

export function toDoctorId(value: unknown): DoctorId {
  return DOCTORS.some((d) => d.id === value) ? (value as DoctorId) : DEFAULT_DOCTOR
}

export function doctorById(id: DoctorId) {
  return DOCTORS.find((d) => d.id === id) ?? DOCTORS[0]!
}

export function doctorByEmail(email: string) {
  const e = email.trim().toLowerCase()
  return DOCTORS.find((d) => d.email === e)
}

/** مرضى الدكتور الحالي الأول — والترتيب جوه كل مجموعة زي ما هو */
export function mineFirst<T>(items: readonly T[], doctorOf: (item: T) => DoctorId, mine: DoctorId | undefined) {
  if (!mine) return [...items]
  return [...items.filter((x) => doctorOf(x) === mine), ...items.filter((x) => doctorOf(x) !== mine)]
}
