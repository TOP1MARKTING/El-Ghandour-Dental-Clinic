import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { getAuthClient } from '@/lib/backend'
import { setActorName } from '@/lib/clinic-api'
import type { StaffRole } from '@/types'

export type ClinicUser = {
  uid: string
  email: string
  name: string
  role: StaffRole
}

type AuthContextValue = {
  user: ClinicUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** حساب الدكتور — أي حساب تاني بيبقى استقبال */
const ADMIN_EMAIL = 'admin@elghandour.com'
const HELPER_EMAIL = 'helper@elghandour.com'

function toClinicUser(user: User): ClinicUser {
  const email = (user.email ?? '').trim().toLowerCase()
  if (email === ADMIN_EMAIL) return { uid: user.uid, email, name: 'د. أشرف الغندور', role: 'admin' }
  const name =
    user.displayName?.trim() || (email === HELPER_EMAIL ? 'الاستقبال' : email.split('@')[0] || 'الاستقبال')
  return { uid: user.uid, email, name, role: 'helper' }
}

export function roleLabel(role: StaffRole) {
  return role === 'admin' ? 'أدمن العيادة' : 'مساعد الحجز'
}

/** بيانات قديمة اتسجل فيها الإيميل بدل الاسم */
export function actorLabel(by: string) {
  if (!by.includes('@')) return by
  return by.trim().toLowerCase() === ADMIN_EMAIL ? 'د. أشرف الغندور' : 'الاستقبال'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ClinicUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuthClient(), (authUser) => {
      const clinicUser = authUser ? toClinicUser(authUser) : null
      setActorName(clinicUser?.name ?? '')
      setUser(clinicUser)
      setLoading(false)
    })
    return unsub
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login: async (email, password) => {
        await signInWithEmailAndPassword(getAuthClient(), email.trim(), password)
      },
      logout: async () => {
        await signOut(getAuthClient())
      },
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
