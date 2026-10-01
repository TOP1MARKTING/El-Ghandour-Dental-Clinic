const SESSION_KEY = 'alghandour-clinic-session'

export type ClinicSession = {
  email: string
  name: string
  role: 'doctor' | 'reception'
}

function displayNameFromEmail(email: string) {
  const local = email.split('@')[0]?.trim() ?? ''
  if (/reception|استقبال|موظف/i.test(email)) return 'الاستقبال'
  if (!local) return 'د. أشرف الغندور'
  return local.includes('doctor') || local.includes('ghandour') || local.includes('الغندور')
    ? 'د. أشرف الغندور'
    : local
}

export function getSession(): ClinicSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ClinicSession
    if (!parsed?.email) return null
    return parsed
  } catch {
    return null
  }
}

export function createSession(email: string): ClinicSession {
  const session: ClinicSession = {
    email,
    name: displayNameFromEmail(email),
    role: /reception|استقبال/i.test(email) ? 'reception' : 'doctor',
  }
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export function clearSession() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(SESSION_KEY)
}

export function roleLabel(role: ClinicSession['role']) {
  return role === 'reception' ? 'الاستقبال' : 'طبيب العيادة'
}
