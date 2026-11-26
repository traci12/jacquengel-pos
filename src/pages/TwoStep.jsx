import { useEffect, useState } from 'react'
import {
  EmailAuthProvider,
  TotpMultiFactorGenerator,
  multiFactor,
  reauthenticateWithCredential,
  reload,
  sendEmailVerification,
  signOut,
} from 'firebase/auth'
import QRCode from 'qrcode'
import { auth } from '../firebase'
import { Button, Field, Icon, Input } from '../components/ui'

// 2-step verification with an authenticator app (Google Authenticator,
// Microsoft Authenticator, …). Codes are checked by Firebase, not by the app.

const ISSUER = 'JacqueNgel POS'

export const isEnrolled = (user) => multiFactor(user).enrolledFactors.some((f) => f.factorId === 'totp')

/** True when this session was signed in with the authenticator code. */
export async function usedSecondFactor(user) {
  const r = await user.getIdTokenResult()
  return !!r.claims?.firebase?.sign_in_second_factor
}

const errText = (e) => {
  const c = e?.code || ''
  if (c.includes('invalid-verification-code')) return 'That code is wrong or expired. Check the app and try again.'
  if (c.includes('wrong-password') || c.includes('invalid-credential')) return 'Wrong password.'
  if (c.includes('unverified-email')) return 'Verify your email first.'
  if (c.includes('operation-not-allowed'))
    return '2-step verification isn’t switched on for this store yet. Ask the owner.'
  if (c.includes('too-many-requests')) return 'Too many attempts. Wait a minute and try again.'
  if (c.includes('network')) return 'No internet connection.'
  return e?.message || 'Something went wrong.'
}

export function CodeInput({ value, onChange, autoFocus }) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      inputMode="numeric"
      autoComplete="one-time-code"
      placeholder="6-digit code"
      autoFocus={autoFocus}
      className="text-center text-2xl tracking-[0.4em] tabular-nums"
      required
    />
  )
}

/**
 * Walks a signed-in person through turning on 2-step verification:
 * verify email → scan QR code → enter code → sign in again with the code.
 */
export function TwoStepSetup({ user, onCancel, required }) {
  const [step, setStep] = useState(() => (isEnrolled(user) ? 'relogin' : user.emailVerified ? 'start' : 'verify'))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [secret, setSecret] = useState(null)
  const [qr, setQr] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [sent, setSent] = useState(false)

  const run = async (fn) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      console.error(e)
      if (e?.code === 'auth/requires-recent-login') setStep('password')
      else setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  const sendVerify = () =>
    run(async () => {
      await sendEmailVerification(user, { url: window.location.origin })
      setSent(true)
    })

  const checkVerified = () =>
    run(async () => {
      await reload(user)
      if (user.emailVerified) {
        await user.getIdToken(true)
        setStep('start')
      } else setError('Not verified yet. Open the email and tap the link, then try again.')
    })

  const makeSecret = () =>
    run(async () => {
      const session = await multiFactor(user).getSession()
      const s = await TotpMultiFactorGenerator.generateSecret(session)
      setSecret(s)
      setQr(await QRCode.toDataURL(s.generateQrCodeUrl(user.email, ISSUER), { margin: 1, width: 220 }))
      setStep('scan')
    })

  const reauth = (e) => {
    e.preventDefault()
    run(async () => {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password))
      setPassword('')
      await makeSecret()
    })
  }

  const enroll = (e) => {
    e.preventDefault()
    run(async () => {
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code)
      await multiFactor(user).enroll(assertion, 'Authenticator app')
      setStep('done')
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">2-step verification</h2>
        <p className="text-sm text-brand-900/60">
          {required
            ? 'This store requires a code from an authenticator app every time you sign in.'
            : 'Sign in with your password plus a code from an authenticator app.'}
        </p>
      </div>

      {step === 'verify' && (
        <>
          <p className="text-sm text-brand-900/80">
            First, confirm that <b>{user.email}</b> is your email.
          </p>
          {sent ? (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Email sent. Open it, tap the link, then come back and tap <b>I’ve verified my email</b>.
            </p>
          ) : null}
          <Button className="w-full" variant={sent ? 'outline' : 'primary'} onClick={sendVerify} disabled={busy}>
            {sent ? 'Send the email again' : 'Send verification email'}
          </Button>
          {sent && (
            <Button className="w-full" onClick={checkVerified} disabled={busy}>
              I’ve verified my email
            </Button>
          )}
        </>
      )}

      {step === 'start' && (
        <>
          <ol className="space-y-1.5 rounded-xl bg-brand-50 p-3 text-sm">
            <li>1. Install <b>Google Authenticator</b> or <b>Microsoft Authenticator</b> on your phone.</li>
            <li>2. Tap <b>Show QR code</b> and scan it with the app.</li>
            <li>3. Type the 6-digit code the app shows.</li>
          </ol>
          <Button className="w-full" size="lg" onClick={makeSecret} disabled={busy}>
            {busy ? 'Preparing…' : 'Show QR code'}
          </Button>
        </>
      )}

      {step === 'password' && (
        <form onSubmit={reauth} className="space-y-3">
          <p className="text-sm text-brand-900/80">For your safety, enter your password again.</p>
          <Field label="Password">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required />
          </Field>
          <Button type="submit" className="w-full" disabled={busy}>
            Continue
          </Button>
        </form>
      )}

      {step === 'scan' && secret && (
        <form onSubmit={enroll} className="space-y-3">
          <div className="flex justify-center">
            <img src={qr} alt="QR code for your authenticator app" className="h-[220px] w-[220px] rounded-xl ring-1 ring-brand-200" />
          </div>
          <details className="text-center text-sm text-brand-900/60">
            <summary className="cursor-pointer">Can’t scan? Enter this key instead</summary>
            <p className="mt-2 select-all break-all rounded-lg bg-brand-50 px-3 py-2 font-mono text-brand-900">
              {secret.secretKey}
            </p>
          </details>
          <Field label="Code from the app">
            <CodeInput value={code} onChange={setCode} autoFocus />
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={busy || code.length !== 6}>
            Turn on 2-step verification
          </Button>
        </form>
      )}

      {step === 'done' && (
        <>
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <Icon name="check" size={16} className="-mt-0.5 mr-1 inline" />
            2-step verification is on. Sign in once more with your password and a code from the app.
          </p>
          <Button className="w-full" size="lg" onClick={() => signOut(auth)}>
            Sign in again
          </Button>
        </>
      )}

      {step === 'relogin' && (
        <>
          <p className="text-sm text-brand-900/80">
            2-step verification is already set up for {user.email}. Sign in again and enter the code from your app.
          </p>
          <Button className="w-full" size="lg" onClick={() => signOut(auth)}>
            Sign in again
          </Button>
        </>
      )}

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {onCancel && step !== 'done' && (
        <button onClick={onCancel} className="w-full text-center text-sm font-medium text-brand-600">
          Not now
        </button>
      )}
      {required && step !== 'done' && step !== 'relogin' && (
        <button onClick={() => signOut(auth)} className="w-full text-center text-sm font-medium text-brand-900/50">
          Sign out
        </button>
      )}
    </div>
  )
}

/** Full-screen gate shown when 2-step is required but this session didn't use it. */
export function TwoStepGate({ user }) {
  useEffect(() => {
    document.title = 'JacqueNgel POS'
  }, [])
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-brand-50 px-5 py-10">
      <img src="/logo-192.png" alt="" className="mb-5 h-20 w-20" />
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 ring-1 ring-brand-200/70">
        <TwoStepSetup user={user} required />
      </div>
    </div>
  )
}
