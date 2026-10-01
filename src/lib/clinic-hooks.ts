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
  getQueueEntry,
  listFinanceSince,
  listPatientAppointments,
  listPatients,
  listPayments,
  listPaymentsForPatient,
  listUpcomingAppointments,
  listServices,
  listTodayQueue,
  listVisitsForPatient,
  settleQueueBilling,
  subscribeTodayQueue,
  updateAppointmentStatus,
  updateQueueStatus,
  updateServicePrice,
  getClinicSettings,
  saveClinicSettings,
} from '@/lib/clinic-api'
import { useAuth } from '@/lib/auth-context'
import { DEFAULT_SETTINGS } from '@/lib/pricing'
import type { AppointmentStatus, QueueStatus } from '@/types'

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

export function usePayments() {
  const ready = useClinicReady()
  const admin = useIsAdmin()
  const query = useQuery({
    queryKey: ['payments'],
    queryFn: listPayments,
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
      await qc.invalidateQueries({ queryKey: ['patients'] })
      await qc.invalidateQueries({ queryKey: ['payments'] })
      await qc.invalidateQueries({ queryKey: ['finance'] })
      await qc.invalidateQueries({ queryKey: ['visits'] })
    },
  })
}

/** تحديث القوايم في الخلفية — الحفظ نفسه ما يستناش إعادة التحميل */
function refreshClinicData(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ['patients'] })
  void qc.invalidateQueries({ queryKey: ['visits'] })
  void qc.invalidateQueries({ queryKey: ['payments'] })
  void qc.invalidateQueries({ queryKey: ['finance'] })
  // زيارات النهاردة متوصلة لايف من Firestore
  void qc.invalidateQueries({ queryKey: ['queue'], predicate: (q) => q.queryKey[1] !== 'today' })
}

export function useCreateVisit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createVisit,
    onSuccess: () => refreshClinicData(qc),
  })
}

export function useCreatePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createPayment,
    onSuccess: () => refreshClinicData(qc),
  })
}

export function useTodayQueue() {
  const ready = useClinicReady()
  const qc = useQueryClient()
  const [liveError, setLiveError] = useState<Error | null>(null)
  const [attempt, setAttempt] = useState(0)
  const query = useQuery({
    queryKey: ['queue', 'today'],
    queryFn: listTodayQueue,
    enabled: ready,
    retry: 1,
    staleTime: Infinity,
  })

  useEffect(() => {
    if (!ready) return
    setLiveError(null)
    return subscribeTodayQueue(
      (queue) => {
        setLiveError(null)
        qc.setQueryData(['queue', 'today'], queue)
      },
      setLiveError,
    )
  }, [ready, qc, attempt])

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
    onSuccess: () => refreshClinicData(qc),
  })
}

export function useCheckInFollowup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: checkInFollowupPatient,
    onSuccess: () => refreshClinicData(qc),
  })
}

export function useUpdateQueueStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: QueueStatus }) => updateQueueStatus(id, status),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['queue'] })
    },
  })
}

export function useQueueEntry(id: string) {
  const ready = useClinicReady()
  const query = useQuery({
    queryKey: ['queue', id],
    queryFn: () => getQueueEntry(id),
    enabled: ready && Boolean(id),
    retry: 1,
  })
  return { ...query, isLoading: !ready || query.isLoading }
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
  const query = useQuery({
    queryKey: ['appointments', 'upcoming'],
    queryFn: listUpcomingAppointments,
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

/** إعدادات العيادة من Firebase — لحد ما تتحمّل بترجع القيم الافتراضية */
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

export function useSettleQueueBilling() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: settleQueueBilling,
    onSuccess: () => refreshClinicData(qc),
  })
}
