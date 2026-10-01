import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyAlXwZ30nvXiL0k6gTc-dH-PgvdCnf1tyU',
  authDomain: 'dentalclinic-53349.firebaseapp.com',
  projectId: 'dentalclinic-53349',
  storageBucket: 'dentalclinic-53349.firebasestorage.app',
  messagingSenderId: '657607084167',
  appId: '1:657607084167:web:2191429cda9a2dbfc19022',
  measurementId: 'G-YMYLEGSK4H',
}

let app: FirebaseApp | undefined
let auth: Auth | undefined
let db: Firestore | undefined

export function getFirebaseApp() {
  if (typeof window === 'undefined') {
    throw new Error('Firebase is client-only')
  }
  if (!app) {
    app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig)
  }
  return app
}

export function getFirebaseAuth() {
  if (!auth) auth = getAuth(getFirebaseApp())
  return auth
}

export function getDb() {
  if (!db) db = getFirestore(getFirebaseApp())
  return db
}
export async function initAnalytics() {
  if (typeof window === 'undefined') return
  try {
    const { getAnalytics, isSupported } = await import('firebase/analytics')
    if (await isSupported()) getAnalytics(getFirebaseApp())
  } catch {
    // analytics optional
  }
}
