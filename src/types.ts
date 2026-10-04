export type Patient = {
  id: string
  name: string
  phone: string
  age: number
  address: string
  problem: string
  notes?: string
  registeredAt: string
  lastVisit: string
  total: number
  paid: number
  createdAt?: number
  by?: string
}

export type Payment = {
  id: string
  patientId: string
  patient: string
  amount: number
  date: string
  method: string
  note?: string
  /** كشف ثابت، ولا علاج، ولا دفعة من الباقي */
  kind: PaymentKind
  createdAt?: number
  /** اسم اللي سجّلها */
  by?: string
}

export type PaymentKind = 'كشف' | 'علاج' | 'دفعة'

export type AppointmentStatus = 'upcoming' | 'arrived' | 'cancelled'

export type ClinicAppointment = {
  id: string
  patientId: string
  patientName: string
  phone: string
  /** YYYY-MM-DD */
  date: string
  /** HH:mm — اختياري */
  time: string
  note: string
  status: AppointmentStatus
  createdAt: number
  /** آخر تغيير في الحالة (وصل / اتلغى) */
  updatedAt?: number
  by?: string
}

export type Visit = {
  id: string
  patientId: string
  date: string
  treatment: string
  doctor?: string
  /** السعر النهائي بعد الخصم */
  price: number
  basePrice?: number
  discountPercent?: number
  paidToday?: number
  notes: string
  createdAt?: number
  by?: string
}

export type Service = {
  id: string
  name: string
  price: number
  createdAt: number
}

/** مستند `settings/clinic` — الدكتور بيغيره من صفحة الإعدادات */
export type ClinicSettings = {
  newPatientFee: number
  discountPresets: number[]
  expenseCategories: string[]
}

export type StaffRole = 'admin' | 'helper'

export type Expense = {
  id: string
  category: string
  amount: number
  note: string
  date: string
  spentAt: number
  createdAt: number
}

export type QueueStatus = 'في الانتظار' | 'عند الدكتور' | 'بانتظار الحساب' | 'تم الكشف' | 'ملغي'

export type QueueEntry = {
  id: string
  patientId: string
  patientName: string
  phone: string
  reason: string
  kind: 'new' | 'followup'
  order: number
  arrivedAt: string
  dayKey: string
  status: QueueStatus
  createdAt: number
  /** اتحاسب عند الحجز */
  billed?: boolean
  billedTotal?: number
}
