import { useState } from 'react'
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signOut, updateProfile } from 'firebase/auth'
import { collection, doc, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { auth, db, getSecondaryAuth } from '../firebase'
import { useLive, useSession } from '../lib/data'
import { peso, r2, startOfManilaDay } from '../lib/format'
import { Badge, Button, Field, Icon, Input, Modal, cx, useConfirm, useToast } from '../components/ui'

export default function Settings() {
  const { isOwner } = useSession()
  return (
    <div className="space-y-4 px-4 pt-3">
      {isOwner ? (
        <>
          <StoreSettings />
          <Staff />
        </>
      ) : (
        <MySalesToday />
      )}
      <Account />
    </div>
  )
}

function Section({ title, children, action }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-brand-100">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-brand-900">{title}</h3>
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
    updateDoc(doc(db, 'users', u.id), { active: !u.active, updatedAt: serverTimestamp() }).catch((err) =>
      toast(`Update failed: ${err.code}`, 'error'),
    )
  }

  return (
    <Section
      title="Staff"
      action={
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
          <Icon name="plus" size={16} /> Cashier
        </Button>
      }
    >
      <div className="divide-y divide-brand-100">
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className={cx('truncate font-semibold', !u.active && 'text-brand-900/40 line-through')}>{u.name}</p>
              <p className="truncate text-xs text-brand-900/50">{u.email}</p>
            </div>
            <Badge tone={u.role === 'owner' ? 'info' : 'neutral'}>{u.role === 'owner' ? 'Owner' : 'Cashier'}</Badge>
            {u.id !== session.user.uid && (
              <Button size="sm" variant={u.active ? 'outline' : 'success'} onClick={() => toggle(u)}>
                {u.active ? 'Deactivate' : 'Activate'}
              </Button>
            )}
          </div>
        ))}
      </div>
      {adding && <AddCashier onClose={() => setAdding(false)} />}
      {confirmDialog}
    </Section>
  )
}

function AddCashier({ onClose }) {
  const toast = useToast()
  const [f, setF] = useState({ name: '', email: '', password: '' })
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
        role: 'cashier',
        active: true,
        createdAt: serverTimestamp(),
      })
      await signOut(secondary)
      toast(`${f.name.trim()} can now sign in as cashier`)
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
      title="Add cashier"
      footer={
        <div className="pb-2">
          <Button form="cashier-form" type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? 'Creating…' : 'Create cashier account'}
          </Button>
        </div>
      }
    >
      <form id="cashier-form" onSubmit={submit} className="space-y-3">
        <p className="text-sm text-brand-900/70">
          Cashiers can sell, record utang payments and view stock. They can’t change prices, edit inventory or see
          reports.
        </p>
        <Field label="Name">
          <Input value={f.name} onChange={set('name')} required autoFocus />
        </Field>
        <Field label="Email (used to sign in)">
          <Input type="email" value={f.email} onChange={set('email')} required />
        </Field>
        <Field label="Temporary password" hint="At least 6 characters. Share it with the cashier.">
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
          <p className="font-bold">{mine.length}</p>
        </div>
        <div>
          <p className="text-xs text-brand-900/55">Total</p>
          <p className="font-bold">{peso(total)}</p>
        </div>
        <div>
          <p className="text-xs text-brand-900/55">Cash in drawer</p>
          <p className="font-bold text-emerald-700">{peso(total - credit)}</p>
        </div>
      </div>
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
