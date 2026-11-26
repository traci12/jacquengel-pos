import { useEffect, useState } from 'react'
import { applyActionCode, confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth'
import { auth } from '../firebase'
import { Button, Field, Input } from '../components/ui'

// Handles links from Firebase emails (password reset, email verification).
// Firebase → Authentication → Templates → "Customize action URL" points here:
//   https://jacquengel-pos.web.app/auth/action

const errorText = (e) => {
  const code = e?.code || ''
  if (code.includes('expired-action-code')) return 'This link has expired. Request a new one from the sign-in screen.'
  if (code.includes('invalid-action-code'))
    return 'This link is invalid or has already been used. Request a new one from the sign-in screen.'
  if (code.includes('weak-password')) return 'Password must be at least 6 characters.'
  if (code.includes('network')) return 'No internet connection. Please try again.'
  return e?.message || 'Something went wrong.'
}

const goHome = () => window.location.replace('/')

export default function AuthAction() {
  const params = new URLSearchParams(window.location.search)
  const mode = params.get('mode')
  const code = params.get('oobCode')

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-gradient-to-b from-brand-700 to-brand-900 px-5 py-10">
      <img src="/logo-512.png" alt="JacqueNgel" className="mb-6 h-28 w-28 drop-shadow-xl" />
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        {mode === 'resetPassword' && code ? (
          <ResetPassword code={code} />
        ) : mode === 'verifyEmail' && code ? (
          <VerifyEmail code={code} />
        ) : (
          <Message title="Link not recognized" text="Open the newest link from your email, or go back to sign in." />
        )}
      </div>
    </div>
  )
}

function Message({ title, text, ok }) {
  return (
    <div className="space-y-4 text-center">
      <h2 className={`font-display text-2xl font-bold ${ok ? 'text-emerald-700' : 'text-brand-900'}`}>{title}</h2>
      <p className="text-brand-900/70">{text}</p>
      <Button size="lg" className="w-full" onClick={goHome}>
        Go to sign in
      </Button>
    </div>
  )
}

function ResetPassword({ code }) {
  const [email, setEmail] = useState(null)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    verifyPasswordResetCode(auth, code)
      .then(setEmail)
      .catch((e) => setError(errorText(e)))
  }, [code])

  if (done) return <Message ok title="Password changed" text="You can now sign in with your new password." />
  if (error && !email) return <Message title="Can’t reset password" text={error} />
  if (!email) return <p className="py-8 text-center text-brand-900/60">Checking link…</p>

  const submit = async (e) => {
    e.preventDefault()
    if (password !== confirm) return setError('The two passwords don’t match.')
    setBusy(true)
    setError('')
    try {
      await confirmPasswordReset(auth, code, password)
      setDone(true)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-bold text-brand-900">Set a new password</h2>
        <p className="text-sm text-brand-900/60">for {email}</p>
      </div>
      <Field label="New password" hint="At least 6 characters">
        <Input
          type="password"
          autoComplete="new-password"
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
        />
      </Field>
      <Field label="Type it again">
        <Input
          type="password"
          autoComplete="new-password"
          minLength={6}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </Field>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? 'Saving…' : 'Save new password'}
      </Button>
    </form>
  )
}

function VerifyEmail({ code }) {
  const [state, setState] = useState({ status: 'working' })
  useEffect(() => {
    applyActionCode(auth, code)
      .then(() => setState({ status: 'ok' }))
      .catch((e) => setState({ status: 'error', error: errorText(e) }))
  }, [code])
  if (state.status === 'working') return <p className="py-8 text-center text-brand-900/60">Verifying…</p>
  if (state.status === 'ok') return <Message ok title="Email verified" text="Thanks! You can now sign in." />
  return <Message title="Can’t verify email" text={state.error} />
}
