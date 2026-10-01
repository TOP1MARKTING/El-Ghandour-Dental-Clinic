import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

const config = {
  apiKey: 'AIzaSyAlXwZ30nvXiL0k6gTc-dH-PgvdCnf1tyU',
  authDomain: 'dentalclinic-53349.firebaseapp.com',
  projectId: 'dentalclinic-53349',
  storageBucket: 'dentalclinic-53349.firebasestorage.app',
  messagingSenderId: '657607084167',
  appId: '1:657607084167:web:2191429cda9a2dbfc19022',
}

let app: FirebaseApp | undefined
let auth: Auth | undefined
let db: Firestore | undefined

export const CLIENT_ONLY_ERROR = 'Backend is client-only'

function getClientApp() {
  if (typeof window === 'undefined') {
    throw new Error(CLIENT_ONLY_ERROR)
  }
  if (!app) {
    app = getApps().length ? getApps()[0]! : initializeApp(config)
  }
  return app
}

export function getAuthClient() {
  if (!auth) auth = getAuth(getClientApp())
  return auth
}

export function getDb() {
  if (!db) db = getFirestore(getClientApp())
  return db
}
