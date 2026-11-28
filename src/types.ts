import type { DoctorId } from '@/lib/doctors'

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
  /** الدكتور المتابع — الدكتورين يقدروا يشوفوا كل المرضى */
  doctor: DoctorId
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
  /** الدكتور اللي الفلوس دي ليه — الدفعات القديمة من غيره وبتتحسب على دكتور المريض */
  doctor?: DoctorId
  /** اتلغت من غير مسح — مش بتتحسب في الدخل */
  cancelled?: boolean
  cancelledAt?: number
  cancelledBy?: string
  visitId?: string
}

export type PaymentKind = 'كشف' | 'علاج' | 'دفعة'

export type AppointmentStatus = 'upcoming' | 'arrived' | 'cancelled'

/** من العيادة أو عن طريق التليفون — الحجوزات القديمة = من العيادة */
export type BookingSource = 'clinic' | 'phone'

/** دفع كشف / بدون دفع كشف — الحجوزات القديمة = دفع كشف */
export type CheckupFeeStatus = 'paid' | 'unpaid'

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
  doctor: DoctorId
  bookingSource: BookingSource
  checkupFeeStatus: CheckupFeeStatus
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
  /** حساب من قبل السيستم — اتكتب بإيده مش علاج اتعمل هنا */
  oldBalance?: boolean
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
  /** أسماء الممرضات — الدكتور بيضيفها، والاستقبال بيختار منها عند كل تسجيل */
  nurses: string[]
}

export type StaffRole = 'admin' | 'helper'

/** سجل كل مرة الدكتور نزّل فيها نسخة احتياطية (dayKey هنا = YYYY-MM للشهر) */
export type BackupLog = {
  id: string
  dayKey: string
  fileName: string
  downloadedAt: number
  byEmail: string
  byName: string
  patientsCount: number
  visitsCount: number
  paymentsCount: number
  expensesCount: number
}

export type Expense = {
  id: string
  category: string
  amount: number
  note: string
  date: string
  spentAt: number
  createdAt: number
}

/** سجل المعمل — حالات متبعتة للمعمل */
export type LabEntry = {
  id: string
  /** YYYY-MM-DD */
  dayKey: string
  caseName: string
  amount: number
  note: string
  date: string
  spentAt: number
  createdAt: number
  by?: string
}

/** فاتورة خامات من مورد */
export type MaterialInvoice = {
  id: string
  dayKey: string
  name: string
  total: number
  date: string
  createdAt: number
  by?: string
}

/** حركة سداد/خصم على فاتورة خامات */
export type MaterialMovement = {
  id: string
  invoiceId: string
  dayKey: string
  date: string
  paid: number
  discount: number
  remainingAfter: number
  note: string
  createdAt: number
  by?: string
}

export type QueueStatus = 'في الانتظار' | 'عند الدكتور' | 'بانتظار الحساب' | 'تم الكشف' | 'ملغي'

export type QueueEntry = {
  id: string
  patientId: string
  patientName: string
  phone: string
  reason: string
  kind: 'new' | 'followup'
  doctor: DoctorId
  order: number
  arrivedAt: string
  dayKey: string
  status: QueueStatus
  createdAt: number
  /** اتحاسب عند الحجز */
  billed?: boolean
  billedTotal?: number
  bookingSource?: BookingSource
  /** كشف من غير ما يتدفع */
  checkupUnpaid?: boolean
}
