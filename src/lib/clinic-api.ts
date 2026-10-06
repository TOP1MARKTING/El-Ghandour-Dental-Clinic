import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getAggregateFromServer,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
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
import { dayKey, formatArabicDate, formatArabicDateTime, formatClock, relativeDayLabel } from '@/lib/format'
import { applyDiscount, clampPercent, DEFAULT_SETTINGS, NEW_PATIENT_FEE_NAME } from '@/lib/pricing'
import { toDoctorId, type DoctorId } from '@/lib/doctors'
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
}) {
  const now = Date.now()
  const registeredAt = formatArabicDate()
  const ref = await addDoc(collection(getDb(), 'patients'), {
    name: input.name.trim(),
    phone: input.phone.trim(),
    doctor: toDoctorId(input.doctor),
    age: input.age ?? 0,
    address: input.address?.trim() ?? '',
    problem: input.problem?.trim() ?? '',
    notes: input.notes?.trim() ?? '',
    registeredAt,
    lastVisit: '',
    total: 0,
    paid: 0,
    createdAtMs: now,
    createdAt: serverTimestamp(),
    ...stamp(),
  })
  return ref.id
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
      paymentDoc({
        patientId: input.patientId,
        patientName: input.patientName,
        amount: paid,
        kind: treatment === NEW_PATIENT_FEE_NAME ? 'كشف' : 'علاج',
        now: input.now,
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
  method?: string
  note?: string
}) {
  return {
    patientId: input.patientId,
    patient: input.patientName,
    amount: input.amount,
    date: formatArabicDateTime(new Date(input.now)),
    method: input.method ?? 'نقدي',
    note: input.note?.trim() ?? '',
    kind: input.kind,
    createdAtMs: input.now,
    createdAt: serverTimestamp(),
    ...stamp(),
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
}) {
  const db = getDb()
  let remaining = 0
  let paidAmount = 0

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
        now: Date.now(),
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

/** الباقي عند المرضى كلهم — مجموع من السيرفر من غير ما نقرا كل المرضى */
export async function getOutstandingTotal() {
  const snap = await getAggregateFromServer(collection(getDb(), 'patients'), {
    total: sum('total'),
    paid: sum('paid'),
  })
  const { total, paid } = snap.data()
  return Math.max(0, (total ?? 0) - (paid ?? 0))
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
    ...stamp(),
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
  /** سعر الكشف من إعدادات العيادة */
  feePrice: number
  /** دفع الكشف ولا اتسجل عليه */
  feePaid?: boolean
  /** لو اتحدد سعر عند الحجز بيتسجل العلاج والدفعة على طول */
  charge?: ChargeInput
  doctor: DoctorId
}) {
  const db = getDb()
  const name = input.name.trim()
  const phone = input.phone.trim()
  const reason = input.reason?.trim() || 'كشف جديد'
  const doctor = toDoctorId(input.doctor)
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
      doctor,
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
  /** دفعة من الحساب القديم — بتتسجل مع الحضور في نفس الحفظة */
  oldPayment?: number
  /** هيدخل لمين النهاردة — لو مش متحدد يبقى دكتوره المتابع */
  doctor?: DoctorId
}) {
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
  if (oldPayment > Math.max(0, patient.total - patient.paid)) throw new Error('المدفوع من القديم أكبر من اللي عليه')

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
      doctor: input.doctor ? toDoctorId(input.doctor) : patient.doctor,
      order: state.order,
      key: state.key,
      now,
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
        note: 'من الحساب القديم',
        now: now + 2,
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
    doctor: toDoctorId(data['doctor']),
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
}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('اختار تاريخ الموعد')
  if (input.date < dayKey()) throw new Error('التاريخ ده عدى — اختار يوم جاي')
  const patient = await getPatient(input.patientId)
  if (!patient) throw new Error('المريض غير موجود')
  await addDoc(collection(getDb(), 'appointments'), {
    patientId: patient.id,
    patientName: patient.name,
    phone: patient.phone,
    doctor: input.doctor ? toDoctorId(input.doctor) : patient.doctor,
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
export async function listUpcomingAppointments(fromKey = dayKey()) {
  const snap = await getDocs(query(collection(getDb(), 'appointments'), where('date', '>=', fromKey)))
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
