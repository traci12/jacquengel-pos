import { useEffect, useMemo, useState } from 'react'
import { collection, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'
import { useLive, useSession } from '../lib/data'
import { createSale } from '../lib/ops'
import { peso, r2, shortId, fmtDateTime } from '../lib/format'
import { Badge, Button, Empty, Field, Icon, Input, Modal, SearchBox, cx, useToast } from '../components/ui'

const CART_KEY = 'cart:v1'

export default function Sell({ products }) {
  const session = useSession()
  const toast = useToast()
  const list = products.data || []
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(CART_KEY)) || {}
    } catch {
      return {}
    }
  })
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [receipt, setReceipt] = useState(null)

  useEffect(() => sessionStorage.setItem(CART_KEY, JSON.stringify(cart)), [cart])

  const byId = useMemo(() => new Map(list.map((p) => [p.id, p])), [list])
  const categories = useMemo(() => ['All', ...new Set(list.map((p) => p.category || 'Others'))], [list])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return list.filter(
      (p) =>
        (category === 'All' || (p.category || 'Others') === category) &&
        (!q || p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(q))),
    )
  }, [list, search, category])

  const lines = Object.entries(cart)
    .map(([id, qty]) => ({ product: byId.get(id), qty }))
    .filter((l) => l.product && l.qty > 0)
  const total = r2(lines.reduce((s, l) => s + l.product.price * l.qty, 0))
  const count = lines.reduce((s, l) => s + l.qty, 0)

  const add = (p, n = 1) => {
    const current = cart[p.id] || 0
    const next = current + n
    if (next > (p.stock || 0)) {
      toast(`Only ${p.stock || 0} ${p.name} left in stock.`, 'error')
      return
    }
    setCart((c) => {
      const copy = { ...c }
      if (next <= 0) delete copy[p.id]
      else copy[p.id] = next
      return copy
    })
  }

  const onCheckout = (opts) => {
    const { sale, done } = createSale({ cart: lines, session, ...opts })
    done.catch((e) => {
      console.error(e)
      toast(`Sale ${shortId(sale.id)} failed to save: ${e.code || e.message}`, 'error')
    })
    setCart({})
    setCheckoutOpen(false)
    setReceipt(sale)
  }

  if (products.loading && !products.data) return <p className="p-6 text-center text-brand-900/50">Loading products…</p>

  return (
    <div>
      <div className="sticky top-[60px] z-20 space-y-2 bg-brand-50/95 px-4 pb-2 pt-3 backdrop-blur">
        <SearchBox value={search} onChange={setSearch} placeholder="Search product or barcode…" />
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cx(
                'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold',
                category === c ? 'bg-brand-700 text-white' : 'bg-white text-brand-800 ring-1 ring-brand-200',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <Empty title="No products yet">
          {session.isOwner ? 'Go to Inventory to add your first products.' : 'Ask the owner to add products.'}
        </Empty>
      ) : shown.length === 0 ? (
        <Empty icon="search" title="No match" />
      ) : (
        <div className="grid grid-cols-2 gap-2.5 px-4 pt-1 sm:grid-cols-3">
          {shown.map((p) => {
            const inCart = cart[p.id] || 0
            const out = (p.stock || 0) <= 0
            const low = !out && p.stock <= (p.lowStock || 0)
            return (
              <button
                key={p.id}
                disabled={out}
                onClick={() => add(p)}
                className={cx(
                  'relative flex min-h-[96px] flex-col rounded-2xl bg-white p-3 text-left shadow-sm ring-1 transition active:scale-[.97]',
                  inCart ? 'ring-2 ring-brand-600' : 'ring-brand-100',
                  out && 'opacity-50',
                )}
              >
                {inCart > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-7 min-w-7 items-center justify-center rounded-full bg-brand-700 px-1.5 text-sm font-bold text-white shadow">
                    {inCart}
                  </span>
                )}
                <span className="line-clamp-2 font-semibold leading-snug text-brand-900">{p.name}</span>
                <span className="mt-auto flex items-end justify-between gap-1 pt-2">
                  <span className="text-lg font-bold text-brand-700">{peso(p.price)}</span>
                  <Badge tone={out ? 'out' : low ? 'low' : 'neutral'}>{out ? 'Out' : `${p.stock} left`}</Badge>
                </span>
              </button>
            )
          })}
        </div>
      )}

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-[72px] z-30 px-4">
          <div className="mx-auto max-w-3xl">
            <button
              onClick={() => setCheckoutOpen(true)}
              className="flex w-full items-center gap-3 rounded-2xl bg-brand-900 px-4 py-3.5 text-white shadow-xl active:scale-[.99]"
            >
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-sm font-bold">{count}</span>
              <span className="flex-1 text-left font-semibold">View cart & checkout</span>
              <span className="text-lg font-bold">{peso(total)}</span>
            </button>
          </div>
        </div>
      )}

      <Checkout
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        lines={lines}
        total={total}
        onAdd={add}
        onClear={() => {
          setCart({})
          setCheckoutOpen(false)
        }}
        onConfirm={onCheckout}
      />
      <Receipt sale={receipt} onClose={() => setReceipt(null)} />
    </div>
  )
}

function Checkout({ open, onClose, lines, total, onAdd, onClear, onConfirm }) {
  const [payment, setPayment] = useState('cash')
  const [cash, setCash] = useState('')
  const [customer, setCustomer] = useState(null)
  const [paidNow, setPaidNow] = useState('')

  useEffect(() => {
    if (open) {
      setPayment('cash')
      setCash('')
      setCustomer(null)
      setPaidNow('')
    }
  }, [open])

  const cashNum = cash === '' ? total : Number(cash)
  const change = r2(cashNum - total)
  const paidNum = Math.min(Number(paidNow) || 0, total)
  const credit = r2(total - paidNum)

  const canConfirm =
    lines.length > 0 && (payment === 'cash' ? cashNum >= total : credit <= 0 || (customer && customer.name.trim()))

  const quick = [...new Set([total, 20, 50, 100, 200, 500, 1000].filter((v) => v >= total))].slice(0, 5)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Checkout"
      footer={
        <div className="space-y-2 pb-2">
          <div className="flex items-center justify-between">
            <span className="text-brand-900/70">Total</span>
            <span className="text-2xl font-bold text-brand-900">{peso(total)}</span>
          </div>
          {payment === 'cash' && cashNum >= total && (
            <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2">
              <span className="font-semibold text-emerald-800">Change (sukli)</span>
              <span className="text-2xl font-bold text-emerald-700">{peso(change)}</span>
            </div>
          )}
          {payment === 'cash' && cashNum < total && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              Cash is short by {peso(total - cashNum)}
            </p>
          )}
          <Button
            size="lg"
            variant="success"
            className="w-full"
            disabled={!canConfirm}
            onClick={() =>
              onConfirm({
                payment,
                cashReceived: cashNum,
                customer,
                paidNow: paidNum,
              })
            }
          >
            <Icon name="check" /> Complete sale
          </Button>
        </div>
      }
    >
      <div className="space-y-2">
        {lines.map(({ product, qty }) => (
          <div key={product.id} className="flex items-center gap-2 rounded-xl bg-brand-50 p-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-brand-900">{product.name}</p>
              <p className="text-xs text-brand-900/60">
                {peso(product.price)} × {qty} = <b>{peso(product.price * qty)}</b>
              </p>
            </div>
            <button
              onClick={() => onAdd(product, -1)}
              className="rounded-lg bg-white p-2 text-brand-700 ring-1 ring-brand-200"
              aria-label="Less"
            >
              <Icon name="minus" size={16} />
            </button>
            <span className="w-7 text-center font-bold">{qty}</span>
            <button
              onClick={() => onAdd(product, 1)}
              className="rounded-lg bg-white p-2 text-brand-700 ring-1 ring-brand-200"
              aria-label="More"
            >
              <Icon name="plus" size={16} />
            </button>
          </div>
        ))}
        <button onClick={onClear} className="text-sm font-medium text-red-600">
          Clear cart
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-brand-100 p-1">
        {[
          ['cash', 'Cash'],
          ['utang', 'Utang (credit)'],
        ].map(([k, l]) => (
          <button
            key={k}
            onClick={() => setPayment(k)}
            className={cx(
              'rounded-xl py-2.5 font-semibold',
              payment === k ? 'bg-white text-brand-800 shadow' : 'text-brand-800/60',
            )}
          >
            {l}
          </button>
        ))}
      </div>

      {payment === 'cash' ? (
        <div className="mt-4 space-y-2">
          <Field label="Cash received">
            <Input
              type="number"
              inputMode="decimal"
              placeholder={total.toFixed(2)}
              value={cash}
              onChange={(e) => setCash(e.target.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            {quick.map((v, i) => (
              <button
                key={v}
                onClick={() => setCash(String(v))}
                className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-brand-800 ring-1 ring-brand-200"
              >
                {i === 0 && v === total ? 'Exact' : peso(v).replace('.00', '')}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <CustomerPicker value={customer} onChange={setCustomer} />
          <Field label="Paid now (optional)" hint="Leave blank if the whole amount is utang.">
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={paidNow}
              onChange={(e) => setPaidNow(e.target.value)}
            />
          </Field>
          <div className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2">
            <span className="font-semibold text-amber-900">Added to utang</span>
            <span className="text-xl font-bold text-amber-800">{peso(credit)}</span>
          </div>
        </div>
      )}
    </Modal>
  )
}

function CustomerPicker({ value, onChange }) {
  const customers = useLive(query(collection(db, 'customers'), orderBy('nameLower')), []).data || []
  const [text, setText] = useState('')
  const q = text.trim().toLowerCase()
  const matches = q ? customers.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6) : customers.slice(0, 6)
  const exact = customers.find((c) => c.name.toLowerCase() === q)

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-brand-50 px-3 py-2.5 ring-1 ring-brand-200">
        <div>
          <p className="font-semibold text-brand-900">{value.name}</p>
          <p className="text-xs text-brand-900/60">
            {value.id ? `Current utang: ${peso(value.balance)}` : 'New customer'}
          </p>
        </div>
        <button onClick={() => onChange(null)} className="text-sm font-semibold text-brand-600">
          Change
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Field label="Customer">
        <SearchBox value={text} onChange={setText} placeholder="Search or type a new name…" />
      </Field>
      <div className="divide-y divide-brand-100 overflow-hidden rounded-xl ring-1 ring-brand-100">
        {matches.map((c) => (
          <button
            key={c.id}
            onClick={() => onChange(c)}
            className="flex w-full items-center justify-between bg-white px-3 py-2.5 text-left hover:bg-brand-50"
          >
            <span className="font-medium">{c.name}</span>
            <span className={cx('text-sm', c.balance > 0 ? 'text-amber-700' : 'text-brand-900/40')}>
              {peso(c.balance)}
            </span>
          </button>
        ))}
        {q && !exact && (
          <button
            onClick={() => onChange({ name: text.trim() })}
            className="flex w-full items-center gap-2 bg-white px-3 py-2.5 text-left font-semibold text-brand-700 hover:bg-brand-50"
          >
            <Icon name="plus" size={16} /> Add “{text.trim()}” as new customer
          </button>
        )}
        {!q && customers.length === 0 && (
          <p className="bg-white px-3 py-2.5 text-sm text-brand-900/50">Type a name to add the first customer.</p>
        )}
      </div>
    </div>
  )
}

function Receipt({ sale, onClose }) {
  if (!sale) return null
  return (
    <Modal
      open
      onClose={onClose}
      title="Sale complete"
      footer={
        <div className="pb-2">
          <Button size="lg" className="w-full" onClick={onClose}>
            New sale
          </Button>
        </div>
      }
    >
      <div className="text-center">
        <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Icon name="check" size={30} />
        </div>
        {sale.payment === 'cash' ? (
          <>
            <p className="text-sm text-brand-900/60">Give change</p>
            <p className="text-4xl font-bold text-emerald-700">{peso(sale.change)}</p>
          </>
        ) : (
          <>
            <p className="text-sm text-brand-900/60">Added to {sale.customerName || 'customer'}'s utang</p>
            <p className="text-4xl font-bold text-amber-700">{peso(sale.creditAmount)}</p>
          </>
        )}
      </div>
      <div className="mt-5 rounded-2xl bg-brand-50 p-4 font-mono text-sm">
        <div className="mb-2 flex justify-between text-xs text-brand-900/60">
          <span>#{shortId(sale.id)}</span>
          <span>{fmtDateTime(sale.createdAt)}</span>
        </div>
        {sale.items.map((i) => (
          <div key={i.productId} className="flex justify-between gap-2">
            <span className="truncate">
              {i.qty}× {i.name}
            </span>
            <span>{peso(i.subtotal)}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-dashed border-brand-300 pt-2 font-bold">
          <span>TOTAL</span>
          <span>{peso(sale.total)}</span>
        </div>
        {sale.payment === 'cash' ? (
          <>
            <div className="flex justify-between">
              <span>Cash</span>
              <span>{peso(sale.cashReceived)}</span>
            </div>
            <div className="flex justify-between">
              <span>Change</span>
              <span>{peso(sale.change)}</span>
            </div>
          </>
        ) : (
          <>
            {sale.paid > 0 && (
              <div className="flex justify-between">
                <span>Paid</span>
                <span>{peso(sale.paid)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Utang</span>
              <span>{peso(sale.creditAmount)}</span>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
