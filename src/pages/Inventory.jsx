import { useMemo, useState } from 'react'
import { collection, deleteDoc, doc, limit, orderBy, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useLive, useSession } from '../lib/data'
import { changeStock, importProducts, saveProduct } from '../lib/ops'
import { STARTER_PRODUCTS } from '../lib/starterProducts'
import { CATEGORY_SUGGESTIONS, fmtDateTime, peso, r2, tracksStock } from '../lib/format'
import { Badge, Button, Empty, Field, Icon, Input, Modal, SearchBox, cx, useConfirm, useToast } from '../components/ui'

const stockTone = (p) =>
  !tracksStock(p) ? 'none' : (p.stock || 0) <= 0 ? 'out' : p.stock <= (p.lowStock || 0) ? 'low' : 'ok'

export default function Inventory({ products }) {
  const { isOwner } = useSession()
  const list = products.data || []
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [category, setCategory] = useState('All')
  const [editing, setEditing] = useState(null) // product | 'new' | null
  const [importing, setImporting] = useState(false)

  const catList = useMemo(
    () =>
      [...new Map(list.map((p) => [p.category || 'Others', 0])).keys()].sort((a, b) => a.localeCompare(b)),
    [list],
  )
  const activeCategory = category !== 'All' && !catList.includes(category) ? 'All' : category
  const inCategory = useMemo(
    () => (activeCategory === 'All' ? list : list.filter((p) => (p.category || 'Others') === activeCategory)),
    [list, activeCategory],
  )

  const counts = useMemo(
    () => ({
      all: inCategory.length,
      low: inCategory.filter((p) => stockTone(p) === 'low').length,
      out: inCategory.filter((p) => stockTone(p) === 'out').length,
      costValue: r2(list.filter(tracksStock).reduce((s, p) => s + Math.max(p.stock || 0, 0) * (p.cost || 0), 0)),
      retailValue: r2(list.filter(tracksStock).reduce((s, p) => s + Math.max(p.stock || 0, 0) * (p.price || 0), 0)),
    }),
    [list, inCategory],
  )

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return inCategory.filter((p) => {
      if (filter === 'low' && stockTone(p) !== 'low') return false
      if (filter === 'out' && stockTone(p) !== 'out') return false
      return (
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.barcode && p.barcode.includes(q))
      )
    })
  }, [inCategory, search, filter])

  const categories = useMemo(
    () => [...new Set([...list.map((p) => p.category).filter(Boolean), ...CATEGORY_SUGGESTIONS])],
    [list],
  )

  return (
    <div className="space-y-3 px-4 pt-3">
      {isOwner && (
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Stock value (cost)" value={peso(counts.costValue)} />
          <Stat label="Stock value (retail)" value={peso(counts.retailValue)} />
        </div>
      )}

      <SearchBox value={search} onChange={setSearch} placeholder="Search inventory…" />
      <div className="flex gap-2">
        {[
          ['all', `All (${counts.all})`],
          ['low', `Low (${counts.low})`],
          ['out', `Out (${counts.out})`],
        ].map(([k, l]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            aria-pressed={filter === k}
            className="chip inline-flex items-center gap-1.5"
          >
            {k !== 'all' && (
              <span
                className={cx(
                  'h-2 w-2 rounded-full',
                  k === 'low' ? 'bg-amber-400' : 'bg-red-400',
                  !(k === 'low' ? counts.low : counts.out) && 'opacity-30',
                )}
              />
            )}
            {l}
          </button>
        ))}
      </div>
      {catList.length > 1 && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {['All', ...catList].map((c) => (
            <button key={c} onClick={() => setCategory(c)} aria-pressed={activeCategory === c} className="chip">
              {c === 'All' ? 'All categories' : c}
            </button>
          ))}
        </div>
      )}

      {list.length === 0 ? (
        <Empty title="No products yet">
          {isOwner ? (
            <div className="space-y-3">
              <p>Add your products one by one, or start with popular snacks and soft drinks.</p>
              <Button variant="secondary" onClick={() => setImporting(true)}>
                <Icon name="box" size={18} /> Load starter products
              </Button>
            </div>
          ) : (
            'The owner hasn’t added products yet.'
          )}
        </Empty>
      ) : shown.length === 0 ? (
        <Empty icon="search" title="Nothing here" />
      ) : (
        <div className="divide-y divide-brand-200/60 overflow-hidden rounded-2xl bg-white ring-1 ring-brand-200/70">
          {shown.map((p) => (
            <button
              key={p.id}
              onClick={() => isOwner && setEditing(p)}
              className={cx('flex w-full items-center gap-3 px-4 py-3 text-left', isOwner && 'hover:bg-brand-50')}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-brand-900">{p.name}</p>
                <p className="truncate text-xs text-brand-900/55">
                  {p.category || 'Others'} · {peso(p.price)}
                  {isOwner && ` · cost ${peso(p.cost)}`}
                </p>
              </div>
              {!tracksStock(p) ? (
                <Badge tone="info">Made to order</Badge>
              ) : (
              <Badge tone={stockTone(p)}>
                {p.stock || 0} {p.unit || 'pc'}
              </Badge>
              )}
              {isOwner && <Icon name="chevron" size={16} className="text-brand-300" />}
            </button>
          ))}
        </div>
      )}

      {isOwner && <div className="h-16" />}
      {isOwner && (
        <div className="fixed bottom-[84px] right-4 z-30 sm:right-[calc(50%-23rem)]">
          <Button size="lg" className="rounded-full ring-4 ring-brand-50" onClick={() => setEditing('new')}>
            <Icon name="plus" /> Add product
          </Button>
        </div>
      )}

      {isOwner && list.length > 0 && (
        <button onClick={() => setImporting(true)} className="w-full py-2 text-center text-sm font-medium text-brand-600">
          + Add from starter product list
        </button>
      )}

      {importing && <StarterImport existing={list} onClose={() => setImporting(false)} />}

      {editing && (
        <ProductEditor
          product={editing === 'new' ? null : list.find((p) => p.id === editing.id) || editing}
          categories={categories}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-2xl bg-white p-3 ring-1 ring-brand-200/70">
      <p className="text-xs font-medium text-brand-900/55">{label}</p>
      <p className={cx('text-lg font-semibold', tone || 'text-brand-900')}>{value}</p>
    </div>
  )
}

function ProductEditor({ product, categories, onClose }) {
  const session = useSession()
  const toast = useToast()
  const [confirm, confirmDialog] = useConfirm()
  const isNew = !product
  const [f, setF] = useState(() => ({
    name: product?.name || '',
    category: product?.category || '',
    price: product?.price ?? '',
    cost: product?.cost ?? '',
    stock: '',
    lowStock: product?.lowStock ?? session.store.lowStockDefault ?? 5,
    unit: product?.unit || 'pc',
    barcode: product?.barcode || '',
    madeToOrder: !!product?.madeToOrder,
  }))
  const [mode, setMode] = useState('details') // details | restock | count
  const set = (k) => (e) => {
    const v = e.target.value
    // New Cafe items default to made-to-order.
    if (k === 'category' && isNew && v.trim().toLowerCase() === 'cafe') return setF({ ...f, category: v, madeToOrder: true })
    setF({ ...f, [k]: v })
  }
  const margin = Number(f.price) && Number(f.cost) ? r2(Number(f.price) - Number(f.cost)) : null

  const save = (e) => {
    e.preventDefault()
    if (Number(f.price) <= 0) return toast('Enter a selling price.', 'error')
    saveProduct({ product, data: f, session }).catch((err) => toast(`Save failed: ${err.code || err.message}`, 'error'))
    toast(isNew ? `${f.name} added` : `${f.name} saved`)
    onClose()
  }

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete product?',
      message: `“${product.name}” will be removed from the product list. Past sales are kept.`,
      confirmText: 'Delete',
      danger: true,
    })
    if (!ok) return
    deleteDoc(doc(db, 'products', product.id)).catch((err) => toast(`Delete failed: ${err.code}`, 'error'))
    toast(`${product.name} deleted`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Add product' : product.name}
      footer={
        mode === 'details' ? (
          <div className="flex gap-2 pb-2">
            {!isNew && (
              <Button variant="outline" onClick={remove} aria-label="Delete">
                <Icon name="trash" />
              </Button>
            )}
            <Button form="product-form" type="submit" size="lg" className="flex-1">
              {isNew ? 'Add product' : 'Save changes'}
            </Button>
          </div>
        ) : null
      }
    >
      {!isNew && tracksStock(product) && (
        <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-brand-100 p-1 text-sm">
          {[
            ['details', 'Details'],
            ['restock', 'Restock'],
            ['count', 'Stock count'],
          ].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setMode(k)}
              className={cx(
                'rounded-xl py-2 font-semibold',
                mode === k ? 'bg-white text-brand-900 ring-1 ring-brand-200' : 'text-brand-800/60',
              )}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {mode === 'details' && (
        <form id="product-form" onSubmit={save} className="space-y-3">
          <Field label="Product name">
            <Input value={f.name} onChange={set('name')} placeholder="e.g. Coke Mismo 290ml" required autoFocus={isNew} />
          </Field>
          <Field label="Category">
            <Input value={f.category} onChange={set('category')} list="cat-list" placeholder="e.g. Beverages" />
            <datalist id="cat-list">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Selling price (₱)">
              <Input type="number" inputMode="decimal" step="0.01" min="0" value={f.price} onChange={set('price')} required />
            </Field>
            <Field label="Cost / puhunan (₱)">
              <Input type="number" inputMode="decimal" step="0.01" min="0" value={f.cost} onChange={set('cost')} />
            </Field>
          </div>
          {margin !== null && (
            <p className={cx('text-sm', margin < 0 ? 'text-red-600' : 'text-emerald-700')}>
              Profit per {f.unit || 'pc'}: <b>{peso(margin)}</b>
            </p>
          )}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-brand-50 p-3 ring-1 ring-brand-200/70">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 accent-brand-700"
              checked={f.madeToOrder}
              onChange={(e) => setF({ ...f, madeToOrder: e.target.checked })}
            />
            <span className="text-sm">
              <span className="block font-medium text-brand-900">Made to order</span>
              <span className="text-brand-900/60">
                For cafe drinks and cooked food. Stock isn’t counted, so it never runs out.
              </span>
            </span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {isNew && !f.madeToOrder && (
              <Field label="Starting stock">
                <Input type="number" inputMode="numeric" min="0" value={f.stock} onChange={set('stock')} placeholder="0" />
              </Field>
            )}
            {!f.madeToOrder && (
              <Field label="Low-stock alert at">
                <Input type="number" inputMode="numeric" min="0" value={f.lowStock} onChange={set('lowStock')} />
              </Field>
            )}
            <Field label="Unit">
              <Input value={f.unit} onChange={set('unit')} placeholder="pc, pack, sachet…" />
            </Field>
          </div>
          <Field label="Barcode (optional)">
            <Input value={f.barcode} onChange={set('barcode')} inputMode="numeric" />
          </Field>
          {!isNew && tracksStock(product) && <StockHistory productId={product.id} />}
        </form>
      )}

      {mode === 'restock' && <Restock product={product} onDone={onClose} />}
      {mode === 'count' && <StockCount product={product} onDone={onClose} />}
      {confirmDialog}
    </Modal>
  )
}

function Restock({ product, onDone }) {
  const session = useSession()
  const toast = useToast()
  const [qty, setQty] = useState('')
  const [cost, setCost] = useState('')
  const submit = (e) => {
    e.preventDefault()
    const n = parseInt(qty, 10)
    if (!n || n <= 0) return
    changeStock({ product, delta: n, reason: 'restock', newCost: cost, session }).catch((err) =>
      toast(`Restock failed: ${err.code || err.message}`, 'error'),
    )
    toast(`+${n} ${product.name}`)
    onDone()
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-brand-900/70">
        Current stock: <b>{product.stock || 0}</b> {product.unit || 'pc'}
      </p>
      <Field label="Quantity received">
        <Input type="number" inputMode="numeric" min="1" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus required />
      </Field>
      <Field label="New cost per unit (optional)" hint={`Current cost: ${peso(product.cost)}. Leave blank to keep it.`}>
        <Input type="number" inputMode="decimal" step="0.01" min="0" value={cost} onChange={(e) => setCost(e.target.value)} />
      </Field>
      <Button type="submit" size="lg" className="w-full">
        <Icon name="restock" /> Add to stock
      </Button>
    </form>
  )
}

function StockCount({ product, onDone }) {
  const session = useSession()
  const toast = useToast()
  const [count, setCount] = useState('')
  const [note, setNote] = useState('')
  const delta = count === '' ? 0 : parseInt(count, 10) - (product.stock || 0)
  const submit = (e) => {
    e.preventDefault()
    if (count === '' || delta === 0) return onDone()
    changeStock({ product, delta, reason: 'count', note, session }).catch((err) =>
      toast(`Update failed: ${err.code || err.message}`, 'error'),
    )
    toast(`${product.name} stock set to ${count}`)
    onDone()
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-brand-900/70">
        Use this after a physical count, or to record spoiled / expired / lost items. System says{' '}
        <b>{product.stock || 0}</b>.
      </p>
      <Field label="Actual count on the shelf">
        <Input type="number" inputMode="numeric" min="0" value={count} onChange={(e) => setCount(e.target.value)} autoFocus required />
      </Field>
      {count !== '' && delta !== 0 && (
        <p className={cx('text-sm font-semibold', delta < 0 ? 'text-red-600' : 'text-emerald-700')}>
          {delta > 0 ? '+' : ''}
          {delta} {product.unit || 'pc'}
          {delta < 0 && product.cost ? ` (loss of ${peso(-delta * product.cost)} at cost)` : ''}
        </p>
      )}
      <Field label="Reason (optional)">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. expired, damaged, miscount" />
      </Field>
      <Button type="submit" size="lg" className="w-full">
        Save count
      </Button>
    </form>
  )
}

function StockHistory({ productId }) {
  const moves =
    useLive(
      query(collection(db, 'stockMoves'), where('productId', '==', productId), orderBy('createdAt', 'desc'), limit(8)),
      [productId],
    ).data || []
  if (!moves.length) return null
  const label = { restock: 'Restock', count: 'Count', initial: 'Starting stock' }
  return (
    <div className="pt-2">
      <p className="mb-1 text-sm font-semibold text-brand-900/80">Recent stock changes</p>
      <div className="divide-y divide-brand-200/60 rounded-xl bg-brand-50 text-sm">
        {moves.map((m) => (
          <div key={m.id} className="flex items-center justify-between px-3 py-2">
            <span>
              {label[m.reason] || m.reason}
              {m.note ? ` · ${m.note}` : ''}
              <span className="block text-xs text-brand-900/50">
                {fmtDateTime(m.createdAt)} · {m.byName}
              </span>
            </span>
            <span className={cx('font-semibold', m.delta < 0 ? 'text-red-600' : 'text-emerald-700')}>
              {m.delta > 0 ? '+' : ''}
              {m.delta}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StarterImport({ existing, onClose }) {
  const session = useSession()
  const toast = useToast()
  const have = useMemo(() => new Set(existing.map((p) => p.name.toLowerCase())), [existing])
  const available = STARTER_PRODUCTS.filter((p) => !have.has(p.name.toLowerCase()))
  const [picked, setPicked] = useState(() => new Set(available.map((p) => p.name)))
  const [stock, setStock] = useState('0')
  const groups = useMemo(() => {
    const m = new Map()
    for (const p of available) m.set(p.category, [...(m.get(p.category) || []), p])
    return [...m.entries()]
  }, [available])

  const toggle = (names, on) =>
    setPicked((s) => {
      const n = new Set(s)
      names.forEach((x) => (on ? n.add(x) : n.delete(x)))
      return n
    })

  const submit = () => {
    const items = available.filter((p) => picked.has(p.name))
    if (!items.length) return
    importProducts({ items, stock, session }).catch((err) => toast(`Import failed: ${err.code || err.message}`, 'error'))
    toast(`${items.length} products added`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Starter products"
      footer={
        available.length ? (
          <div className="space-y-2 pb-2">
            <Field label="Starting stock for each" hint="Leave 0 and use Restock / Stock count later, or set a number to start selling right away.">
              <Input type="number" inputMode="numeric" min="0" value={stock} onChange={(e) => setStock(e.target.value)} />
            </Field>
            <Button size="lg" className="w-full" disabled={!picked.size} onClick={submit}>
              Add {picked.size} product{picked.size === 1 ? '' : 's'}
            </Button>
          </div>
        ) : null
      }
    >
      {available.length === 0 ? (
        <p className="text-brand-900/70">All starter products are already in your inventory.</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-brand-900/70">
            Popular Pinoy snacks and drinks with typical 2026 sari-sari prices, plus your JacqueNgel cafe menu. Untick
            what you don’t sell. You can edit any price afterwards.
          </p>
          {groups.map(([cat, items]) => {
            const all = items.every((p) => picked.has(p.name))
            return (
              <div key={cat} className="mb-4">
                <div className="mb-1 flex items-center justify-between">
                  <p className="font-semibold text-brand-900">{cat}</p>
                  <button
                    className="text-sm font-medium text-brand-600"
                    onClick={() => toggle(items.map((p) => p.name), !all)}
                  >
                    {all ? 'Untick all' : 'Tick all'}
                  </button>
                </div>
                <div className="divide-y divide-brand-200/60 rounded-xl ring-1 ring-brand-200/70">
                  {items.map((p) => (
                    <label key={p.name} className="flex cursor-pointer items-center gap-3 px-3 py-2">
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-brand-700"
                        checked={picked.has(p.name)}
                        onChange={(e) => toggle([p.name], e.target.checked)}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                      <span className="text-right text-xs text-brand-900/60">
                        <b className="text-sm text-brand-900">{peso(p.price)}</b>
                        <br />
                        {p.madeToOrder ? 'made to order' : `cost ${peso(p.cost)}`}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </>
      )}
    </Modal>
  )
}
