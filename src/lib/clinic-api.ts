import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getAggregateFromServer,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  sum,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type Firestore,
} from 'firebase/firestore'
import { getAuthClient, getDb } from '@/lib/backend'
import { addDays, dayKey, formatArabicDate, formatArabicDateTime, formatClock, monthKey, relativeDayLabel } from '@/lib/format'
import {
  applyDiscount,
  clampPercent,
  DEFAULT_SETTINGS,
  FIXED_EXPENSE_CATEGORIES,
  NEW_PATIENT_FEE_NAME,
} from '@/lib/pricing'
import { toDoctorId, type DoctorId } from '@/lib/doctors'
import type {
  AppointmentStatus,
  BackupLog,
  BookingSource,
  CheckupFeeStatus,
  ClinicAppointment,
  ClinicSettings,
  Expense,
  LabEntry,
  MaterialInvoice,
  MaterialMovement,
  Patient,
  Payment,
  PaymentKind,
  QueueEntry,
  QueueStatus,
  Service,
  Visit,
} from '@/types'
import { getActorName } from '@/lib/clinic-actor'

function actor() {
  const email = getAuthClient().currentUser?.email ?? ''
  return { email, name: getActorName() || email }
}

function stamp(byName?: string) {
  const a = actor()
  return { createdBy: a.email, createdByName: byName?.trim() || a.name }
}

function requireByName(byName?: string) {
  const name = byName?.trim() ?? ''
  if (!name) throw new Error('اختار اسم الممرضة اللي بتسجّل')
  return name
}

function touch() {
  const a = actor()
  return { updatedBy: a.email, updatedByName: a.name, updatedAtMs: Date.now() }
}

/** المرضى القدام متخزن عندهم «اليوم» كنص — أقرب تاريخ ليه هو آخر تعديل على الملف */
function lastVisitLabel(data: DocumentData) {
  const text = String(data['lastVisit'] ?? '')
  const ms = Number(data['lastVisitMs'] ?? 0) || (text === 'اليوم' ? Number(data['updatedAtMs'] ?? 0) : 0)
  if (ms) return relativeDayLabel(ms)
  return text && text !== '—' && text !== 'اليوم' ? text : ''
}

function visitedNow(now = Date.now()) {
  return { lastVisit: formatArabicDate(new Date(now)), lastVisitMs: now }
}

function mapPatient(id: string, data: DocumentData): Patient {
  return {
    id,
    name: String(data['name'] ?? ''),
    phone: String(data['phone'] ?? ''),
    age: Number(data['age'] ?? 0),
    address: String(data['address'] ?? ''),
    problem: String(data['problem'] ?? ''),
    notes: String(data['notes'] ?? ''),
    registeredAt: String(data['registeredAt'] ?? ''),
    lastVisit: lastVisitLabel(data),
    total: Number(data['total'] ?? 0),
    paid: Number(data['paid'] ?? 0),
    createdAt: Number(data['createdAtMs'] ?? 0),
    by: String(data['createdByName'] ?? ''),
    doctor: toDoctorId(data['doctor']),
  }
}

function mapVisit(id: string, data: DocumentData): Visit {
  return {
    id,
    patientId: String(data['patientId'] ?? ''),
    date: String(data['date'] ?? ''),
    treatment: String(data['treatment'] ?? ''),
    doctor: String(data['doctor'] ?? ''),
    price: Number(data['price'] ?? 0),
    basePrice: Number(data['basePrice'] ?? data['price'] ?? 0),
    discountPercent: Number(data['discountPercent'] ?? 0),
    paidToday: Number(data['paidToday'] ?? 0),
    notes: String(data['notes'] ?? ''),
    createdAt: Number(data['createdAtMs'] ?? 0),
    by: String(data['createdByName'] ?? ''),
    oldBalance: Boolean(data['oldBalance']),
  }
}

function mapService(id: string, data: DocumentData): Service {
  return {
    id,
    name: String(data['name'] ?? ''),
    price: Number(data['price'] ?? 0),
    createdAt: Number(data['createdAtMs'] ?? 0),
  }
}

function mapExpense(id: string, data: DocumentData): Expense {
  return {
    id,
    category: String(data['category'] ?? 'أخرى'),
    amount: Number(data['amount'] ?? 0),
    note: String(data['note'] ?? ''),
    date: String(data['date'] ?? ''),
    spentAt: Number(data['spentAtMs'] ?? data['createdAtMs'] ?? 0),
    createdAt: Number(data['createdAtMs'] ?? 0),
  }
}

function paymentKindOf(value: unknown): PaymentKind {
  return value === 'كشف' || value === 'علاج' ? value : 'دفعة'
}

function mapPayment(id: string, data: DocumentData): Payment {
  const cancelledAt = Number(data['cancelledAtMs'] ?? 0)
  const cancelledBy = String(data['cancelledByName'] ?? '').trim()
  return {
    id,
    patientId: String(data['patientId'] ?? ''),
    patient: String(data['patient'] ?? ''),
    amount: Number(data['amount'] ?? 0),
    date: String(data['date'] ?? ''),
    method: data['method'] && data['method'] !== 'كاش' ? String(data['method']) : 'نقدي',
    note: String(data['note'] ?? ''),
    kind: paymentKindOf(data['kind']),
    createdAt: Number(data['createdAtMs'] ?? 0),
    by: String(data['createdByName'] ?? ''),
    cancelled: Boolean(data['cancelled']),
    ...(cancelledAt ? { cancelledAt } : {}),
    ...(cancelledBy ? { cancelledBy } : {}),
    ...(data['visitId'] ? { visitId: String(data['visitId']) } : {}),
    ...(data['doctor'] ? { doctor: toDoctorId(data['doctor']) } : {}),
  }
}

/** الدفعات النشطة اللي بتدخل في الدخل والتقارير */
export function isActivePayment(p: Pick<Payment, 'cancelled'>) {
  return !p.cancelled
}

function normalizeQueueStatus(raw: string): QueueStatus {
  if (raw === 'عند الدكتور') return 'بانتظار الحساب'
  return raw as QueueStatus
}

function isActiveQueueStatus(status: string) {
  const s = normalizeQueueStatus(status)
  return s === 'في الانتظار' || s === 'بانتظار الحساب'
}

function mapQueue(id: string, data: DocumentData): QueueEntry {
  return {
    id,
    patientId: String(data['patientId'] ?? ''),
    patientName: String(data['patientName'] ?? ''),
    phone: String(data['phone'] ?? ''),
    reason: String(data['reason'] ?? ''),
    kind: data['kind'] === 'followup' ? 'followup' : 'new',
    doctor: toDoctorId(data['doctor']),
    order: Number(data['order'] ?? 0),
    arrivedAt: String(data['arrivedAt'] ?? ''),
    dayKey: String(data['dayKey'] ?? ''),
    status: normalizeQueueStatus(String(data['status'] ?? 'في الانتظار')),
    createdAt: Number(data['createdAtMs'] ?? 0),
    billed: Boolean(data['billed']),
    billedTotal: Number(data['billedTotal'] ?? 0),
  }
}

export async function listPatients() {
  const snap = await getDocs(collection(getDb(), 'patients'))
  return snap.docs
    .map((d) => mapPatient(d.id, d.data()))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
}

export async function getPatient(id: string) {
  const ref = await getDoc(doc(getDb(), 'patients', id))
  if (!ref.exists()) return null
  return mapPatient(ref.id, ref.data())
}

export async function createPatient(input: {
  name: string
  phone: string
  age?: number
  address?: string
  problem?: string
  notes?: string
  doctor: DoctorId
  oldBalance?: OldBalanceInput
}) {
  const db = getDb()
  const now = Date.now()
  const name = input.name.trim()
  const ref = doc(collection(db, 'patients'))
  const old = input.oldBalance ? checkOldBalance(input.oldBalance) : null
  const batch = writeBatch(db)
  batch.set(ref, {
    name,
    phone: input.phone.trim(),
    doctor: toDoctorId(input.doctor),
    age: input.age ?? 0,
    address: input.address?.trim() ?? '',
    problem: input.problem?.trim() ?? '',
    notes: input.notes?.trim() ?? '',
    registeredAt: formatArabicDate(),
    lastVisit: '',
    total: old?.total ?? 0,
    paid: old?.paid ?? 0,
    createdAtMs: now,
    createdAt: serverTimestamp(),
    ...stamp(),
  })
  if (old) batch.set(doc(collection(db, 'visits')), oldBalanceVisit({ ...old, patientId: ref.id, patientName: name, now: now + 1 }))
  await batch.commit()
  return ref.id
}

type OldBalanceInput = { label?: string; total: number; paid: number }

function checkOldBalance(input: OldBalanceInput) {
  const total = Math.round(input.total)
  const paid = Math.round(input.paid || 0)
  if (!Number.isFinite(total) || total <= 0) throw new Error('اكتب إجمالي الحساب القديم')
  if (!Number.isFinite(paid) || paid < 0) throw new Error('المدفوع غير صحيح')
  if (paid > total) throw new Error('المدفوع أكبر من الإجمالي')
  return { label: input.label?.trim() ?? '', total, paid }
}

/** حساب من قبل السيستم — من غير مستند دفعة عشان ما يتحسبش دخل النهاردة */
function oldBalanceVisit(input: {
  patientId: string
  patientName: string
  label: string
  total: number
  paid: number
  now: number
  byName?: string
}) {
  return {
    patientId: input.patientId,
    patientName: input.patientName,
    treatment: input.label,
    oldBalance: true,
    doctor: '',
    price: input.total,
    basePrice: input.total,
    discountPercent: 0,
    discountAmount: 0,
    paidToday: input.paid,
    notes: '',
    date: formatArabicDate(new Date(input.now)),
    createdAtMs: input.now,
    createdAt: serverTimestamp(),
    ...stamp(input.byName),
  }
}

export async function addOldBalance(input: OldBalanceInput & { patientId: string; patientName: string; byName: string }) {
  const byName = requireByName(input.byName)
  const db = getDb()
  const old = checkOldBalance(input)
  const batch = writeBatch(db)
  batch.set(
    doc(collection(db, 'visits')),
    oldBalanceVisit({ ...old, patientId: input.patientId, patientName: input.patientName, now: Date.now(), byName }),
  )
  batch.update(doc(db, 'patients', input.patientId), {
    ...touch(),
    total: increment(old.total),
    ...(old.paid > 0 ? { paid: increment(old.paid) } : {}),
  })
  await batch.commit()
}

/** نقل المريض لدكتور تاني — المواعيد الجاية بتتنقل معاه */
export async function setPatientDoctor(input: { patientId: string; doctor: DoctorId }) {
  const db = getDb()
  const doctor = toDoctorId(input.doctor)
  const appointments = await getDocs(query(collection(db, 'appointments'), where('patientId', '==', input.patientId)))
  const batch = writeBatch(db)
  batch.update(doc(db, 'patients', input.patientId), { doctor, ...touch() })
  const today = dayKey()
  for (const d of appointments.docs) {
    const a = mapAppointment(d.id, d.data())
    if (a.status === 'upcoming' && a.date >= today && a.doctor !== doctor) batch.update(d.ref, { doctor, ...touch() })
  }
  await batch.commit()
}

/** Firestore بيقبل 500 عملية بالكتير في الـ batch الواحد */
const BATCH_LIMIT = 450

export async function deletePatient(id: string) {
  const db = getDb()
  const snaps = await Promise.all(
    ['visits', 'payments', 'queue', 'appointments'].map((name) =>
      getDocs(query(collection(db, name), where('patientId', '==', id))),
    ),
  )
  const refs = [...snaps.flatMap((s) => s.docs.map((d) => d.ref)), doc(db, 'patients', id)]
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (const ref of refs.slice(i, i + BATCH_LIMIT)) batch.delete(ref)
    await batch.commit()
  }
}

export async function listVisitsForPatient(patientId: string) {
  const snap = await getDocs(query(collection(getDb(), 'visits'), where('patientId', '==', patientId)))
  return snap.docs
    .map((d) => mapVisit(d.id, d.data()))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
}

export async function createVisit(input: {
  patientId: string
  treatment: string
  doctor?: string
  basePrice: number
  discountPercent?: number
  paidToday: number
  notes?: string
  /** ما يغيرش العلاج الحالي للمريض (زي رسوم الكشف) */
  keepProblem?: boolean
  byName: string
}) {
  if (input.basePrice < 0) throw new Error('السعر غير صحيح')
  const byName = requireByName(input.byName)
  const db = getDb()

  await runTransaction(db, async (tx) => {
    const patientRef = doc(db, 'patients', input.patientId)
    const patientSnap = await tx.get(patientRef)
    if (!patientSnap.exists()) throw new Error('المريض غير موجود')
    const patient = mapPatient(patientSnap.id, patientSnap.data())

    const visit = visitWrites(db, {
      ...input,
      patientName: patient.name,
      doctorId: patient.doctor,
      now: Date.now(),
      byName,
    })
    for (const [ref, data] of visit.writes) tx.set(ref, data)

    tx.update(patientRef, {
      ...touch(),
      total: patient.total + visit.final,
      paid: patient.paid + visit.paid,
      ...visitedNow(),
      ...(input.keepProblem ? {} : { problem: input.treatment.trim() }),
    })
  })
}

/** مستندات الزيارة ودفعتها — بتتكتب مع تحديث حساب المريض في نفس الحفظة */
function visitWrites(
  db: Firestore,
  input: {
    patientId: string
    patientName: string
    treatment: string
    doctor?: string
    /** الدكتور اللي الدفعة بتتحسب له */
    doctorId: DoctorId
    basePrice: number
    discountPercent?: number
    paidToday: number
    notes?: string
    now: number
    byName: string
  },
) {
  const charge = applyDiscount(input.basePrice, input.discountPercent)
  const paid = Math.max(0, Math.min(Math.round(input.paidToday || 0), charge.final))
  const treatment = input.treatment.trim()
  const visitRef = doc(collection(db, 'visits'))
  const writes: Array<[DocumentReference, DocumentData]> = [
    [
      visitRef,
      {
        patientId: input.patientId,
        patientName: input.patientName,
        treatment,
        doctor: input.doctor?.trim() ?? '',
        price: charge.final,
        basePrice: charge.base,
        discountPercent: charge.percent,
        discountAmount: charge.discountAmount,
        paidToday: paid,
        notes: input.notes?.trim() ?? '',
        date: formatArabicDate(),
        createdAtMs: input.now,
        createdAt: serverTimestamp(),
        ...stamp(input.byName),
      },
    ],
  ]
  if (paid > 0) {
    writes.push([
      doc(collection(db, 'payments')),
      paymentDoc({
        patientId: input.patientId,
        patientName: input.patientName,
        amount: paid,
        kind: treatment === NEW_PATIENT_FEE_NAME ? 'كشف' : 'علاج',
        doctor: input.doctorId,
        now: input.now,
        visitId: visitRef.id,
        byName: input.byName,
      }),
    ])
  }
  return { writes, final: charge.final, paid }
}

function paymentDoc(input: {
  patientId: string
  patientName: string
  amount: number
  kind: PaymentKind
  now: number
  doctor: DoctorId
  method?: string
  note?: string
  /** الزيارة اللي الدفعة اتدفعت معاها — عشان لو العلاج اتمسح تتمسح معاه */
  visitId?: string
  byName: string
}) {
  return {
    patientId: input.patientId,
    patient: input.patientName,
    doctor: input.doctor,
    ...(input.visitId ? { visitId: input.visitId } : {}),
    amount: input.amount,
    date: formatArabicDateTime(new Date(input.now)),
    method: input.method ?? 'نقدي',
    note: input.note?.trim() ?? '',
    kind: input.kind,
    createdAtMs: input.now,
    createdAt: serverTimestamp(),
    ...stamp(input.byName),
  }
}

export async function listPayments(sinceMs?: number) {
  const ref = collection(getDb(), 'payments')
  const snap = await getDocs(sinceMs === undefined ? ref : query(ref, where('createdAtMs', '>=', sinceMs)))
  return snap.docs
    .map((d) => mapPayment(d.id, d.data()))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
}

export async function createPayment(input: {
  patientId: string
  amount: number
  method?: string
  note?: string
  byName: string
  /** وقت الدفع الفعلي للدخل — افتراضي دلوقتي */
  paidAtMs?: number
}) {
  const byName = requireByName(input.byName)
  const db = getDb()
  let remaining = 0
  let paidAmount = 0
  const paidAt = Number.isFinite(input.paidAtMs) ? Math.round(input.paidAtMs as number) : Date.now()

  await runTransaction(db, async (tx) => {
    const patientRef = doc(db, 'patients', input.patientId)
    const patientSnap = await tx.get(patientRef)
    if (!patientSnap.exists()) throw new Error('المريض غير موجود')
    const patient = mapPatient(patientSnap.id, patientSnap.data())

    const due = Math.max(0, patient.total - patient.paid)
    if (due <= 0) throw new Error('مفيش باقي على المريض')

    const amount = Math.round(input.amount)
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('أدخل مبلغ صحيح')
    if (amount > due) throw new Error(`المبلغ أكبر من الباقي على المريض (${due.toLocaleString('en-EG')} جنيه)`)

    tx.set(
      doc(collection(db, 'payments')),
      paymentDoc({
        patientId: input.patientId,
        patientName: patient.name,
        amount,
        kind: 'دفعة',
        doctor: patient.doctor,
        now: paidAt,
        byName,
        ...(input.method ? { method: input.method } : {}),
        ...(input.note ? { note: input.note } : {}),
      }),
    )

    tx.update(patientRef, {
      ...touch(),
      paid: patient.paid + amount,
    })

    remaining = Math.max(0, due - amount)
    paidAmount = amount
  })

  return { remaining, amount: paidAmount }
}

/** تصحيح غلطة: بيمسح العلاج والدفعة اللي اتدفعت معاه وبينقّص حساب المريض */
export async function deleteVisit(visitId: string) {
  const db = getDb()
  const visitRef = doc(db, 'visits', visitId)
  const first = await getDoc(visitRef)
  if (!first.exists()) throw new Error('العلاج ده اتمسح قبل كده')
  const patientId = String(first.data()['patientId'] ?? '')
  const payments = await getDocs(query(collection(db, 'payments'), where('patientId', '==', patientId)))

  await runTransaction(db, async (tx) => {
    const visitSnap = await tx.get(visitRef)
    if (!visitSnap.exists()) throw new Error('العلاج ده اتمسح قبل كده')
    const patientRef = doc(db, 'patients', patientId)
    const patientSnap = await tx.get(patientRef)
    const v = visitSnap.data()
    const price = Number(v['price'] ?? 0)
    const paid = Number(v['paidToday'] ?? 0)
    const at = Number(v['createdAtMs'] ?? 0)
    const linked = payments.docs.find((d) => {
      const x = d.data()
      if (x['visitId']) return x['visitId'] === visitId
      return x['kind'] !== 'دفعة' && Number(x['createdAtMs'] ?? 0) === at && Number(x['amount'] ?? 0) === paid
    })

    tx.delete(visitRef)
    if (linked) tx.delete(linked.ref)
    if (patientSnap.exists()) {
      const patient = mapPatient(patientSnap.id, patientSnap.data())
      tx.update(patientRef, {
        ...touch(),
        total: Math.max(0, patient.total - price),
        paid: Math.max(0, patient.paid - paid),
      })
    }
  })
  return { patientId }
}

/** إلغاء دفعة: متتمسحش — بتتعلم ملغاة وتتشال من الدخل والإجمالي */
export async function cancelPayment(paymentId: string) {
  const db = getDb()
  let patientId = ''
  await runTransaction(db, async (tx) => {
    const paymentRef = doc(db, 'payments', paymentId)
    const paymentSnap = await tx.get(paymentRef)
    if (!paymentSnap.exists()) throw new Error('الدفعة مش موجودة')
    const x = paymentSnap.data()
    if (Boolean(x['cancelled'])) throw new Error('الدفعة دي ملغاة قبل كده')
    patientId = String(x['patientId'] ?? '')
    const amount = Number(x['amount'] ?? 0)
    const visitId = String(x['visitId'] ?? '')
    const a = actor()
    const now = Date.now()

    tx.update(paymentRef, {
      cancelled: true,
      cancelledAtMs: now,
      cancelledBy: a.email,
      cancelledByName: a.name,
      ...touch(),
    })

    if (patientId) {
      const patientRef = doc(db, 'patients', patientId)
      const patientSnap = await tx.get(patientRef)
      if (patientSnap.exists()) {
        const patient = mapPatient(patientSnap.id, patientSnap.data())
        tx.update(patientRef, { ...touch(), paid: Math.max(0, patient.paid - amount) })
      }
    }

    if (visitId) {
      const visitRef = doc(db, 'visits', visitId)
      const visitSnap = await tx.get(visitRef)
      if (visitSnap.exists()) {
        const paidToday = Math.max(0, Number(visitSnap.data()['paidToday'] ?? 0) - amount)
        tx.update(visitRef, { paidToday, ...touch() })
      }
    }
  })
  return { patientId }
}

/** @deprecated استخدم cancelPayment — موجود للتوافق */
export async function deletePayment(paymentId: string) {
  return cancelPayment(paymentId)
}

export async function updatePatient(input: {
  id: string
  name: string
  phone: string
  age?: number
  address?: string
  notes?: string
}) {
  const name = input.name.trim()
  const phone = input.phone.trim()
  if (!name) throw new Error('اكتب اسم المريض')
  if (!phone) throw new Error('اكتب رقم الموبايل')
  const db = getDb()
  const patientRef = doc(db, 'patients', input.id)
  const [queue, appointments, payments] = await Promise.all(
    ['queue', 'appointments', 'payments'].map((col) =>
      getDocs(query(collection(db, col), where('patientId', '==', input.id))),
    ),
  )
  const batch = writeBatch(db)
  batch.update(patientRef, {
    ...touch(),
    name,
    phone,
    age: input.age ?? 0,
    address: input.address?.trim() ?? '',
    notes: input.notes?.trim() ?? '',
  })
  for (const d of queue!.docs) batch.update(d.ref, { patientName: name, phone })
  for (const d of appointments!.docs) batch.update(d.ref, { patientName: name, phone })
  for (const d of payments!.docs) batch.update(d.ref, { patient: name })
  await batch.commit()
}

/** الباقي عند المرضى كلهم — مجموع من السيرفر من غير ما نقرا كل المرضى */
export async function getOutstandingTotal() {
  // كل مجموع في طلب لوحده — مجموعين في نفس الطلب محتاجين index مركّب على السيرفر
  const patients = collection(getDb(), 'patients')
  const [totalSnap, paidSnap] = await Promise.all([
    getAggregateFromServer(patients, { value: sum('total') }),
    getAggregateFromServer(patients, { value: sum('paid') }),
  ])
  return Math.max(0, (totalSnap.data().value ?? 0) - (paidSnap.data().value ?? 0))
}

export async function getPaymentsTotal() {
  const snap = await getAggregateFromServer(collection(getDb(), 'payments'), { amount: sum('amount') })
  return snap.data().amount ?? 0
}

const dayQueueQuery = (key: string) => query(collection(getDb(), 'queue'), where('dayKey', '==', key))

const sortQueue = (docs: Array<{ id: string; data: () => DocumentData }>) =>
  docs.map((d) => mapQueue(d.id, d.data())).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)

export async function listTodayQueue(key = dayKey()) {
  return sortQueue((await getDocs(dayQueueQuery(key))).docs)
}

export function subscribeTodayQueue(
  key: string,
  onData: (queue: QueueEntry[]) => void,
  onError: (err: Error) => void,
) {
  return onSnapshot(dayQueueQuery(key), (snap) => onData(sortQueue(snap.docs)), onError)
}

/** قراءة واحدة لزيارات النهاردة: رقم الترتيب الجاي، وهل المريض متسجل بالفعل */
async function todayQueueState(patientId?: string) {
  const key = dayKey()
  const snap = await getDocs(dayQueueQuery(key))
  let max = 0
  let alreadyHere = false
  for (const d of snap.docs) {
    const data = d.data()
    const n = Number(data['order'] ?? 0)
    if (n > max) max = n
    if (patientId && String(data['patientId'] ?? '') === patientId && isActiveQueueStatus(String(data['status'] ?? ''))) {
      alreadyHere = true
    }
  }
  return { key, order: max + 1, alreadyHere }
}

function queueDoc(input: {
  patientId: string
  patientName: string
  phone: string
  reason: string
  kind: 'new' | 'followup'
  doctor: DoctorId
  order: number
  key: string
  now: number
  billedTotal?: number
  byName: string
}) {
  return {
    patientId: input.patientId,
    patientName: input.patientName.trim(),
    phone: input.phone.trim(),
    reason: input.reason.trim() || (input.kind === 'new' ? 'كشف جديد' : 'متابعة'),
    kind: input.kind,
    doctor: input.doctor,
    order: input.order,
    arrivedAt: formatClock(),
    dayKey: input.key,
    status: 'في الانتظار',
    createdAtMs: input.now,
    createdAt: serverTimestamp(),
    ...stamp(input.byName),
    ...(input.billedTotal !== undefined ? { billed: true, billedTotal: input.billedTotal } : {}),
  }
}

type ChargeInput = { basePrice: number; discountPercent?: number; paidToday: number }

export const ALREADY_HERE_ERROR = 'المريض ده متسجل إنه جه النهاردة بالفعل'

export async function checkInNewPatient(input: {
  name: string
  phone: string
  age?: number
  address?: string
  reason?: string
  /** سعر الكشف من إعدادات العيادة — صفر = بدون كشف */
  feePrice: number
  /** دفع الكشف ولا اتسجل عليه */
  feePaid?: boolean
  /** لو اتحدد سعر عند الحجز بيتسجل العلاج والدفعة على طول */
  charge?: ChargeInput
  doctor: DoctorId
  byName: string
}) {
  const byName = requireByName(input.byName)
  const db = getDb()
  const name = input.name.trim()
  const phone = input.phone.trim()
  const reason = input.reason?.trim() || (input.feePrice > 0 ? 'كشف جديد' : 'متابعة')
  const doctor = toDoctorId(input.doctor)
  const now = Date.now()
  const { key, order } = await todayQueueState()

  const patientRef = doc(collection(db, 'patients'))
  const queueRef = doc(collection(db, 'queue'))
  const fee =
    input.feePrice > 0
      ? visitWrites(db, {
          patientId: patientRef.id,
          patientName: name,
          treatment: NEW_PATIENT_FEE_NAME,
          doctorId: doctor,
          basePrice: input.feePrice,
          paidToday: input.feePaid === false ? 0 : input.feePrice,
          now,
          byName,
        })
      : { writes: [], final: 0, paid: 0 }
  const charge =
    input.charge && input.charge.basePrice > 0
      ? visitWrites(db, {
          patientId: patientRef.id,
          patientName: name,
          treatment: reason,
          doctorId: doctor,
          basePrice: input.charge.basePrice,
          ...(input.charge.discountPercent ? { discountPercent: input.charge.discountPercent } : {}),
          paidToday: input.charge.paidToday,
          now: now + 1,
          byName,
        })
      : null

  const batch = writeBatch(db)
  batch.set(patientRef, {
    name,
    phone,
    doctor,
    age: input.age ?? 0,
    address: input.address?.trim() ?? '',
    problem: reason,
    notes: '',
    registeredAt: formatArabicDate(),
    ...visitedNow(),
    total: fee.final + (charge?.final ?? 0),
    paid: fee.paid + (charge?.paid ?? 0),
    createdAtMs: now,
    createdAt: serverTimestamp(),
    ...stamp(byName),
  })
  batch.set(
    queueRef,
    queueDoc({
      patientId: patientRef.id,
      patientName: name,
      phone,
      reason,
      kind: 'new',
      doctor,
      order,
      key,
      now,
      byName,
      ...(charge ? { billedTotal: charge.final } : {}),
    }),
  )
  for (const [ref, data] of [...fee.writes, ...(charge?.writes ?? [])]) batch.set(ref, data)
  await batch.commit()

  return { patientId: patientRef.id, id: queueRef.id, order }
}

export async function checkInFollowupPatient(input: {
  patientId: string
  reason?: string
  isNewTreatment?: boolean
  charge?: ChargeInput
  /** دفعة من الحساب القديم — بتتسجل مع الحضور في نفس الحفظة */
  oldPayment?: number
  /** تاريخ دخل سداد الحساب القديم — افتراضي وقت الحضور */
  oldPaymentAtMs?: number
  /** هيدخل لمين النهاردة — لو مش متحدد يبقى دكتوره المتابع */
  doctor?: DoctorId
  byName: string
}) {
  const byName = requireByName(input.byName)
  const db = getDb()
  const [patient, state, appointmentsSnap] = await Promise.all([
    getPatient(input.patientId),
    todayQueueState(input.patientId),
    getDocs(query(collection(db, 'appointments'), where('patientId', '==', input.patientId))),
  ])
  if (!patient) throw new Error('المريض غير موجود')
  if (state.alreadyHere) throw new Error(ALREADY_HERE_ERROR)
  const oldPayment = Math.round(input.oldPayment ?? 0)
  if (!Number.isFinite(oldPayment) || oldPayment < 0) throw new Error('أدخل مبلغ صحيح')
  if (oldPayment > Math.max(0, patient.total - patient.paid)) throw new Error('المدفوع من الحساب القديم أكبر من اللي عليه')

  const reason = input.reason?.trim() || patient.problem?.trim() || 'متابعة'
  const now = Date.now()
  const oldPaidAt =
    Number.isFinite(input.oldPaymentAtMs) && (input.oldPaymentAtMs as number) > 0
      ? Math.round(input.oldPaymentAtMs as number)
      : now + 2
  const queueRef = doc(collection(db, 'queue'))
  const doctor = input.doctor ? toDoctorId(input.doctor) : patient.doctor
  const charge =
    input.charge && input.charge.basePrice > 0
      ? visitWrites(db, {
          patientId: patient.id,
          patientName: patient.name,
          treatment: reason,
          doctorId: doctor,
          basePrice: input.charge.basePrice,
          ...(input.charge.discountPercent ? { discountPercent: input.charge.discountPercent } : {}),
          paidToday: input.charge.paidToday,
          now,
          byName,
        })
      : null
  const changeProblem = Boolean(charge) || (input.isNewTreatment && reason !== patient.problem)

  const batch = writeBatch(db)
  batch.set(
    queueRef,
    queueDoc({
      patientId: patient.id,
      patientName: patient.name,
      phone: patient.phone,
      reason,
      kind: 'followup',
      doctor,
      order: state.order,
      key: state.key,
      now,
      byName,
      ...(charge ? { billedTotal: charge.final } : {}),
    }),
  )
  const paidNow = (charge?.paid ?? 0) + oldPayment
  batch.update(doc(db, 'patients', patient.id), {
    ...touch(),
    ...visitedNow(now),
    ...(changeProblem ? { problem: reason } : {}),
    ...(charge ? { total: increment(charge.final) } : {}),
    ...(paidNow > 0 ? { paid: increment(paidNow) } : {}),
  })
  for (const [ref, data] of charge?.writes ?? []) batch.set(ref, data)
  if (oldPayment > 0) {
    batch.set(
      doc(collection(db, 'payments')),
      paymentDoc({
        patientId: patient.id,
        patientName: patient.name,
        amount: oldPayment,
        kind: 'دفعة',
        doctor: patient.doctor,
        note: 'من الحساب القديم',
        now: oldPaidAt,
        byName,
      }),
    )
  }
  for (const d of appointmentsSnap.docs) {
    const a = mapAppointment(d.id, d.data())
    if (a.date === state.key && a.status === 'upcoming') batch.update(d.ref, { status: 'arrived', ...touch() })
  }
  await batch.commit()

  return { patientId: patient.id, id: queueRef.id, order: state.order }
}

export async function listServices() {
  const snap = await getDocs(collection(getDb(), 'services'))
  return snap.docs
    .map((d) => mapService(d.id, d.data()))
    .sort((a, b) => a.createdAt - b.createdAt)
}

type ServiceInput = { name: string; price: number }

/** واحدة بترمي خطأ لو موجودة؛ أكتر من واحدة بتتخطى الموجود وتتكتب مرة واحدة */
export async function createService(input: ServiceInput | ServiceInput[]) {
  const many = Array.isArray(input)
  const items = (many ? input : [input]).map((s) => {
    const name = s.name.trim()
    if (!name) throw new Error('اكتب اسم الخدمة')
    if (name.includes('+')) throw new Error('اسم الخدمة ما ينفعش يكون فيه علامة +')
    if (!Number.isFinite(s.price) || s.price < 0) throw new Error('السعر غير صحيح')
    return { name, price: Math.round(s.price) }
  })
  const taken = new Set((await listServices()).map((s) => s.name))
  if (!many && taken.has(items[0]!.name)) throw new Error('الخدمة دي موجودة بالفعل')

  const db = getDb()
  const batch = writeBatch(db)
  const now = Date.now()
  items.forEach((s, i) => {
    if (taken.has(s.name)) return
    taken.add(s.name)
    batch.set(doc(collection(db, 'services')), {
      ...s,
      createdAtMs: now + i,
      createdAt: serverTimestamp(),
      ...stamp(),
    })
  })
  await batch.commit()
}

export async function updateServicePrice(id: string, price: number) {
  if (!Number.isFinite(price) || price < 0) throw new Error('السعر غير صحيح')
  await updateDoc(doc(getDb(), 'services', id), { price: Math.round(price), ...touch() })
}

export async function deleteService(id: string) {
  await deleteDoc(doc(getDb(), 'services', id))
}

export async function createExpense(input: {
  category: string
  amount: number
  note?: string
  spentAt: Date
}) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('أدخل مبلغ صحيح')
  const category = input.category.trim() || 'أخرى'
  await addDoc(collection(getDb(), 'expenses'), {
    category,
    amount: Math.round(input.amount),
    note: input.note?.trim() ?? '',
    date: formatArabicDate(input.spentAt),
    dayKey: dayKey(input.spentAt),
    spentAtMs: input.spentAt.getTime(),
    createdAtMs: Date.now(),
    createdAt: serverTimestamp(),
    ...stamp(),
  })
  if (category !== 'أخرى') await rememberExpenseCategory(category)
}

/** يحفظ النوع الحر ضمن اقتراحات الخزنة للمرات الجاية */
async function rememberExpenseCategory(category: string) {
  try {
    const settings = await getClinicSettings()
    if (settings.expenseCategories.includes(category)) return
    const fixed = new Set(FIXED_EXPENSE_CATEGORIES)
    const customs = settings.expenseCategories.filter((c) => c !== 'أخرى' && !fixed.has(c))
    if (!customs.includes(category)) customs.push(category)
    await saveClinicSettings({
      ...settings,
      expenseCategories: [...FIXED_EXPENSE_CATEGORIES, ...customs, 'أخرى'],
    })
  } catch {
    /* الاقتراح مش أساسي لو الإعدادات فشلت */
  }
}

export async function deleteExpense(id: string) {
  await deleteDoc(doc(getDb(), 'expenses', id))
}

/** كل الماليات من تاريخ معين (ولحد تاريخ لو اتحدد) — للتقارير ومراجعة الأيام اللي فاتت */
export async function listFinanceSince(sinceMs: number, untilMs?: number) {
  const db = getDb()
  const range = (field: string) =>
    untilMs === undefined
      ? [where(field, '>=', sinceMs)]
      : [where(field, '>=', sinceMs), where(field, '<', untilMs)]
  const [paymentsSnap, expensesSnap, visitsSnap] = await Promise.all([
    getDocs(query(collection(db, 'payments'), ...range('createdAtMs'))),
    getDocs(query(collection(db, 'expenses'), ...range('spentAtMs'))),
    getDocs(query(collection(db, 'visits'), ...range('createdAtMs'))),
  ])
  return {
    payments: paymentsSnap.docs
      .map((d) => mapPayment(d.id, d.data()))
      .filter(isActivePayment)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    expenses: expensesSnap.docs
      .map((d) => mapExpense(d.id, d.data()))
      .sort((a, b) => b.spentAt - a.spentAt),
    visits: visitsSnap.docs.map((d) => mapVisit(d.id, d.data())),
  }
}

export async function listPaymentsForPatient(patientId: string) {
  const snap = await getDocs(query(collection(getDb(), 'payments'), where('patientId', '==', patientId)))
  return snap.docs
    .map((d) => mapPayment(d.id, d.data()))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
}

function bookingSourceOf(value: unknown): BookingSource {
  return value === 'phone' ? 'phone' : 'clinic'
}

function checkupFeeStatusOf(value: unknown): CheckupFeeStatus {
  return value === 'unpaid' ? 'unpaid' : 'paid'
}

function mapAppointment(id: string, data: DocumentData): ClinicAppointment {
  const status = String(data['status'] ?? 'upcoming')
  return {
    id,
    patientId: String(data['patientId'] ?? ''),
    patientName: String(data['patientName'] ?? ''),
    phone: String(data['phone'] ?? ''),
    date: String(data['date'] ?? ''),
    time: String(data['time'] ?? ''),
    note: String(data['note'] ?? ''),
    status: status === 'arrived' || status === 'cancelled' ? status : 'upcoming',
    doctor: toDoctorId(data['doctor']),
    /** الحجوزات القديمة من غير الحقل = من العيادة + دفع كشف */
    bookingSource: bookingSourceOf(data['bookingSource']),
    checkupFeeStatus: checkupFeeStatusOf(data['checkupFeeStatus']),
    createdAt: Number(data['createdAtMs'] ?? 0),
    updatedAt: Number(data['updatedAtMs'] ?? 0),
    by: String(data['createdByName'] ?? ''),
  }
}

const byDateTime = (a: ClinicAppointment, b: ClinicAppointment) =>
  a.date.localeCompare(b.date) || (a.time || '99').localeCompare(b.time || '99')

export async function createAppointment(input: {
  patientId: string
  date: string
  time?: string
  note?: string
  /** لو مش متحدد يبقى دكتور المريض المتابع */
  doctor?: DoctorId
  bookingSource?: BookingSource
  checkupFeeStatus?: CheckupFeeStatus
}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('اختار تاريخ الموعد')
  if (input.date < dayKey()) throw new Error('التاريخ ده عدى — اختار يوم جاي')
  const db = getDb()
  const [patient, existing] = await Promise.all([
    getPatient(input.patientId),
    getDocs(query(collection(db, 'appointments'), where('patientId', '==', input.patientId))),
  ])
  if (!patient) throw new Error('المريض غير موجود')
  const sameDay = existing.docs.some((d) => {
    const a = mapAppointment(d.id, d.data())
    return a.date === input.date && a.status === 'upcoming'
  })
  if (sameDay) throw new Error('المريض ده عنده موعد في اليوم ده بالفعل')
  const bookingSource = input.bookingSource === 'phone' ? 'phone' : 'clinic'
  const checkupFeeStatus = input.checkupFeeStatus === 'unpaid' ? 'unpaid' : 'paid'
  await addDoc(collection(db, 'appointments'), {
    patientId: patient.id,
    patientName: patient.name,
    phone: patient.phone,
    doctor: input.doctor ? toDoctorId(input.doctor) : patient.doctor,
    date: input.date,
    time: input.time?.trim() ?? '',
    note: input.note?.trim() ?? '',
    status: 'upcoming',
    bookingSource,
    checkupFeeStatus,
    createdAtMs: Date.now(),
    createdAt: serverTimestamp(),
    ...stamp(),
  })
}

/** تحويل «بدون دفع كشف» → دفع كشف + تسجيل المبلغ في الدخل */
export async function markAppointmentCheckupPaid(input: {
  appointmentId: string
  amount: number
  byName: string
  paidAtMs?: number
}) {
  const byName = requireByName(input.byName)
  const amount = Math.round(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('أدخل مبلغ الكشف')
  const paidAt = Number.isFinite(input.paidAtMs) ? Math.round(input.paidAtMs as number) : Date.now()
  const db = getDb()
  const appointmentRef = doc(db, 'appointments', input.appointmentId)
  const snap = await getDoc(appointmentRef)
  if (!snap.exists()) throw new Error('الموعد غير موجود')
  const appointment = mapAppointment(snap.id, snap.data())
  if (appointment.checkupFeeStatus === 'paid') throw new Error('الكشف ده متسجل مدفوع قبل كده')
  const patient = await getPatient(appointment.patientId)
  if (!patient) throw new Error('المريض غير موجود')

  const charge = visitWrites(db, {
    patientId: patient.id,
    patientName: patient.name,
    treatment: NEW_PATIENT_FEE_NAME,
    doctorId: appointment.doctor,
    basePrice: amount,
    paidToday: amount,
    now: paidAt,
    byName,
  })

  const batch = writeBatch(db)
  for (const [ref, data] of charge.writes) batch.set(ref, data)
  batch.update(doc(db, 'patients', patient.id), {
    ...touch(),
    total: increment(charge.final),
    paid: increment(charge.paid),
  })
  batch.update(appointmentRef, {
    checkupFeeStatus: 'paid',
    ...touch(),
  })
  await batch.commit()
  return { amount: charge.paid, patientId: patient.id }
}

/** المواعيد من النهاردة لحد 90 يوم قدام (من غير ما نسحب سنين قدام) */
export async function listUpcomingAppointments(fromKey = dayKey()) {
  const toKey = dayKey(addDays(new Date(`${fromKey}T12:00:00`), 90))
  const snap = await getDocs(
    query(collection(getDb(), 'appointments'), where('date', '>=', fromKey), where('date', '<=', toKey)),
  )
  return snap.docs.map((d) => mapAppointment(d.id, d.data())).sort(byDateTime)
}

export async function listPatientAppointments(patientId: string) {
  const snap = await getDocs(query(collection(getDb(), 'appointments'), where('patientId', '==', patientId)))
  return snap.docs.map((d) => mapAppointment(d.id, d.data())).sort(byDateTime)
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  await updateDoc(doc(getDb(), 'appointments', id), { status, ...touch() })
}

/** علامة الحضور اتعملت غلط — الموعد يرجع جاي ويتشال من اللي جم النهاردة لو لسه ما اتحاسبش */
export async function undoAppointmentArrival(input: { id: string; patientId: string; date: string }) {
  const db = getDb()
  const queue = await getDocs(dayQueueQuery(input.date))
  const entries = queue.docs.filter((d) => {
    const data = d.data()
    return String(data['patientId'] ?? '') === input.patientId && isActiveQueueStatus(String(data['status'] ?? ''))
  })
  if (entries.some((d) => Boolean(d.data()['billed']))) {
    throw new Error('المريض اتسجل له حساب النهاردة — مينفعش يتلغى حضوره من هنا')
  }
  const batch = writeBatch(db)
  batch.update(doc(db, 'appointments', input.id), { status: 'upcoming', ...touch() })
  for (const d of entries) batch.update(d.ref, { status: 'ملغي', ...touch() })
  await batch.commit()
}

/* ───────── إعدادات العيادة: settings/clinic ───────── */

function numberList(value: unknown, fallback: number[]) {
  if (!Array.isArray(value)) return fallback
  const list = [...new Set(value.map((v) => clampPercent(Number(v))))].sort((a, b) => a - b)
  return list.length ? list : fallback
}

function textList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback
  const list = [...new Set(value.map((v) => String(v ?? '').trim()).filter(Boolean))]
  return list.length ? list : fallback
}

function nursesList(value: unknown) {
  if (!Array.isArray(value)) return DEFAULT_SETTINGS.nurses
  return [...new Set(value.map((v) => String(v ?? '').trim()).filter(Boolean))]
}

function normalizeExpenseCategories(list: string[]) {
  const renamed = list.map((c) => (c === 'كهربا' ? 'كهرباء' : c))
  const fixed = FIXED_EXPENSE_CATEGORIES
  const customs = renamed.filter((c) => c !== 'أخرى' && !fixed.includes(c))
  const seen = new Set<string>()
  const out: string[] = []
  for (const c of [...fixed, ...customs, 'أخرى']) {
    if (seen.has(c)) continue
    seen.add(c)
    out.push(c)
  }
  return out
}

function mapSettings(data: DocumentData | undefined): ClinicSettings {
  const fee = Number(data?.['newPatientFee'])
  return {
    newPatientFee: Number.isFinite(fee) && fee >= 0 ? Math.round(fee) : DEFAULT_SETTINGS.newPatientFee,
    discountPresets: numberList(data?.['discountPresets'], DEFAULT_SETTINGS.discountPresets),
    expenseCategories: normalizeExpenseCategories(
      textList(data?.['expenseCategories'], DEFAULT_SETTINGS.expenseCategories),
    ),
    nurses: nursesList(data?.['nurses']),
  }
}

const SETTINGS_TIMEOUT_MS = 8000

export async function getClinicSettings() {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(Object.assign(new Error('settings timeout'), { code: 'unavailable' })),
      SETTINGS_TIMEOUT_MS,
    )
  })
  try {
    const snap = await Promise.race([getDoc(doc(getDb(), 'settings', 'clinic')), timeout])
    return mapSettings(snap.exists() ? snap.data() : undefined)
  } finally {
    clearTimeout(timer)
  }
}

export async function saveClinicSettings(input: ClinicSettings) {
  if (!Number.isFinite(input.newPatientFee) || input.newPatientFee < 0) throw new Error('سعر الكشف غير صحيح')
  const clean = mapSettings({ ...input })
  if (!clean.discountPresets.includes(0)) clean.discountPresets.unshift(0)
  await setDoc(doc(getDb(), 'settings', 'clinic'), { ...clean, ...touch() }, { merge: true })
}

function mapBackup(id: string, data: DocumentData): BackupLog {
  return {
    id,
    dayKey: String(data['dayKey'] ?? ''),
    fileName: String(data['fileName'] ?? ''),
    downloadedAt: Number(data['downloadedAtMs'] ?? 0),
    byEmail: String(data['byEmail'] ?? data['createdBy'] ?? ''),
    byName: String(data['byName'] ?? data['createdByName'] ?? ''),
    patientsCount: Number(data['patientsCount'] ?? 0),
    visitsCount: Number(data['visitsCount'] ?? 0),
    paymentsCount: Number(data['paymentsCount'] ?? 0),
    expensesCount: Number(data['expensesCount'] ?? 0),
  }
}

async function listAllVisits() {
  const snap = await getDocs(collection(getDb(), 'visits'))
  return snap.docs.map((d) => mapVisit(d.id, d.data()))
}

async function listAllExpenses() {
  const snap = await getDocs(collection(getDb(), 'expenses'))
  return snap.docs.map((d) => mapExpense(d.id, d.data()))
}

async function listAllAppointments() {
  const snap = await getDocs(collection(getDb(), 'appointments'))
  return snap.docs.map((d) => mapAppointment(d.id, d.data()))
}

function mapLabEntry(id: string, data: DocumentData): LabEntry {
  return {
    id,
    dayKey: String(data['dayKey'] ?? ''),
    caseName: String(data['caseName'] ?? ''),
    amount: Number(data['amount'] ?? 0),
    note: String(data['note'] ?? ''),
    date: String(data['date'] ?? ''),
    spentAt: Number(data['spentAtMs'] ?? data['createdAtMs'] ?? 0),
    createdAt: Number(data['createdAtMs'] ?? 0),
    by: String(data['createdByName'] ?? ''),
  }
}

export async function listLabEntries() {
  const snap = await getDocs(collection(getDb(), 'labEntries'))
  return snap.docs.map((d) => mapLabEntry(d.id, d.data())).sort((a, b) => b.spentAt - a.spentAt)
}

export async function createLabEntry(input: {
  caseName: string
  amount: number
  spentAt: Date
  note?: string
}) {
  const caseName = input.caseName.trim()
  if (!caseName) throw new Error('اكتب اسم الحالة')
  if (!Number.isFinite(input.amount) || input.amount < 0) throw new Error('أدخل مبلغ صحيح')
  await addDoc(collection(getDb(), 'labEntries'), {
    caseName,
    amount: Math.round(input.amount),
    note: input.note?.trim() ?? '',
    date: formatArabicDate(input.spentAt),
    dayKey: dayKey(input.spentAt),
    spentAtMs: input.spentAt.getTime(),
    createdAtMs: Date.now(),
    createdAt: serverTimestamp(),
    ...stamp(),
  })
}

export async function deleteLabEntry(id: string) {
  await deleteDoc(doc(getDb(), 'labEntries', id))
}

function mapMaterialInvoice(id: string, data: DocumentData): MaterialInvoice {
  return {
    id,
    dayKey: String(data['dayKey'] ?? ''),
    name: String(data['name'] ?? ''),
    total: Number(data['total'] ?? 0),
    date: String(data['date'] ?? ''),
    createdAt: Number(data['createdAtMs'] ?? 0),
    by: String(data['createdByName'] ?? ''),
  }
}

function mapMaterialMovement(id: string, data: DocumentData): MaterialMovement {
  return {
    id,
    invoiceId: String(data['invoiceId'] ?? ''),
    dayKey: String(data['dayKey'] ?? ''),
    date: String(data['date'] ?? ''),
    paid: Number(data['paid'] ?? 0),
    discount: Number(data['discount'] ?? 0),
    remainingAfter: Number(data['remainingAfter'] ?? 0),
    note: String(data['note'] ?? ''),
    createdAt: Number(data['createdAtMs'] ?? 0),
    by: String(data['createdByName'] ?? ''),
  }
}

export async function listMaterialInvoices() {
  const snap = await getDocs(collection(getDb(), 'materialInvoices'))
  return snap.docs.map((d) => mapMaterialInvoice(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt)
}

export async function listMaterialMovements() {
  const snap = await getDocs(collection(getDb(), 'materialMovements'))
  return snap.docs.map((d) => mapMaterialMovement(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt)
}

export async function createMaterialInvoice(input: {
  name: string
  total: number
  spentAt: Date
  paid?: number
  discount?: number
}) {
  const name = input.name.trim()
  if (!name) throw new Error('اكتب اسم المورد أو الفاتورة')
  const total = Math.round(input.total)
  if (!Number.isFinite(total) || total <= 0) throw new Error('أدخل إجمالي الفاتورة')
  const paid = Math.max(0, Math.round(input.paid ?? 0))
  const discount = Math.max(0, Math.round(input.discount ?? 0))
  if (paid + discount > total) throw new Error('المدفوع والخصم أكبر من إجمالي الفاتورة')

  const db = getDb()
  const invoiceRef = doc(collection(db, 'materialInvoices'))
  const spentAt = input.spentAt
  const now = Date.now()
  const remaining = total - paid - discount
  const batch = writeBatch(db)
  batch.set(invoiceRef, {
    name,
    total,
    date: formatArabicDate(spentAt),
    dayKey: dayKey(spentAt),
    createdAtMs: now,
    createdAt: serverTimestamp(),
    ...stamp(),
  })
  if (paid > 0 || discount > 0) {
    batch.set(doc(collection(db, 'materialMovements')), {
      invoiceId: invoiceRef.id,
      paid,
      discount,
      remainingAfter: remaining,
      note: 'أول تسجيل للفاتورة',
      date: formatArabicDate(spentAt),
      dayKey: dayKey(spentAt),
      createdAtMs: now + 1,
      createdAt: serverTimestamp(),
      ...stamp(),
    })
  }
  await batch.commit()
  return { id: invoiceRef.id }
}

export async function addMaterialMovement(input: {
  invoiceId: string
  paid?: number
  discount?: number
  note?: string
  spentAt: Date
}) {
  const paid = Math.max(0, Math.round(input.paid ?? 0))
  const discount = Math.max(0, Math.round(input.discount ?? 0))
  if (paid <= 0 && discount <= 0) throw new Error('سجّل مبلغ مدفوع أو خصم')

  const db = getDb()
  const invoiceRef = doc(db, 'materialInvoices', input.invoiceId)
  const [invoiceSnap, movesSnap] = await Promise.all([
    getDoc(invoiceRef),
    getDocs(query(collection(db, 'materialMovements'), where('invoiceId', '==', input.invoiceId))),
  ])
  if (!invoiceSnap.exists()) throw new Error('الفاتورة مش موجودة')
  const invoice = mapMaterialInvoice(invoiceSnap.id, invoiceSnap.data())
  const settled = movesSnap.docs.reduce((s, d) => {
    const m = d.data()
    return s + Number(m['paid'] ?? 0) + Number(m['discount'] ?? 0)
  }, 0)
  const due = Math.max(0, invoice.total - settled)
  if (paid + discount > due) throw new Error(`المبلغ أكبر من المتبقي (${due.toLocaleString('en-EG')} جنيه)`)
  const remainingAfter = due - paid - discount
  await addDoc(collection(db, 'materialMovements'), {
    invoiceId: input.invoiceId,
    paid,
    discount,
    remainingAfter,
    note: input.note?.trim() ?? '',
    date: formatArabicDate(input.spentAt),
    dayKey: dayKey(input.spentAt),
    createdAtMs: Date.now(),
    createdAt: serverTimestamp(),
    ...stamp(),
  })
  return { remainingAfter }
}

export async function deleteMaterialInvoice(id: string) {
  const db = getDb()
  const moves = await getDocs(query(collection(db, 'materialMovements'), where('invoiceId', '==', id)))
  const batch = writeBatch(db)
  batch.delete(doc(db, 'materialInvoices', id))
  for (const d of moves.docs) batch.delete(d.ref)
  await batch.commit()
}

/** هل الدكتور نزّل نسخة الشهر ده؟ (dayKey هنا = YYYY-MM) — عدد قليل في الشهر، ترتيب على الكلاينت */
export async function getBackupForMonth(key = monthKey()) {
  const snap = await getDocs(query(collection(getDb(), 'backups'), where('dayKey', '==', key)))
  const list = snap.docs.map((d) => mapBackup(d.id, d.data()))
  list.sort((a, b) => b.downloadedAt - a.downloadedAt)
  return list[0] ?? null
}

/** آخر نسخة اتنزلت (أي شهر) */
export async function getLatestBackup() {
  const snap = await getDocs(
    query(collection(getDb(), 'backups'), orderBy('downloadedAtMs', 'desc'), limit(1)),
  )
  const d = snap.docs[0]
  return d ? mapBackup(d.id, d.data()) : null
}

/** يبني Excel بكل بيانات العيادة من أول يوم وينزّله — الإلزام مرة كل شهر للدكتور */
export async function downloadClinicBackup() {
  const { backupFileName, buildClinicWorkbook, triggerXlsxDownload } = await import('@/lib/clinic-backup')
  const key = monthKey()
  const fileName = backupFileName(key)
  const [patients, payments, visits, expenses, appointments, services] = await Promise.all([
    listPatients(),
    listPayments(),
    listAllVisits(),
    listAllExpenses(),
    listAllAppointments(),
    listServices(),
  ])

  const buffer = await buildClinicWorkbook({
    patients,
    visits,
    payments,
    expenses,
    appointments,
    services,
  })
  triggerXlsxDownload(buffer, fileName)

  const a = actor()
  const now = Date.now()
  const ref = doc(collection(getDb(), 'backups'))
  const log: Omit<BackupLog, 'id'> = {
    dayKey: key,
    fileName,
    downloadedAt: now,
    byEmail: a.email,
    byName: a.name,
    patientsCount: patients.length,
    visitsCount: visits.length,
    paymentsCount: payments.length,
    expensesCount: expenses.length,
  }
  await setDoc(ref, {
    ...log,
    downloadedAtMs: now,
    createdAtMs: now,
    createdAt: serverTimestamp(),
    createdBy: a.email,
    createdByName: a.name,
  })
  return { id: ref.id, ...log }
}
