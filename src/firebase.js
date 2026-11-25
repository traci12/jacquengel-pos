import { initializeApp } from 'firebase/app'
import { getAuth, initializeAuth, inMemoryPersistence } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

// Firebase web config is safe to ship in the browser; access is controlled by
// Firestore security rules (see firestore.rules).
export const firebaseConfig = {
  apiKey: 'AIzaSyAbK6VH-E6aDwi9l_9h9gn0D_mybrz64Uo',
  authDomain: 'jacquengel-pos.firebaseapp.com',
  projectId: 'jacquengel-pos',
  storageBucket: 'jacquengel-pos.firebasestorage.app',
  messagingSenderId: '754512781240',
  appId: '1:754512781240:web:7063c8197eaf5569cb794d',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

// Offline-first: data is cached on the phone, and sales made without signal
// are queued and synced automatically when the connection comes back.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

// A second, throwaway auth instance lets the owner create cashier accounts
// without being signed out of their own session.
let secondaryAuth
export function getSecondaryAuth() {
  if (!secondaryAuth) {
    const secondary = initializeApp(firebaseConfig, 'staff-creator')
    secondaryAuth = initializeAuth(secondary, { persistence: inMemoryPersistence })
  }
  return secondaryAuth
}
