import { useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useLive, useSession } from '../lib/data'
import { recordPayment } from '../lib/ops'
import { fmtDateTime, peso, r2 } from '../lib/format'
import { Button, Empty, Field, Icon, Input, Modal, SearchBox, cx, useConfirm, useToast } from '../components/ui'

export default function Utang() {
  const customersQ = useLive(query(collection(db, 'customers'), orderBy('nameLower')), [])
  const customers = customersQ.data || []
  const [search, setSearch] = useState('')
  const [onlyOwing, setOnlyOwing] = useState(true)
  const [openId, setOpenId] = useState(null)
  const [adding, setAdding] = useState(false)

  const owing = customers.filter((c) => (c.balance || 0) > 0.004)
  const totalOut = r2(owing.reduce((s, c) => s + c.balance, 0))

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return customers
      .filter((c) => (!onlyOwing || (c.balance || 0) > 0.004) && (!q || c.name.toLowerCase().includes(q)))
      .sort((a, b) => (b.balance || 0) - (a.balance || 0))
  }, [customers, search, onlyOwing])

  const open = customers.find((c) => c.id === openId)

  return (
    <div className="space-y-3 px-4 pt-3">
      <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-inset ring-amber-100">
        <p className="text-sm text-amber-900/70">Total utang to collect</p>
        <p className="text-3xl font-semibold tracking-tight text-amber-900">{peso(totalOut)}</p>
        <p className="text-sm text-amber-900/60">
          {owing.length} customer{owing.length === 1 ? '' : 's'} with a balance
        </p>
      </div>

      <SearchBox value={search} onChange={setSearch} placeholder="Search customer…" />
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {[
            [true, 'May utang'],
            [false, 'All customers'],
          ].map(([k, l]) => (
            <button
              key={l}
              onClick={() => setOnlyOwing(k)}
              aria-pressed={onlyOwing === k}
              className="chip"
            >
              {l}
            </button>
          ))}
        </div>
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
          <Icon name="plus" size={16} /> Customer
        </Button>
      </div>

      {customersQ.loading && !customersQ.data ? (
        <p className="p-6 text-center text-brand-900/50">Loading…</p>
      ) : shown.length === 0 ? (
        <Empty icon="wallet" title={onlyOwing ? 'Walang utang!' : 'No customers yet'}>
          {onlyOwing ? 'No one owes the store right now.' : 'Customers are added when you sell on utang.'}
        </Empty>
      ) : (
        <div className="divide-y divide-brand-200/60 overflow-hidden rounded-2xl bg-white ring-1 ring-brand-200/70">
          {shown.map((c) => (
            <button
              key={c.id}
              onClick={() => setOpenId(c.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-brand-50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tint-100 font-semibold text-brand-700">
                {c.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-brand-900">{c.name}</span>
                <span className="block text-xs text-brand-900/50">Last activity {fmtDateTime(c.lastActivity)}</span>
              </span>
              <span className={cx('font-semibold', c.balance > 0 ? 'text-amber-700' : 'text-brand-900/40')}>
                {peso(c.balance)}
              </span>
            </button>
          ))}
        </div>
      )}

      {open && <CustomerDetail customer={open} onClose={() => setOpenId(null)} />}
      {adding && <AddCustomer onClose={() => setAdding(false)} />}
    </div>
  )
}

function AddCustomer({ onClose }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const submit = (e) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    addDoc(collection(db, 'customers'), {
      name: n,
      nameLower: n.toLowerCase(),
      phone: phone.trim(),
      balance: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastActivity: serverTimestamp(),
    }).catch((err) => toast(`Could not add: ${err.code}`, 'error'))
    toast(`${n} added`)
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="New customer"
      footer={
        <div className="pb-2">
          <Button form="cust-form" type="submit" size="lg" className="w-full">
            Add customer
          </Button>
        </div>
      }
    >
      <form id="cust-form" onSubmit={submit} className="space-y-3">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aling Nena" autoFocus required />
        </Field>
        <Field label="Mobile number (optional)">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="09xx xxx xxxx" />
        </Field>
      </form>
    </Modal>
  )
}

function CustomerDetail({ customer, onClose }) {
  const session = useSession()
  const toast = useToast()
  const [confirm, confirmDialog] = useConfirm()
  const ledger =
    useLive(
      query(collection(db, 'customers', customer.id, 'ledger'), orderBy('createdAt', 'desc'), limit(50)),
      [customer.id],
    ).data || []
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(customer.name)
  const [phone, setPhone] = useState(customer.phone || '')

  const pay = async (e) => {
    e.preventDefault()
    const a = r2(amount)
    if (a <= 0) return
    if (a > customer.balance + 0.004) {
      const ok = await confirm({
        title: 'Pay more than the balance?',
        message: `${customer.name} owes ${peso(customer.balance)}. Recording ${peso(a)} leaves an advance (negative balance) of ${peso(a - customer.balance)}.`,
        confirmText: 'Record anyway',
      })
      if (!ok) return
    }
    recordPayment({ customer, amount: a, note, session }).catch((err) =>
      toast(`Payment failed to save: ${err.code || err.message}`, 'error'),
    )
    toast(`${peso(a)} payment recorded for ${customer.name}`)
    setAmount('')
    setNote('')
  }

  const saveInfo = () => {
    const n = name.trim()
    if (!n) return
    updateDoc(doc(db, 'customers', customer.id), {
      name: n,
      nameLower: n.toLowerCase(),
      phone: phone.trim(),
      updatedAt: serverTimestamp(),
    }).catch((err) => toast(`Save failed: ${err.code}`, 'error'))
    setEditing(false)
  }

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete customer?',
      message: `Remove ${customer.name} from the list? Their sales history stays in reports.`,
      confirmText: 'Delete',
      danger: true,
    })
    if (!ok) return
    deleteDoc(doc(db, 'customers', customer.id)).catch((err) => toast(`Delete failed: ${err.code}`, 'error'))
    onClose()
  }

  const typeLabel = { credit: 'Utang', payment: 'Payment', void: 'Voided sale' }

  return (
    <Modal open onClose={onClose} title={customer.name}>
      <div className="rounded-2xl bg-amber-50 p-4 text-center">
        <p className="text-sm text-amber-900/70">Current balance</p>
        <p className={cx('text-3xl font-semibold', customer.balance > 0 ? 'text-amber-800' : 'text-emerald-700')}>
          {peso(customer.balance)}
        </p>
        {customer.phone && (
          <a href={`tel:${customer.phone}`} className="text-sm font-medium text-brand-600">
            {customer.phone}
          </a>
        )}
      </div>

      <form onSubmit={pay} className="mt-4 space-y-2">
        <p className="font-semibold text-brand-900">Record a payment</p>
        <div className="flex gap-2">
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {customer.balance > 0 && (
            <Button type="button" variant="secondary" onClick={() => setAmount(String(customer.balance))}>
              Full
            </Button>
          )}
        </div>
        <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button type="submit" variant="success" className="w-full" disabled={!(Number(amount) > 0)}>
          <Icon name="check" /> Record payment
        </Button>
      </form>

      <div className="mt-5">
        <p className="mb-1 font-semibold text-brand-900">History</p>
        {ledger.length === 0 ? (
          <p className="text-sm text-brand-900/50">No transactions yet.</p>
        ) : (
          <div className="divide-y divide-brand-200/60 rounded-xl bg-brand-50 text-sm">
            {ledger.map((l) => (
              <div key={l.id} className="flex items-start justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="font-medium">{typeLabel[l.type] || l.type}</p>
                  {l.note && <p className="text-xs text-brand-900/60">{l.note}</p>}
                  <p className="text-xs text-brand-900/45">
                    {fmtDateTime(l.createdAt)} · {l.byName}
                  </p>
                </div>
                <span className={cx('shrink-0 font-semibold', l.type === 'credit' ? 'text-amber-700' : 'text-emerald-700')}>
                  {l.type === 'credit' ? '+' : '−'}
                  {peso(l.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {session.isOwner && (
        <div className="mt-5 border-t border-brand-100 pt-4">
          {editing ? (
            <div className="space-y-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile number" inputMode="tel" />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={saveInfo}>
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Icon name="edit" size={16} /> Edit info
              </Button>
              {Math.abs(customer.balance || 0) < 0.005 && (
                <Button variant="ghost" size="sm" className="text-red-600" onClick={remove}>
                  <Icon name="trash" size={16} /> Delete
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      {confirmDialog}
    </Modal>
  )
}
