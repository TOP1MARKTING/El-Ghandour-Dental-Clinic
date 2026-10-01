import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type Firestore,
} from 'firebase/firestore'
import { getAuthClient, getDb } from '@/lib/backend'
import { dayKey, formatArabicDate, formatArabicDateTime, formatClock } from '@/lib/format'
import { applyDiscount, clampPercent, DEFAULT_SETTINGS, NEW_PATIENT_FEE_NAME } from '@/lib/pricing'
import type {
  AppointmentStatus,
  ClinicAppointment,
  ClinicSettings,
  Expense,
  Patient,
  Payment,
  PaymentKind,
  QueueEntry,
  QueueStatus,
  Service,
  Visit,
} from '@/types'

let actorName = ''

/** اسم اللي فاتح الحساب — بيتحط مع كل عملية عشان نعرف مين عملها */
export function setActorName(name: string) {
  actorName = name
}

function actor() {
  const email = getAuthClient().currentUser?.email ?? ''
  return { email, name: actorName || email }
}

function stamp() {
  const a = actor()
  return { createdBy: a.email, createdByName: a.name }
}

function touch() {
  const a = actor()
  return { updatedBy: a.email, updatedByName: a.name, updatedAtMs: Date.now() }
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
    lastVisit: String(data['lastVisit'] ?? '—'),
    total: Number(data['total'] ?? 0),
    paid: Number(data['paid'] ?? 0),
    createdAt: Number(data['createdAtMs'] ?? 0),
    by: String(data['createdByName'] ?? ''),
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
  }
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
}) {
  const now = Date.now()
  const registeredAt = formatArabicDate()
  const ref = await addDoc(collection(getDb(), 'patients'), {
    name: input.name.trim(),
    phone: input.phone.trim(),
    age: input.age ?? 0,
    address: input.address?.trim() ?? '',
    problem: input.problem?.trim() ?? '',
    notes: input.notes?.trim() ?? '',
    registeredAt,
    lastVisit: '—',
    total: 0,
    paid: 0,
    createdAtMs: now,
    createdAt: serverTimestamp(),
    ...stamp(),
  })
  return ref.id
}

export async function deletePatient(id: string) {
  const visitsSnap = await getDocs(query(collection(getDb(), 'visits'), where('patientId', '==', id)))
  const paymentsSnap = await getDocs(query(collection(getDb(), 'payments'), where('patientId', '==', id)))
  const queueSnap = await getDocs(query(collection(getDb(), 'queue'), where('patientId', '==', id)))
  const appointmentsSnap = await getDocs(query(collection(getDb(), 'appointments'), where('patientId', '==', id)))

  await Promise.all([
    ...visitsSnap.docs.map((d) => deleteDoc(d.ref)),
    ...paymentsSnap.docs.map((d) => deleteDoc(d.ref)),
    ...queueSnap.docs.map((d) => deleteDoc(d.ref)),
    ...appointmentsSnap.docs.map((d) => deleteDoc(d.ref)),
  ])
  await deleteDoc(doc(getDb(), 'patients', id))
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
}) {
  if (input.basePrice < 0) throw new Error('السعر غير صحيح')
  const db = getDb()

  await runTransaction(db, async (tx) => {
    const patientRef = doc(db, 'patients', input.patientId)
    const patientSnap = await tx.get(patientRef)
    if (!patientSnap.exists()) throw new Error('المريض غير موجود')
    const patient = mapPatient(patientSnap.id, patientSnap.data())

    const visit = visitWrites(db, { ...input, patientName: patient.name, now: Date.now() })
    for (const [ref, data] of visit.writes) tx.set(ref, data)

    tx.update(patientRef, {
      ...touch(),
      total: patient.total + visit.final,
      paid: patient.paid + visit.paid,
      lastVisit: 'اليوم',
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
    basePrice: number
    discountPercent?: number
    paidToday: number
    notes?: string
    now: number
  },
) {
  const charge = applyDiscount(input.basePrice, input.discountPercent)
  const paid = Math.max(0, Math.min(input.paidToday, charge.final))
  const treatment = input.treatment.trim()
  const writes: Array<[DocumentReference, DocumentData]> = [
    [
      doc(collection(db, 'visits')),
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
        ...stamp(),
      },
    ],
  ]
  if (paid > 0) {
    writes.push([
      doc(collection(db, 'payments')),
      {
        patientId: input.patientId,
        patient: input.patientName,
        amount: paid,
        date: formatArabicDateTime(),
        method: 'نقدي',
        note: '',
        kind: treatment === NEW_PATIENT_FEE_NAME ? 'كشف' : 'علاج',
        createdAtMs: input.now,
        createdAt: serverTimestamp(),
        ...stamp(),
      },
    ])
  }
  return { writes, final: charge.final, paid }
}

export async function listPayments() {
  const snap = await getDocs(collection(getDb(), 'payments'))
  return snap.docs
    .map((d) => mapPayment(d.id, d.data()))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
}

export async function createPayment(input: {
  patientId: string
  amount: number
  method?: string
  note?: string
}) {
  const db = getDb()
  let remaining = 0

  await runTransaction(db, async (tx) => {
    const patientRef = doc(db, 'patients', input.patientId)
    const patientSnap = await tx.get(patientRef)
    if (!patientSnap.exists()) throw new Error('المريض غير موجود')
    const patient = mapPatient(patientSnap.id, patientSnap.data())

    const due = Math.max(0, patient.total - patient.paid)
    if (due <= 0) throw new Error('مفيش باقي على المريض')

    const amount = Math.max(0, Math.min(input.amount, due))
    if (amount <= 0) throw new Error('أدخل مبلغ صحيح')

    const now = Date.now()
    const paymentRef = doc(collection(db, 'payments'))
    tx.set(paymentRef, {
      patientId: input.patientId,
      patient: patient.name,
      amount,
      date: formatArabicDateTime(),
      method: input.method ?? 'نقدي',
      note: input.note?.trim() ?? '',
      kind: 'دفعة',
      createdAtMs: now,
      createdAt: serverTimestamp(),
      ...stamp(),
    })

    tx.update(patientRef, {
      ...touch(),
      paid: patient.paid + amount,
    })

    remaining = Math.max(0, due - amount)
  })

  return { remaining }
}

export async function listTodayQueue() {
  const key = dayKey()
  const snap = await getDocs(query(collection(getDb(), 'queue'), where('dayKey', '==', key)))
  return snap.docs
    .map((d) => mapQueue(d.id, d.data()))
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
}

export function subscribeTodayQueue(onData: (queue: QueueEntry[]) => void, onError: (err: Error) => void) {
  const key = dayKey()
  return onSnapshot(
    query(collection(getDb(), 'queue'), where('dayKey', '==', key)),
    (snap) =>
      onData(
        snap.docs
          .map((d) => mapQueue(d.id, d.data()))
          .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt),
      ),
    onError,
  )
}

/** قراءة واحدة لزيارات النهاردة: رقم الترتيب الجاي، وهل المريض متسجل بالفعل */
async function todayQueueState(patientId?: string) {
  const key = dayKey()
  const snap = await getDocs(query(collection(getDb(), 'queue'), where('dayKey', '==', key)))
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
  order: number
  key: string
  now: number
  billedTotal?: number
}) {
  return {
    patientId: input.patientId,
    patientName: input.patientName.trim(),
    phone: input.phone.trim(),
    reason: input.reason.trim() || (input.kind === 'new' ? 'كشف جديد' : 'متابعة'),
    kind: input.kind,
    order: input.order,
    arrivedAt: formatClock(),
    dayKey: input.key,
    status: 'في الانتظار',
    createdAtMs: input.now,
    createdAt: serverTimestamp(),
    ...stamp(),
    ...(input.billedTotal !== undefined ? { billed: true, billedTotal: input.billedTotal } : {}),
  }
}

type ChargeInput = { basePrice: number; discountPercent?: number; paidToday: number }

export async function checkInNewPatient(input: {
  name: string
  phone: string
  age?: number
  address?: string
  reason?: string
  /** سعر الكشف من إعدادات العيادة */
  feePrice: number
  /** دفع الكشف ولا اتسجل عليه */
  feePaid?: boolean
  /** لو اتحدد سعر عند الحجز بيتسجل العلاج والدفعة على طول */
  charge?: ChargeInput
}) {
  const db = getDb()
  const name = input.name.trim()
  const phone = input.phone.trim()
  const reason = input.reason?.trim() || 'كشف جديد'
  const now = Date.now()
  const { key, order } = await todayQueueState()

  const patientRef = doc(collection(db, 'patients'))
  const queueRef = doc(collection(db, 'queue'))
  const fee = visitWrites(db, {
    patientId: patientRef.id,
    patientName: name,
    treatment: NEW_PATIENT_FEE_NAME,
    basePrice: input.feePrice,
    paidToday: input.feePaid === false ? 0 : input.feePrice,
    now,
  })
  const charge =
    input.charge && input.charge.basePrice > 0
      ? visitWrites(db, {
          patientId: patientRef.id,
          patientName: name,
          treatment: reason,
          basePrice: input.charge.basePrice,
          ...(input.charge.discountPercent ? { discountPercent: input.charge.discountPercent } : {}),
          paidToday: input.charge.paidToday,
          now: now + 1,
        })
      : null

  const batch = writeBatch(db)
  batch.set(patientRef, {
    name,
    phone,
    age: input.age ?? 0,
    address: input.address?.trim() ?? '',
    problem: reason,
    notes: '',
    registeredAt: formatArabicDate(),
    lastVisit: 'اليوم',
    total: fee.final + (charge?.final ?? 0),
    paid: fee.paid + (charge?.paid ?? 0),
    createdAtMs: now,
    createdAt: serverTimestamp(),
    ...stamp(),
  })
  batch.set(
    queueRef,
    queueDoc({
      patientId: patientRef.id,
      patientName: name,
      phone,
      reason,
      kind: 'new',
      order,
      key,
      now,
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
}) {
  const db = getDb()
  const [patient, state] = await Promise.all([getPatient(input.patientId), todayQueueState(input.patientId)])
  if (!patient) throw new Error('المريض غير موجود')
  if (state.alreadyHere) throw new Error('المريض ده متسجل إنه جه النهاردة بالفعل')

  const reason = input.reason?.trim() || patient.problem?.trim() || 'متابعة'
  const now = Date.now()
  const queueRef = doc(collection(db, 'queue'))
  const charge =
    input.charge && input.charge.basePrice > 0
      ? visitWrites(db, {
          patientId: patient.id,
          patientName: patient.name,
          treatment: reason,
          basePrice: input.charge.basePrice,
          ...(input.charge.discountPercent ? { discountPercent: input.charge.discountPercent } : {}),
          paidToday: input.charge.paidToday,
          now,
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
      kind: input.isNewTreatment ? 'new' : 'followup',
      order: state.order,
      key: state.key,
      now,
      ...(charge ? { billedTotal: charge.final } : {}),
    }),
  )
  batch.update(doc(db, 'patients', patient.id), {
    ...touch(),
    lastVisit: 'اليوم',
    ...(changeProblem ? { problem: reason } : {}),
    ...(charge ? { total: increment(charge.final), paid: increment(charge.paid) } : {}),
  })
  for (const [ref, data] of charge?.writes ?? []) batch.set(ref, data)
  await batch.commit()

  return { patientId: patient.id, id: queueRef.id, order: state.order }
}

export async function updateQueueStatus(id: string, status: QueueStatus) {
  await updateDoc(doc(getDb(), 'queue', id), { status, ...touch() })
}

export async function getQueueEntry(id: string) {
  const ref = await getDoc(doc(getDb(), 'queue', id))
  if (!ref.exists()) return null
  return mapQueue(ref.id, ref.data())
}

/** بعد الكشف: تسجيل الاتفاق والسعر والمدفوع ثم إنهاء الدور — دفعة واحدة atomic */
export async function settleQueueBilling(input: {
  queueId: string
  treatment?: string
  basePrice: number
  discountPercent?: number
  paidToday: number
  notes?: string
}) {
  if (input.basePrice <= 0) throw new Error('أدخل سعر الاتفاق')
  const charge = applyDiscount(input.basePrice, input.discountPercent)
  const paidToday = Math.max(0, Math.min(input.paidToday, charge.final))
  const now = Date.now()
  const date = formatArabicDate()
  const db = getDb()
  let patientId = ''

  await runTransaction(db, async (tx) => {
    const queueRef = doc(db, 'queue', input.queueId)
    const queueSnap = await tx.get(queueRef)
    if (!queueSnap.exists()) throw new Error('الدور غير موجود')

    const entry = mapQueue(queueSnap.id, queueSnap.data())
    patientId = entry.patientId

    if (entry.status === 'تم الكشف' || entry.status === 'ملغي') {
      throw new Error('الدور ده خلص بالفعل')
    }
    if (entry.status === 'في الانتظار') {
      throw new Error('المريض لسه في الانتظار — دخّله للدكتور الأول')
    }

    const patientRef = doc(db, 'patients', entry.patientId)
    const patientSnap = await tx.get(patientRef)
    if (!patientSnap.exists()) throw new Error('المريض غير موجود')
    const patient = mapPatient(patientSnap.id, patientSnap.data())

    const treatment = input.treatment?.trim() || entry.reason || 'كشف'

    tx.update(queueRef, { status: 'تم الكشف', reason: treatment, ...touch() })

    const visitRef = doc(collection(db, 'visits'))
    tx.set(visitRef, {
      patientId: entry.patientId,
      patientName: patient.name,
      treatment,
      doctor: '',
      price: charge.final,
      basePrice: charge.base,
      discountPercent: charge.percent,
      discountAmount: charge.discountAmount,
      paidToday,
      notes: input.notes?.trim() ?? '',
      date,
      queueId: input.queueId,
      createdAtMs: now,
      createdAt: serverTimestamp(),
      ...stamp(),
    })

    if (paidToday > 0) {
      const paymentRef = doc(collection(db, 'payments'))
      tx.set(paymentRef, {
        patientId: entry.patientId,
        patient: patient.name,
        amount: paidToday,
        date: formatArabicDateTime(),
        method: 'نقدي',
        note: '',
        kind: 'علاج',
        queueId: input.queueId,
        createdAtMs: now,
        createdAt: serverTimestamp(),
        ...stamp(),
      })
    }

    tx.update(patientRef, {
      ...touch(),
      total: patient.total + charge.final,
      paid: patient.paid + paidToday,
      lastVisit: 'اليوم',
      problem: treatment,
    })
  })

  return { patientId }
}

export async function listServices() {
  const snap = await getDocs(collection(getDb(), 'services'))
  return snap.docs
    .map((d) => mapService(d.id, d.data()))
    .sort((a, b) => a.createdAt - b.createdAt)
}

export async function createService(input: { name: string; price: number }) {
  const name = input.name.trim()
  if (!name) throw new Error('اكتب اسم الخدمة')
  if (name.includes('+')) throw new Error('اسم الخدمة ما ينفعش يكون فيه علامة +')
  if (!Number.isFinite(input.price) || input.price < 0) throw new Error('السعر غير صحيح')
  const existing = await listServices()
  if (existing.some((s) => s.name === name)) throw new Error('الخدمة دي موجودة بالفعل')
  await addDoc(collection(getDb(), 'services'), {
    name,
    price: Math.round(input.price),
    createdAtMs: Date.now(),
    createdAt: serverTimestamp(),
    ...stamp(),
  })
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
  await addDoc(collection(getDb(), 'expenses'), {
    category: input.category.trim() || 'أخرى',
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
    createdAt: Number(data['createdAtMs'] ?? 0),
    updatedAt: Number(data['updatedAtMs'] ?? 0),
    by: String(data['createdByName'] ?? ''),
  }
}

const byDateTime = (a: ClinicAppointment, b: ClinicAppointment) =>
  a.date.localeCompare(b.date) || (a.time || '99').localeCompare(b.time || '99')

export async function createAppointment(input: { patientId: string; date: string; time?: string; note?: string }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('اختار تاريخ الموعد')
  if (input.date < dayKey()) throw new Error('التاريخ ده عدى — اختار يوم جاي')
  const patient = await getPatient(input.patientId)
  if (!patient) throw new Error('المريض غير موجود')
  await addDoc(collection(getDb(), 'appointments'), {
    patientId: patient.id,
    patientName: patient.name,
    phone: patient.phone,
    date: input.date,
    time: input.time?.trim() ?? '',
    note: input.note?.trim() ?? '',
    status: 'upcoming',
    createdAtMs: Date.now(),
    createdAt: serverTimestamp(),
    ...stamp(),
  })
}

/** المواعيد من النهاردة ورايح */
export async function listUpcomingAppointments() {
  const snap = await getDocs(query(collection(getDb(), 'appointments'), where('date', '>=', dayKey())))
  return snap.docs.map((d) => mapAppointment(d.id, d.data())).sort(byDateTime)
}

export async function listPatientAppointments(patientId: string) {
  const snap = await getDocs(query(collection(getDb(), 'appointments'), where('patientId', '==', patientId)))
  return snap.docs.map((d) => mapAppointment(d.id, d.data())).sort(byDateTime)
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  await updateDoc(doc(getDb(), 'appointments', id), { status, ...touch() })
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

function mapSettings(data: DocumentData | undefined): ClinicSettings {
  const fee = Number(data?.['newPatientFee'])
  return {
    newPatientFee: Number.isFinite(fee) && fee >= 0 ? Math.round(fee) : DEFAULT_SETTINGS.newPatientFee,
    discountPresets: numberList(data?.['discountPresets'], DEFAULT_SETTINGS.discountPresets),
    expenseCategories: textList(data?.['expenseCategories'], DEFAULT_SETTINGS.expenseCategories),
  }
}

export async function getClinicSettings() {
  const snap = await getDoc(doc(getDb(), 'settings', 'clinic'))
  return mapSettings(snap.exists() ? snap.data() : undefined)
}

export async function saveClinicSettings(input: ClinicSettings) {
  if (!Number.isFinite(input.newPatientFee) || input.newPatientFee < 0) throw new Error('سعر الكشف غير صحيح')
  const clean = mapSettings({ ...input })
  if (!clean.discountPresets.includes(0)) clean.discountPresets.unshift(0)
  await setDoc(doc(getDb(), 'settings', 'clinic'), { ...clean, ...touch() }, { merge: true })
}
