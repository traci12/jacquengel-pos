import { useEffect, useState } from 'react'
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signOut, updateProfile } from 'firebase/auth'
import { collection, doc, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { auth, db, getSecondaryAuth } from '../firebase'
import { TwoStepSetup, isEnrolled, usedSecondFactor } from './TwoStep'
import { useLive, useSession } from '../lib/data'
import { peso, r2, startOfManilaDay } from '../lib/format'
import { Badge, Button, Field, Icon, Input, Modal, cx, useConfirm, useToast } from '../components/ui'

export default function Settings() {
  const { isOwner } = useSession()
  return (
    <div className="space-y-4 px-4 pt-3 lg:mx-auto lg:max-w-2xl lg:px-6 lg:pt-5">
      {isOwner ? (
        <>
          <StoreSettings />
          <Staff />
        </>
      ) : (
        <MySalesToday />
      )}
      <TwoStepSection />
      <Account />
    </div>
  )
}

function Section({ title, children, action }) {
  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-brand-200/70">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold tracking-tight text-brand-900">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function StoreSettings() {
  const { store } = useSession()
  const toast = useToast()
  const [name, setName] = useState(store.name || '')
  const [low, setLow] = useState(store.lowStockDefault ?? 5)
  const dirty = name !== (store.name || '') || Number(low) !== (store.lowStockDefault ?? 5)
  const save = (e) => {
    e.preventDefault()
    setDoc(
      doc(db, 'settings', 'store'),
      { name: name.trim(), lowStockDefault: Number(low) || 0, updatedAt: serverTimestamp() },
      { merge: true },
    ).catch((err) => toast(`Save failed: ${err.code}`, 'error'))
    toast('Store settings saved')
  }
  return (
    <Section title="Store">
      <form onSubmit={save} className="space-y-3">
        <Field label="Store name">
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Default low-stock alert" hint="Used when adding new products.">
          <Input type="number" inputMode="numeric" min="0" value={low} onChange={(e) => setLow(e.target.value)} />
        </Field>
        <Button type="submit" disabled={!dirty} className="w-full">
          Save
        </Button>
      </form>
    </Section>
  )
}

function Staff() {
  const session = useSession()
  const toast = useToast()
  const [confirm, confirmDialog] = useConfirm()
  const users = useLive(query(collection(db, 'users'), orderBy('name')), []).data || []
  const [adding, setAdding] = useState(false)

  const setRole = async (u, role) => {
    const ok = await confirm(
      role === 'owner'
        ? {
            title: `Make ${u.name} an owner?`,
            message:
              'Owners have full access: prices, inventory, reports, voiding sales and managing staff (including you).',
            confirmText: 'Make owner',
          }
        : {
            title: `Change ${u.name} to cashier?`,
            message: 'They will only be able to sell, record utang payments and view stock.',
            confirmText: 'Make cashier',
          },
    )
    if (!ok) return
    updateDoc(doc(db, 'users', u.id), { role, updatedAt: serverTimestamp() })
      .then(() => toast(`${u.name} is now ${role === 'owner' ? 'an owner' : 'a cashier'}`))
      .catch((err) => toast(`Update failed: ${err.code}`, 'error'))
  }

  const toggle = async (u) => {
    if (u.active) {
      const ok = await confirm({
        title: `Deactivate ${u.name}?`,
        message: 'They will be signed out of the POS and can no longer sell. You can turn them back on anytime.',
        confirmText: 'Deactivate',
        danger: true,
      })
      if (!ok) return
    }
    updateDoc(doc(db, 'users', u.id), { active: !u.active, requested: false, updatedAt: serverTimestamp() }).catch((err) =>
      toast(`Update failed: ${err.code}`, 'error'),
    )
  }

  return (
    <Section
      title="Staff"
      action={
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
          <Icon name="plus" size={16} /> Staff
        </Button>
      }
    >
      <div className="divide-y divide-brand-200/60">
        {users.map((u) => (
          <div key={u.id} className="py-2.5">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p
                  className={cx(
                    'truncate font-semibold',
                    !u.active && !u.requested && 'text-brand-900/40 line-through',
                  )}
                >
                  {u.name}
                  {u.id === session.user.uid && <span className="font-normal text-brand-900/50"> (you)</span>}
                </p>
                <p className="truncate text-xs text-brand-900/50">{u.email}</p>
              </div>
              {u.requested && !u.active ? (
                <Badge tone="low">Wants access</Badge>
              ) : (
                <Badge tone={u.role === 'owner' ? 'info' : 'neutral'}>{u.role === 'owner' ? 'Owner' : 'Cashier'}</Badge>
              )}
            </div>
            {u.id !== session.user.uid && (
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setRole(u, u.role === 'owner' ? 'cashier' : 'owner')}>
                  {u.role === 'owner' ? 'Make cashier' : 'Make owner'}
                </Button>
                <Button size="sm" variant={u.active ? 'outline' : 'success'} onClick={() => toggle(u)}>
                  {u.active ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
      {adding && <AddStaff onClose={() => setAdding(false)} />}
      {confirmDialog}
    </Section>
  )
}

function AddStaff({ onClose }) {
  const toast = useToast()
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'cashier' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const secondary = getSecondaryAuth()
    try {
      const cred = await createUserWithEmailAndPassword(secondary, f.email.trim(), f.password)
      await updateProfile(cred.user, { displayName: f.name.trim() })
      await setDoc(doc(db, 'users', cred.user.uid), {
        name: f.name.trim(),
        email: f.email.trim().toLowerCase(),
        role: f.role,
        active: true,
        createdAt: serverTimestamp(),
      })
      await signOut(secondary)
      toast(`${f.name.trim()} can now sign in as ${f.role === 'owner' ? 'owner' : 'cashier'}`)
      onClose()
    } catch (err) {
      console.error(err)
      const code = err?.code || ''
      setError(
        code.includes('email-already-in-use')
          ? 'That email already has an account.'
          : code.includes('weak-password')
            ? 'Password must be at least 6 characters.'
            : code.includes('network')
              ? 'Adding staff needs an internet connection.'
              : err.message,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add staff"
      footer={
        <div className="pb-2">
          <Button form="cashier-form" type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? 'Creating…' : `Create ${f.role} account`}
          </Button>
        </div>
      }
    >
      <form id="cashier-form" onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-brand-100 p-1">
          {[
            ['cashier', 'Cashier'],
            ['owner', 'Owner'],
          ].map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setF({ ...f, role: k })}
              className={cx(
                'rounded-xl py-2 font-semibold',
                f.role === k ? 'bg-white text-brand-900 ring-1 ring-brand-200' : 'text-brand-800/60',
              )}
            >
              {l}
            </button>
          ))}
        </div>
        <p className="text-sm text-brand-900/70">
          {f.role === 'owner'
            ? 'Owners have full access: prices, inventory, reports, voiding sales and managing staff.'
            : 'Cashiers can sell, record utang payments and view stock. They can’t change prices, edit inventory or see reports.'}
        </p>
        <Field label="Name">
          <Input value={f.name} onChange={set('name')} required autoFocus />
        </Field>
        <Field label="Email (used to sign in)">
          <Input type="email" value={f.email} onChange={set('email')} required />
        </Field>
        <Field label="Temporary password" hint="At least 6 characters. Share it with them; they can change it with “Forgot password”.">
          <Input type="text" value={f.password} onChange={set('password')} minLength={6} required />
        </Field>
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </form>
    </Modal>
  )
}

function MySalesToday() {
  const { user } = useSession()
  const start = startOfManilaDay(0)
  const sales =
    useLive(query(collection(db, 'sales'), where('createdAt', '>=', start)), [start.getTime()]).data || []
  const mine = sales.filter((s) => s.cashierUid === user.uid && !s.voided)
  const total = r2(mine.reduce((a, s) => a + s.total, 0))
  const credit = r2(mine.reduce((a, s) => a + (s.creditAmount || 0), 0))
  return (
    <Section title="My sales today">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-brand-900/55">Sales</p>
          <p className="font-semibold">{mine.length}</p>
        </div>
        <div>
          <p className="text-xs text-brand-900/55">Total</p>
          <p className="font-semibold">{peso(total)}</p>
        </div>
        <div>
          <p className="text-xs text-brand-900/55">Cash in drawer</p>
          <p className="font-semibold text-emerald-700">{peso(total - credit)}</p>
        </div>
      </div>
    </Section>
  )
}

function TwoStepSection() {
  const { user, isOwner } = useSession()
  const toast = useToast()
  const [confirm, confirmDialog] = useConfirm()
  const security = useLive(doc(db, 'meta', 'security'), []).data
  const required = security?.require2fa === true
  const [open, setOpen] = useState(false)
  const [second, setSecond] = useState(false)
  useEffect(() => {
    usedSecondFactor(user).then(setSecond)
  }, [user])
  const enrolled = isEnrolled(user)

  const setRequired = async (on) => {
    const ok = await confirm(
      on
        ? {
            title: 'Require 2-step for everyone?',
            message:
              'Every owner and cashier will need an authenticator-app code to sign in. Anyone who hasn’t set it up will be asked to do it at their next use. Their email must be real, because they’ll need to verify it first.',
            confirmText: 'Require it',
          }
        : {
            title: 'Stop requiring 2-step?',
            message: 'People will be able to sign in with just their password again.',
            confirmText: 'Stop requiring',
            danger: true,
          },
    )
    if (!ok) return
    setDoc(doc(db, 'meta', 'security'), { require2fa: on, updatedAt: serverTimestamp(), by: user.uid })
      .then(() => toast(on ? '2-step is now required for everyone' : '2-step is no longer required'))
      .catch((err) => toast(`Could not change it: ${err.code}`, 'error'))
  }

  return (
    <Section title="2-step verification">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-brand-900/70">
          {enrolled
            ? 'On for your account. You sign in with your password and a code from your authenticator app.'
            : 'Off for your account. Add a code from an authenticator app so a stolen password isn’t enough to sign in.'}
        </p>
        <Badge tone={enrolled ? 'ok' : 'low'}>{enrolled ? 'On' : 'Off'}</Badge>
      </div>
      {!enrolled && (
        <Button className="mt-3 w-full" onClick={() => setOpen(true)}>
          Set up 2-step verification
        </Button>
      )}
      {isOwner && (
        <div className="mt-4 border-t border-brand-200/70 pt-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm">
              <span className="block font-medium">Require for everyone</span>
              <span className="text-brand-900/60">
                {required ? 'Everyone must use a code to sign in.' : 'Currently optional.'}
              </span>
            </p>
            <Button
              size="sm"
              variant={required ? 'outline' : 'primary'}
              disabled={!second}
              onClick={() => setRequired(!required)}
            >
              {required ? 'Turn off' : 'Turn on'}
            </Button>
          </div>
          {!second && (
            <p className="mt-2 text-xs text-brand-900/50">
              To change this, first set up 2-step for yourself and sign in with a code.
            </p>
          )}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="2-step verification">
        <TwoStepSetup user={user} onCancel={() => setOpen(false)} />
      </Modal>
      {confirmDialog}
    </Section>
  )
}

function Account() {
  const { user, profile } = useSession()
  const toast = useToast()
  const reset = () =>
    sendPasswordResetEmail(auth, user.email)
      .then(() => toast(`Password reset link sent to ${user.email}`))
      .catch((err) => toast(err.code, 'error'))
  return (
    <Section title="My account">
      <p className="font-semibold">{profile.name}</p>
      <p className="text-sm text-brand-900/60">{user.email}</p>
      <div className="mt-3 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={reset}>
          Change password
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => signOut(auth)}>
          <Icon name="logout" size={18} /> Sign out
        </Button>
      </div>
      <p className="mt-4 text-center text-xs text-brand-900/40">JacqueNgel POS v1.0</p>
    </Section>
  )
}
