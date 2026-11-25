import { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { collection, doc, orderBy, query } from 'firebase/firestore'
import { auth, db } from './firebase'
import { SessionContext, useLive } from './lib/data'
import { Button, Icon, cx } from './components/ui'
import Login from './pages/Login'
import Sell from './pages/Sell'
import Inventory from './pages/Inventory'
import Utang from './pages/Utang'
import Reports from './pages/Reports'
import Settings from './pages/Settings'

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

function Splash({ children }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <img src="/logo-192.png" alt="" className="h-24 w-24 animate-pulse" />
      {children}
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(undefined)
  useEffect(() => onAuthStateChanged(auth, setUser), [])

  if (user === undefined) return <Splash />
  if (!user) return <Login />
  return <SignedIn user={user} />
}

function SignedIn({ user }) {
  const profileQ = useLive(doc(db, 'users', user.uid), [user.uid])
  const profile = profileQ.data
  const active = profile?.active === true

  if (profileQ.loading && profile === undefined) return <Splash />
  if (!active) {
    return (
      <Splash>
        <p className="max-w-xs text-brand-900/80">
          {profile
            ? 'This account has been deactivated. Ask the store owner to turn it back on.'
            : 'This account is not linked to the store yet. Ask the store owner to add you as staff.'}
        </p>
        <Button variant="outline" onClick={() => signOut(auth)}>
          <Icon name="logout" /> Sign out
        </Button>
      </Splash>
    )
  }
  return <Shell user={user} profile={profile} />
}

function Shell({ user, profile }) {
  const isOwner = profile.role === 'owner'
  const online = useOnline()
  const store = useLive(doc(db, 'settings', 'store'), []).data
  const products = useLive(query(collection(db, 'products'), orderBy('name')), [])

  const tabs = useMemo(
    () =>
      [
        { id: 'sell', label: 'Sell', icon: 'cart' },
        { id: 'inventory', label: 'Inventory', icon: 'box' },
        { id: 'utang', label: 'Utang', icon: 'wallet' },
        isOwner && { id: 'reports', label: 'Reports', icon: 'chart' },
        { id: 'settings', label: isOwner ? 'Settings' : 'Account', icon: 'cog' },
      ].filter(Boolean),
    [isOwner],
  )
  const [tab, setTab] = useState(() => {
    const saved = sessionStorage.getItem('tab')
    return tabs.some((t) => t.id === saved) ? saved : 'sell'
  })
  useEffect(() => sessionStorage.setItem('tab', tab), [tab])

  const session = { user, profile, isOwner, store: store || {} }
  const storeName = store?.name || 'JacqueNgel'

  return (
    <SessionContext.Provider value={session}>
      <div className="mx-auto flex min-h-full max-w-3xl flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 bg-brand-700 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] text-white shadow-md">
          <img src="/logo-192.png" alt="" className="h-9 w-9 rounded-full bg-white/10" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg font-bold leading-tight">{storeName}</h1>
            <p className="truncate text-xs text-brand-200">
              {profile.name} · {isOwner ? 'Owner' : 'Cashier'}
            </p>
          </div>
          {!online && (
            <span className="flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-xs font-bold text-amber-950">
              <Icon name="wifiOff" size={14} /> Offline
            </span>
          )}
        </header>

        <main className="flex-1 pb-24">
          {tab === 'sell' && <Sell products={products} />}
          {tab === 'inventory' && <Inventory products={products} />}
          {tab === 'utang' && <Utang />}
          {tab === 'reports' && isOwner && <Reports products={products.data || []} />}
          {tab === 'settings' && <Settings />}
        </main>

        <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-brand-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cx(
                  'flex flex-1 flex-col items-center gap-0.5 pt-2 text-[11px] font-semibold',
                  tab === t.id ? 'text-brand-700' : 'text-brand-900/40',
                )}
              >
                <span className={cx('rounded-full px-4 py-1', tab === t.id && 'bg-brand-100')}>
                  <Icon name={t.icon} size={22} />
                </span>
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </SessionContext.Provider>
  )
}
