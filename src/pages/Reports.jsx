import { useMemo, useState } from 'react'
import { collection, orderBy, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useLive, useSession } from '../lib/data'
import { voidSale } from '../lib/ops'
import {
  dayKey,
  fmtDateTime,
  fmtDay,
  isCafeCategory,
  peso,
  r2,
  shortId,
  startOfManilaDay,
  startOfManilaMonth,
  toDate,
  tracksStock,
} from '../lib/format'
import { Badge, Button, Empty, Field, Icon, Input, Modal, cx, useToast } from '../components/ui'

const RANGES = [
  { id: 'today', label: 'Today', start: () => startOfManilaDay(0) },
  { id: 'yesterday', label: 'Yesterday', start: () => startOfManilaDay(1), end: () => startOfManilaDay(0) },
  { id: '7d', label: '7 days', start: () => startOfManilaDay(6) },
  { id: '30d', label: '30 days', start: () => startOfManilaDay(29) },
  { id: 'month', label: 'This month', start: () => startOfManilaMonth() },
]

const BUSINESSES = [
  { id: 'sari', label: 'Sari-sari' },
  { id: 'cafe', label: 'Cafe' },
  { id: 'all', label: 'Both' },
]

export default function Reports({ products }) {
  const [rangeId, setRangeId] = useState('today')
  const [biz, setBiz] = useState(() => sessionStorage.getItem('report-biz') || 'sari')
  const chooseBiz = (b) => {
    setBiz(b)
    sessionStorage.setItem('report-biz', b)
  }
  const range = RANGES.find((r) => r.id === rangeId)
  const start = range.start()
  const end = range.end?.()
  const startKey = start.getTime()

  const salesQ = useLive(
    query(collection(db, 'sales'), where('createdAt', '>=', start), orderBy('createdAt', 'desc')),
    [startKey],
  )
  const all = useMemo(
    () => (salesQ.data || []).filter((s) => !end || toDate(s.createdAt) < end),
    [salesQ.data, end],
  )
  const [openSale, setOpenSale] = useState(null)

  // Which business an item belongs to. Older sales don't store the category,
  // so fall back to the product's current category.
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const inBiz = useMemo(() => {
    const isCafe = (i) => isCafeCategory(i.category ?? byId.get(i.productId)?.category)
    return (i) => biz === 'all' || (biz === 'cafe' ? isCafe(i) : !isCafe(i))
  }, [biz, byId])

  // Each sale cut down to this business's items (a cart can mix cafe and sari-sari).
  const view = useMemo(
    () =>
      all
        .map((s) => {
          const items = s.items.filter(inBiz)
          if (!items.length) return null
          const total = r2(items.reduce((a, i) => a + i.subtotal, 0))
          const share = s.total ? total / s.total : 0
          return {
            sale: s,
            items,
            total,
            cost: r2(items.reduce((a, i) => a + (i.cost || 0) * i.qty, 0)),
            credit: r2((s.creditAmount || 0) * share),
            mixed: items.length < s.items.length,
          }
        })
        .filter(Boolean),
    [all, inBiz],
  )
  const live = view.filter((v) => !v.sale.voided)

  const stats = useMemo(() => {
    const total = r2(live.reduce((a, v) => a + v.total, 0))
    const cost = r2(live.reduce((a, v) => a + v.cost, 0))
    const credit = r2(live.reduce((a, v) => a + v.credit, 0))
    const profit = r2(total - cost)

    const byProduct = new Map()
    const byDay = new Map()
    const byCashier = new Map()
    for (const v of live) {
      for (const i of v.items) {
        const p = byProduct.get(i.productId) || { name: i.name, qty: 0, revenue: 0, profit: 0 }
        p.qty += i.qty
        p.revenue += i.subtotal
        p.profit += i.subtotal - (i.cost || 0) * i.qty
        byProduct.set(i.productId, p)
      }
      const s = v.sale
      const d = s.day || dayKey(toDate(s.createdAt) || new Date())
      byDay.set(d, r2((byDay.get(d) || 0) + v.total))
      const c = byCashier.get(s.cashierName) || { count: 0, total: 0 }
      c.count += 1
      c.total = r2(c.total + v.total)
      byCashier.set(s.cashierName, c)
    }
    return {
      total,
      cost,
      profit,
      credit,
      cashIn: r2(total - credit),
      count: live.length,
      avg: live.length ? r2(total / live.length) : 0,
      margin: total ? Math.round((profit / total) * 100) : 0,
      best: [...byProduct.values()].sort((a, b) => b.qty - a.qty).slice(0, 10),
      days: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)),
      cashiers: [...byCashier.entries()].sort((a, b) => b[1].total - a[1].total),
    }
  }, [live])

  const lowStock = products
    .filter((p) => tracksStock(p) && !isCafeCategory(p.category) && (p.stock || 0) <= (p.lowStock || 0))
    .sort((a, b) => (a.stock || 0) - (b.stock || 0))
  const maxDay = Math.max(1, ...stats.days.map(([, v]) => v))
  const missingCost = biz !== 'sari' && products.some((p) => isCafeCategory(p.category) && !p.cost)

  return (
    <div className="space-y-4 px-4 pt-3 lg:mx-auto lg:max-w-5xl lg:px-6 lg:pt-5">
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-brand-100 p-1">
        {BUSINESSES.map((b) => (
          <button
            key={b.id}
            onClick={() => chooseBiz(b.id)}
            aria-pressed={biz === b.id}
            className={cx(
              'rounded-lg py-2 text-sm font-semibold',
              biz === b.id ? 'bg-white text-brand-900 ring-1 ring-brand-200' : 'text-brand-800/60',
            )}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {RANGES.map((r) => (
          <button key={r.id} onClick={() => setRangeId(r.id)} aria-pressed={rangeId === r.id} className="chip">
            {r.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        <Card label={biz === 'cafe' ? 'Cafe sales' : biz === 'sari' ? 'Sari-sari sales' : 'Total sales'} value={peso(stats.total)} big />
        <Card label={`Gross profit, ${stats.margin}%`} value={peso(stats.profit)} big tone="text-emerald-700" />
        <Card label="Transactions" value={stats.count} />
        <Card label="Average sale" value={peso(stats.avg)} />
        <Card label="Cash collected" value={peso(stats.cashIn)} />
        <Card label="Given as utang" value={peso(stats.credit)} tone="text-amber-700" />
      </div>
      {missingCost && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Some cafe items have no cost yet, so cafe profit is shown too high. Add costs in Inventory.
        </p>
      )}

      {stats.days.length > 1 && (
        <Section title="Sales per day">
          <div className="space-y-1.5">
            {stats.days.map(([d, v]) => (
              <div key={d} className="flex items-center gap-2 text-sm">
                <span className="w-24 shrink-0 text-brand-900/60">{fmtDay(d)}</span>
                <div className="h-6 flex-1 overflow-hidden rounded-md bg-brand-50">
                  <div className="h-full rounded-md bg-brand-600" style={{ width: `${(v / maxDay) * 100}%` }} />
                </div>
                <span className="w-24 shrink-0 text-right font-semibold tabular-nums">{peso(v)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Best sellers">
        {stats.best.length === 0 ? (
          <p className="text-sm text-brand-900/50">No sales in this period.</p>
        ) : (
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left text-xs text-brand-900/50">
                <th className="pb-1 font-medium">Product</th>
                <th className="pb-1 text-right font-medium">Qty</th>
                <th className="pb-1 text-right font-medium">Sales</th>
                <th className="pb-1 text-right font-medium">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-200/60">
              {stats.best.map((p) => (
                <tr key={p.name}>
                  <td className="max-w-[9rem] truncate py-1.5 pr-2">{p.name}</td>
                  <td className="py-1.5 text-right font-semibold">{p.qty}</td>
                  <td className="py-1.5 text-right">{peso(p.revenue)}</td>
                  <td className="py-1.5 text-right text-emerald-700">{peso(p.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {stats.cashiers.length > 0 && (
        <Section title="By cashier">
          {stats.cashiers.map(([name, c]) => (
            <div key={name} className="flex justify-between py-1 text-sm">
              <span>
                {name} <span className="text-brand-900/50">({c.count} sales)</span>
              </span>
              <span className="font-semibold tabular-nums">{peso(c.total)}</span>
            </div>
          ))}
        </Section>
      )}

      {biz !== 'cafe' && (
        <Section title={`Need to restock (${lowStock.length})`}>
          {lowStock.length === 0 ? (
            <p className="text-sm text-brand-900/50">All products are above their low-stock level.</p>
          ) : (
            lowStock.slice(0, 20).map((p) => (
              <div key={p.id} className="flex items-center justify-between py-1 text-sm">
                <span className="truncate">{p.name}</span>
                <Badge tone={(p.stock || 0) <= 0 ? 'out' : 'low'}>
                  {p.stock || 0} {p.unit || 'pc'}
                </Badge>
              </div>
            ))
          )}
        </Section>
      )}

      <Section title="Transactions">
        {salesQ.loading && !salesQ.data ? (
          <p className="text-sm text-brand-900/50">Loading…</p>
        ) : view.length === 0 ? (
          <Empty icon="receipt" title="No sales in this period" />
        ) : (
          <div className="-mx-4 divide-y divide-brand-200/60">
            {view.map(({ sale: s, items, total, mixed }) => (
              <button
                key={s.id}
                onClick={() => setOpenSale(s)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-brand-50"
              >
                <div className="min-w-0 flex-1">
                  <p className={cx('truncate text-sm font-medium', s.voided && 'line-through opacity-50')}>
                    {items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
                  </p>
                  <p className="text-xs text-brand-900/50">
                    #{shortId(s.id)}, {fmtDateTime(s.createdAt)}, {s.cashierName}
                    {mixed && ` (part of a ${peso(s.total)} sale)`}
                  </p>
                </div>
                {s.voided ? (
                  <Badge tone="out">Void</Badge>
                ) : s.payment === 'utang' ? (
                  <Badge tone="low">Utang</Badge>
                ) : null}
                <span className={cx('font-semibold tabular-nums', s.voided && 'line-through opacity-50')}>
                  {peso(total)}
                </span>
              </button>
            ))}
          </div>
        )}
      </Section>

      {openSale && (
        <SaleDetail
          sale={all.find((s) => s.id === openSale.id) || openSale}
          products={products}
          onClose={() => setOpenSale(null)}
        />
      )}
    </div>
  )
}

function Card({ label, value, tone, big }) {
  return (
    <div className="rounded-2xl bg-white p-3 ring-1 ring-brand-200/70">
      <p className="text-xs font-medium text-brand-900/55">{label}</p>
      <p className={cx('font-semibold', big ? 'text-2xl' : 'text-lg', tone || 'text-brand-900')}>{value}</p>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-brand-200/70">
      <h3 className="mb-2 text-[15px] font-semibold tracking-tight text-brand-900">{title}</h3>
      {children}
    </section>
  )
}

function SaleDetail({ sale, products, onClose }) {
  const session = useSession()
  const toast = useToast()
  const [voiding, setVoiding] = useState(false)
  const [reason, setReason] = useState('')

  const doVoid = () => {
    voidSale({ sale, productIds: new Set(products.map((p) => p.id)), session, reason }).catch((err) =>
      toast(`Void failed: ${err.code || err.message}`, 'error'),
    )
    toast(`Sale #${shortId(sale.id)} voided. Stock returned.`)
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={`Sale #${shortId(sale.id)}`}>
      <p className="text-sm text-brand-900/60">
        {fmtDateTime(sale.createdAt)} · {sale.cashierName}
      </p>
      {sale.voided && (
        <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          Voided{sale.voidReason ? `: ${sale.voidReason}` : ''}
        </p>
      )}
      <div className="mt-3 space-y-1 rounded-2xl bg-brand-50 p-4 font-mono text-sm tabular-nums">
        {sale.items.map((i) => (
          <div key={i.productId} className="flex justify-between gap-2">
            <span className="truncate">
              {i.qty}× {i.name} @ {peso(i.price)}
            </span>
            <span>{peso(i.subtotal)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-dashed border-brand-300 pt-2 font-semibold">
          <span>TOTAL</span>
          <span>{peso(sale.total)}</span>
        </div>
        <div className="flex justify-between text-emerald-700">
          <span>Profit</span>
          <span>{peso(sale.profit)}</span>
        </div>
        {sale.payment === 'cash' ? (
          <div className="flex justify-between">
            <span>Cash / change</span>
            <span>
              {peso(sale.cashReceived)} / {peso(sale.change)}
            </span>
          </div>
        ) : (
          <div className="flex justify-between text-amber-700">
            <span>Utang · {sale.customerName}</span>
            <span>{peso(sale.creditAmount)}</span>
          </div>
        )}
      </div>

      {!sale.voided &&
        (voiding ? (
          <div className="mt-4 space-y-2">
            <Field label="Reason for voiding">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. wrong item, cancelled" autoFocus />
            </Field>
            <p className="text-xs text-brand-900/60">
              Items go back to stock{sale.creditAmount > 0 ? ' and the utang is removed from the customer' : ''}.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setVoiding(false)}>
                Cancel
              </Button>
              <Button variant="danger" className="flex-1" onClick={doVoid}>
                Void sale
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" className="mt-4 w-full text-red-600" onClick={() => setVoiding(true)}>
            <Icon name="x" size={18} /> Void this sale
          </Button>
        ))}
    </Modal>
  )
}
