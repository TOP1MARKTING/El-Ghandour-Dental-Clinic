import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  createExpense,
  createPatient,
  createPayment,
  createService,
  createVisit,
  checkInFollowupPatient,
  checkInNewPatient,
  createAppointment,
  deleteExpense,
  deletePatient,
  deleteService,
  getPatient,
  getOutstandingTotal,
  getPaymentsTotal,
  listFinanceSince,
  listPatientAppointments,
  listPatients,
  listPayments,
  listPaymentsForPatient,
  listUpcomingAppointments,
  listServices,
  listTodayQueue,
  listVisitsForPatient,
  subscribeTodayQueue,
  updateAppointmentStatus,
  updateServicePrice,
  getClinicSettings,
  saveClinicSettings,
} from '@/lib/clinic-api'
import { useAuth } from '@/lib/auth-context'
import { addDays, dayKey, startOfDay } from '@/lib/format'
import { DEFAULT_SETTINGS } from '@/lib/pricing'
import type { AppointmentStatus, QueueEntry } from '@/types'

/** مفتاح النهاردة — بيتغير لوحده بعد نص الليل لو الصفحة فاضلة مفتوحة */
export function useTodayKey() {
  const [key, setKey] = useState(() => dayKey())
  useEffect(() => {
    const msToMidnight = addDays(startOfDay(), 1).getTime() - Date.now() + 1000
    const timer = setTimeout(() => setKey(dayKey()), msToMidnight)
    return () => clearTimeout(timer)
  }, [key])
  return key
}

function useClinicReady() {
  const { user, loading } = useAuth()
  return !loading && Boolean(user) && typeof window !== 'undefined'
}

export function useIsAdmin() {
  const { user } = useAuth()
  return user?.role === 'admin'
}

export function useServices() {
  const ready = useClinicReady()
  const query = useQuery({
    queryKey: ['services'],
    queryFn: listServices,
    enabled: ready,
    retry: 1,
    staleTime: 60_000,
  })
  return { ...query, isLoading: !ready || query.isLoading }
}

export function useCreateService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createService,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['services'] })
    },
  })
}

export function useUpdateServicePrice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, price }: { id: string; price: number }) => updateServicePrice(id, price),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['services'] })
    },
  })
}

export function useDeleteService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteService,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['services'] })
    },
  })
}

export function useFinance(sinceMs: number, untilMs?: number) {
  const ready = useClinicReady()
  const admin = useIsAdmin()
  const query = useQuery({
    queryKey: ['finance', sinceMs, untilMs ?? null],
    queryFn: () => listFinanceSince(sinceMs, untilMs),
    enabled: ready && admin,
    retry: 1,
  })
  return { ...query, isLoading: !ready || query.isLoading }
}

export function useCreateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createExpense,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['finance'] })
    },
  })
}

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteExpense,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['finance'] })
    },
  })
}

export function usePatients() {
  const ready = useClinicReady()
  const query = useQuery({
    queryKey: ['patients'],
    queryFn: listPatients,
    enabled: ready,
    retry: 1,
  })
  return { ...query, isLoading: !ready || query.isLoading }
}

export function usePatient(id: string) {
  const ready = useClinicReady()
  const query = useQuery({
    queryKey: ['patients', id],
    queryFn: () => getPatient(id),
    enabled: ready && Boolean(id),
    retry: 1,
  })
  return { ...query, isLoading: !ready || query.isLoading }
}

export function usePatientVisits(patientId: string) {
  const ready = useClinicReady()
  const query = useQuery({
    queryKey: ['visits', patientId],
    queryFn: () => listVisitsForPatient(patientId),
    enabled: ready && Boolean(patientId),
    retry: 1,
  })
  return { ...query, isLoading: !ready || query.isLoading }
}

/** sinceMs: من أول الفترة — من غيره بيجيب كل الدفعات */
export function usePayments(sinceMs?: number, enabled = true) {
  const ready = useClinicReady()
  const admin = useIsAdmin()
  const query = useQuery({
    queryKey: ['payments', 'list', sinceMs ?? 'all'],
    queryFn: () => listPayments(sinceMs),
    enabled: ready && admin && enabled,
    retry: 1,
  })
  return { ...query, isLoading: !ready || query.isLoading }
}

/** مجموع كل الدفعات من أول ما العيادة اشتغلت — رقم واحد من السيرفر */
export function usePaymentsTotal() {
  const ready = useClinicReady()
  const admin = useIsAdmin()
  const query = useQuery({
    queryKey: ['payments', 'list', 'total'],
    queryFn: getPaymentsTotal,
    enabled: ready && admin,
    retry: 1,
  })
  return { ...query, isLoading: !ready || query.isLoading }
}

/** الباقي عند المرضى كلهم — رقم واحد من السيرفر من غير ما نقرا كل المرضى */
export function useOutstandingTotal() {
  const ready = useClinicReady()
  const admin = useIsAdmin()
  const query = useQuery({
    queryKey: ['patients', 'outstanding'],
    queryFn: getOutstandingTotal,
    enabled: ready && admin,
    retry: 1,
  })
  return { ...query, isLoading: !ready || query.isLoading }
}

export function useCreatePatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createPatient,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['patients'] })
    },
  })
}

export function useDeletePatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deletePatient,
    onSuccess: async () => {
      await Promise.all(
        ['patients', 'payments', 'finance', 'visits', 'appointments'].map((key) =>
          qc.invalidateQueries({ queryKey: [key] }),
        ),
      )
    },
  })
}

/** تحديث بيانات المريض اللي اتعدّل بس — قايمة المرضى بتتعلّم قديمة وتتحمّل لما حد يفتحها */
function refreshClinicData(qc: QueryClient, patientId?: string) {
  if (patientId) {
    void qc.invalidateQueries({ queryKey: ['patients'], exact: true, refetchType: 'none' })
    void qc.invalidateQueries({ queryKey: ['patients', patientId] })
    void qc.invalidateQueries({ queryKey: ['visits', patientId] })
    void qc.invalidateQueries({ queryKey: ['payments', 'patient', patientId] })
    void qc.invalidateQueries({ queryKey: ['appointments', 'patient', patientId] })
  } else {
    void qc.invalidateQueries({ queryKey: ['patients'] })
  }
  void qc.invalidateQueries({ queryKey: ['patients', 'outstanding'] })
  void qc.invalidateQueries({ queryKey: ['payments', 'list'] })
  void qc.invalidateQueries({ queryKey: ['finance'] })
  void qc.invalidateQueries({ queryKey: ['appointments', 'upcoming'] })
}

export function useCreateVisit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createVisit,
    onSuccess: (_, input) => refreshClinicData(qc, input.patientId),
  })
}

export function useCreatePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createPayment,
    onSuccess: (_, input) => refreshClinicData(qc, input.patientId),
  })
}

/** اشتراك لايف واحد لدور النهاردة مهما كان عدد الصفحات اللي بتعرضه — بيفضل شغال دقيقة بعد آخر صفحة */
const queueLive = {
  key: '',
  unsub: undefined as (() => void) | undefined,
  users: new Set<(err: Error | null) => void>(),
  stopTimer: undefined as ReturnType<typeof setTimeout> | undefined,
}

function watchTodayQueue(qc: QueryClient, key: string, onStatus: (err: Error | null) => void) {
  clearTimeout(queueLive.stopTimer)
  if (queueLive.key !== key || !queueLive.unsub) {
    queueLive.unsub?.()
    queueLive.key = key
    queueLive.unsub = subscribeTodayQueue(
      key,
      (queue: QueueEntry[]) => {
        qc.setQueryData(['queue', 'today', key], queue)
        queueLive.users.forEach((notify) => notify(null))
      },
      (err) => {
        queueLive.unsub = undefined
        queueLive.users.forEach((notify) => notify(err))
      },
    )
  }
  queueLive.users.add(onStatus)
  return () => {
    queueLive.users.delete(onStatus)
    if (queueLive.users.size > 0) return
    queueLive.stopTimer = setTimeout(() => {
      queueLive.unsub?.()
      queueLive.unsub = undefined
    }, 60_000)
  }
}

export function useTodayQueue() {
  const ready = useClinicReady()
  const qc = useQueryClient()
  const key = useTodayKey()
  const [liveError, setLiveError] = useState<Error | null>(null)
  const [attempt, setAttempt] = useState(0)
  const query = useQuery({
    queryKey: ['queue', 'today', key],
    queryFn: () => listTodayQueue(key),
    enabled: ready,
    retry: 1,
    staleTime: Infinity,
  })

  useEffect(() => {
    if (!ready) return
    setLiveError(null)
    return watchTodayQueue(qc, key, setLiveError)
  }, [ready, qc, key, attempt])

  const error = query.error ?? liveError
  return {
    ...query,
    error,
    isError: Boolean(error),
    isLoading: !ready || query.isLoading,
    refetch: () => {
      setAttempt((n) => n + 1)
      return query.refetch()
    },
  }
}

export function useCheckInNew() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: checkInNewPatient,
    onSuccess: (result) => refreshClinicData(qc, result.patientId),
  })
}

export function useCheckInFollowup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: checkInFollowupPatient,
    onSuccess: (_, input) => refreshClinicData(qc, input.patientId),
  })
}

export function usePatientPayments(patientId: string) {
  const ready = useClinicReady()
  const query = useQuery({
    queryKey: ['payments', 'patient', patientId],
    queryFn: () => listPaymentsForPatient(patientId),
    enabled: ready && Boolean(patientId),
    retry: 1,
  })
  return { ...query, isLoading: !ready || query.isLoading }
}

export function useUpcomingAppointments() {
  const ready = useClinicReady()
  const key = useTodayKey()
  const query = useQuery({
    queryKey: ['appointments', 'upcoming', key],
    queryFn: () => listUpcomingAppointments(key),
    enabled: ready,
    retry: 1,
    staleTime: 60_000,
  })
  return { ...query, isLoading: !ready || query.isLoading }
}

export function usePatientAppointments(patientId: string) {
  const ready = useClinicReady()
  const query = useQuery({
    queryKey: ['appointments', 'patient', patientId],
    queryFn: () => listPatientAppointments(patientId),
    enabled: ready && Boolean(patientId),
    retry: 1,
  })
  return { ...query, isLoading: !ready || query.isLoading }
}

export function useCreateAppointment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createAppointment,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['appointments'] })
    },
  })
}

export function useUpdateAppointmentStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) => updateAppointmentStatus(id, status),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['appointments'] })
    },
  })
}

/** إعدادات العيادة — لحد ما تتحمّل بترجع القيم الافتراضية */
export function useClinicSettings() {
  const ready = useClinicReady()
  const query = useQuery({
    queryKey: ['settings'],
    queryFn: getClinicSettings,
    enabled: ready,
    retry: 1,
    staleTime: 5 * 60_000,
  })
  return { ...query, settings: query.data ?? DEFAULT_SETTINGS, isLoading: !ready || query.isLoading }
}

export function useSaveClinicSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: saveClinicSettings,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['settings'] })
    },
  })
}
