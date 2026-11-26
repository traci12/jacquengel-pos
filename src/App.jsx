import { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { collection, doc, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import { SessionContext, useLive } from './lib/data'
import { Button, Icon, cx } from './components/ui'
import Login from './pages/Login'
import { TwoStepGate, usedSecondFactor } from './pages/TwoStep'
import AuthAction from './pages/AuthAction'
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
      <img src="/logo-192.png" alt="" className="h-20 w-20 animate-pulse" />
      {children}
    </div>
  )
}

export default function App() {
  const qs = new URLSearchParams(window.location.search)
  if (window.location.pathname.startsWith('/auth/action') || (qs.get('mode') && qs.get('oobCode'))) return <AuthAction />
  return <Main />
}

function Main() {
  const [user, setUser] = useState(undefined)
  useEffect(() => onAuthStateChanged(auth, setUser), [])

  if (user === undefined) return <Splash />
  if (!user) return <Login />
  return <SecurityGate user={user} />
}

/** When the owner requires 2-step verification, sessions without it stop here. */
function SecurityGate({ user }) {
  const security = useLive(doc(db, 'meta', 'security'), [])
  const [second, setSecond] = useState(null)
  useEffect(() => {
    let live = true
    usedSecondFactor(user).then((v) => live && setSecond(v))
    return () => {
      live = false
    }
  }, [user])
  const required = security.data?.require2fa === true
  if (security.loading && security.data === undefined) return <Splash />
  if (required && second === null) return <Splash />
  if (required && !second) return <TwoStepGate user={user} />
  return <SignedIn user={user} />
}

function SignedIn({ user }) {
  const profileQ = useLive(doc(db, 'users', user.uid), [user.uid])
  const profile = profileQ.data
  const active = profile?.active === true

  if (profileQ.loading && profile === undefined) return <Splash />
  if (!active) return <NoAccess user={user} profile={profile} />
  return <Shell user={user} profile={profile} />
}

function NoAccess({ user, profile }) {
  const [busy, setBusy] = useState(false)
  const request = async () => {
    setBusy(true)
    try {
      await setDoc(doc(db, 'users', user.uid), {
        name: user.displayName || user.email.split('@')[0],
        email: user.email.toLowerCase(),
        role: 'cashier',
        active: false,
        requested: true,
        createdAt: serverTimestamp(),
      })
    } catch (e) {
      console.error(e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Splash>
      <p className="max-w-xs text-brand-900/80">
        {profile?.requested
          ? `Request sent. Ask the store owner to open Settings → Staff and tap “Activate” next to ${user.email}.`
          : profile
            ? 'This account has been deactivated. Ask the store owner to turn it back on.'
            : `${user.email} is not linked to the store yet.`}
      </p>
      {!profile && (
        <Button onClick={request} disabled={busy}>
          Request access
        </Button>
      )}
      <Button variant="outline" onClick={() => signOut(auth)}>
        <Icon name="logout" /> Sign out
      </Button>
    </Splash>
  )
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
      <div className="mx-auto flex min-h-full max-w-3xl flex-col lg:max-w-none lg:pl-[92px]">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-brand-200/70 bg-white/90 px-4 pb-2.5 pt-[max(env(safe-area-inset-top),0.625rem)] backdrop-blur">
          <img src="/logo-192.png" alt="" className="h-9 w-9 lg:hidden" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-semibold leading-tight tracking-tight">{storeName}</h1>
            <p className="truncate text-xs text-brand-900/50">
              {profile.name}, {isOwner ? 'owner' : 'cashier'}
            </p>
          </div>
          {!online && (
            <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
              <Icon name="wifiOff" size={14} /> Offline
            </span>
          )}
        </header>

        <main className="flex-1 pb-24 lg:pb-6">
          {tab === 'sell' && <Sell products={products} />}
          {tab === 'inventory' && <Inventory products={products} />}
          {tab === 'utang' && <Utang />}
          {tab === 'reports' && isOwner && <Reports products={products.data || []} />}
          {tab === 'settings' && <Settings />}
        </main>

        <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-brand-200/70 bg-white/95 backdrop-blur lg:inset-x-auto lg:left-0 lg:top-0 lg:w-[92px] lg:border-r lg:border-t-0 lg:pb-0 lg:pt-[max(env(safe-area-inset-top),0.75rem)]">
          <div className="mx-auto flex max-w-3xl lg:flex-col lg:gap-1">
            <img src="/logo-192.png" alt="" className="mx-auto mb-3 hidden h-11 w-11 lg:block" />
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? 'page' : undefined}
                className={cx(
                  'flex flex-1 flex-col items-center gap-0.5 pt-2 text-[11px] font-medium lg:flex-none lg:py-2 lg:text-xs',
                  tab === t.id ? 'text-brand-700' : 'text-brand-900/45',
                )}
              >
                <span className={cx('rounded-full px-4 py-1 transition-colors', tab === t.id && 'bg-tint-100')}>
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
