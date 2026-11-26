import { useState } from 'react'
import {
  TotpMultiFactorGenerator,
  createUserWithEmailAndPassword,
  getMultiFactorResolver,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { useLive } from '../lib/data'
import { Button, Field, Input, useToast } from '../components/ui'
import { CodeInput } from './TwoStep'

const authError = (e) => {
  const code = e?.code || ''
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found'))
    return 'Wrong email or password.'
  if (code.includes('email-already-in-use')) return 'That email already has an account.'
  if (code.includes('weak-password')) return 'Password must be at least 6 characters.'
  if (code.includes('invalid-email')) return 'Please enter a valid email.'
  if (code.includes('too-many-requests')) return 'Too many attempts. Please wait a bit and try again.'
  if (code.includes('network')) return 'No internet connection. Sign-in needs a connection the first time.'
  return e?.message || 'Something went wrong.'
}

export default function Login() {
  const setup = useLive(doc(db, 'meta', 'setup'), [])
  const needsSetup = !setup.loading && !setup.data?.done && !setup.error

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-brand-50 px-5 py-10">
      <img src="/logo-512.png" alt="JacqueNgel" className="mb-6 h-32 w-32 drop-" />
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 ring-1 ring-brand-200/70">
        {setup.loading ? (
          <p className="py-8 text-center text-brand-900/60">Loading…</p>
        ) : needsSetup ? (
          <SetupForm />
        ) : (
          <SignInForm />
        )}
      </div>
      <p className="mt-6 text-xs text-brand-900/40">JacqueNgel POS for sari-sari stores</p>
    </div>
  )
}

function SignInForm() {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [resolver, setResolver] = useState(null)
  const [code, setCode] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (err) {
      if (err?.code === 'auth/multi-factor-auth-required') {
        setResolver(getMultiFactorResolver(auth, err))
        setCode('')
      } else setError(authError(err))
    } finally {
      setBusy(false)
    }
  }

  const submitCode = async (e) => {
    e.preventDefault()
    const hint = resolver.hints.find((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID)
    if (!hint) return setError('This account has no authenticator app set up.')
    setBusy(true)
    setError('')
    try {
      await resolver.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code))
    } catch (err) {
      const c = err?.code || ''
      setError(
        c.includes('invalid-verification-code')
          ? 'That code is wrong or expired. Check the app and try again.'
          : c.includes('session-expired') || c.includes('code-expired')
            ? 'This took too long. Go back and sign in again.'
            : authError(err),
      )
    } finally {
      setBusy(false)
    }
  }

  if (resolver) {
    return (
      <form onSubmit={submitCode} className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Enter your code</h2>
          <p className="text-sm text-brand-900/60">
            Open your authenticator app and type the 6-digit code for JacqueNgel POS.
          </p>
        </div>
        <CodeInput value={code} onChange={setCode} autoFocus />
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={busy || code.length !== 6}>
          {busy ? 'Checking…' : 'Sign in'}
        </Button>
        <button
          type="button"
          onClick={() => {
            setResolver(null)
            setError('')
          }}
          className="w-full text-center text-sm font-medium text-brand-600"
        >
          Back
        </button>
      </form>
    )
  }

  const reset = async () => {
    if (!email.trim()) return setError('Type your email first, then tap “Forgot password”.')
    try {
      await sendPasswordResetEmail(auth, email.trim())
      toast('Password reset email sent. Check your inbox.')
    } catch (err) {
      setError(authError(err))
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-brand-900">Welcome back</h2>
        <p className="text-sm text-brand-900/60">Sign in to start selling.</p>
      </div>
      <Field label="Email">
        <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label="Password">
        <Input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </Field>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </Button>
      <button type="button" onClick={reset} className="w-full text-center text-sm font-medium text-brand-600">
        Forgot password?
      </button>
    </form>
  )
}

function SetupForm() {
  const [f, setF] = useState({ store: 'JacqueNgel Sari-Sari Store', name: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const cred = await createUserWithEmailAndPassword(auth, f.email.trim(), f.password)
      const uid = cred.user.uid
      await updateProfile(cred.user, { displayName: f.name.trim() })
      const batch = writeBatch(db)
      batch.set(doc(db, 'meta', 'setup'), { done: true, ownerUid: uid, createdAt: serverTimestamp() })
      batch.set(doc(db, 'users', uid), {
        name: f.name.trim(),
        email: f.email.trim().toLowerCase(),
        role: 'owner',
        active: true,
        createdAt: serverTimestamp(),
      })
      batch.set(doc(db, 'settings', 'store'), {
        name: f.store.trim(),
        lowStockDefault: 5,
        updatedAt: serverTimestamp(),
      })
      await batch.commit()
    } catch (err) {
      console.error(err)
      if (auth.currentUser && err?.code === 'permission-denied') {
        await signOut(auth)
        setError('This store has already been set up. Please sign in instead.')
      } else {
        setError(authError(err))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-brand-900">Set up your store</h2>
        <p className="text-sm text-brand-900/60">
          One-time setup. This creates the <b>owner</b> account. You can add cashiers later in Settings.
        </p>
      </div>
      <Field label="Store name">
        <Input value={f.store} onChange={set('store')} required />
      </Field>
      <Field label="Your name">
        <Input value={f.name} onChange={set('name')} autoComplete="name" required />
      </Field>
      <Field label="Email">
        <Input type="email" value={f.email} onChange={set('email')} autoComplete="email" required />
      </Field>
      <Field label="Password" hint="At least 6 characters">
        <Input
          type="password"
          value={f.password}
          onChange={set('password')}
          autoComplete="new-password"
          minLength={6}
          required
        />
      </Field>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? 'Setting up…' : 'Create store & owner account'}
      </Button>
    </form>
  )
}
