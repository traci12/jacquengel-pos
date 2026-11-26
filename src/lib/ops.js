import { collection, doc, increment, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { dayKey, r2, tracksStock } from './format'

/**
 * All writes go through batches (not transactions) so they work offline:
 * the phone applies them locally right away and syncs when back online.
 * The returned `done` promise resolves once the server has the data.
 */

const who = (session) => ({
  by: session.user.uid,
  byName: session.profile.name || session.user.email,
})

export function createSale({ cart, payment, cashReceived, customer, paidNow, session }) {
  const batch = writeBatch(db)
  const saleRef = doc(collection(db, 'sales'))

  const items = cart.map(({ product, qty }) => ({
    productId: product.id,
    name: product.name,
    qty,
    price: r2(product.price),
    cost: r2(product.cost || 0),
    ...(tracksStock(product) ? {} : { madeToOrder: true }),
    subtotal: r2(product.price * qty),
  }))
  const total = r2(items.reduce((s, i) => s + i.subtotal, 0))
  const costTotal = r2(items.reduce((s, i) => s + i.cost * i.qty, 0))

  let creditAmount = 0
  let customerId = null
  let customerName = null
  let paid = total
  let change = 0

  if (payment === 'utang') {
    paid = Math.min(r2(paidNow || 0), total)
    creditAmount = r2(total - paid)
  } else {
    change = r2((cashReceived || total) - total)
  }

  if (payment === 'utang' && creditAmount > 0) {
    const customerRef = customer.id ? doc(db, 'customers', customer.id) : doc(collection(db, 'customers'))
    customerId = customerRef.id
    customerName = customer.name.trim()
    if (customer.id) {
      batch.update(customerRef, {
        balance: increment(creditAmount),
        updatedAt: serverTimestamp(),
        lastActivity: serverTimestamp(),
      })
    } else {
      batch.set(customerRef, {
        name: customerName,
        nameLower: customerName.toLowerCase(),
        phone: customer.phone || '',
        balance: creditAmount,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastActivity: serverTimestamp(),
      })
    }
    batch.set(doc(collection(customerRef, 'ledger')), {
      type: 'credit',
      amount: creditAmount,
      saleId: saleRef.id,
      note: items.map((i) => `${i.qty}× ${i.name}`).join(', ').slice(0, 300),
      ...who(session),
      createdAt: serverTimestamp(),
      clientAt: Date.now(),
    })
  }

  const sale = {
    items,
    itemCount: items.reduce((s, i) => s + i.qty, 0),
    total,
    costTotal,
    profit: r2(total - costTotal),
    payment,
    cashReceived: payment === 'cash' ? r2(cashReceived || total) : r2(paid),
    change,
    paid: r2(paid),
    creditAmount,
    customerId,
    customerName,
    cashierUid: session.user.uid,
    cashierName: session.profile.name || session.user.email,
    day: dayKey(),
    voided: false,
    createdAt: serverTimestamp(),
    clientAt: Date.now(),
  }
  batch.set(saleRef, sale)

  for (const i of items) {
    if (i.madeToOrder) continue
    batch.update(doc(db, 'products', i.productId), {
      stock: increment(-i.qty),
      updatedAt: serverTimestamp(),
    })
  }

  const done = batch.commit()
  return { saleId: saleRef.id, sale: { ...sale, id: saleRef.id, createdAt: new Date() }, done }
}

export function voidSale({ sale, productIds, session, reason }) {
  const batch = writeBatch(db)
  batch.update(doc(db, 'sales', sale.id), {
    voided: true,
    voidReason: reason || '',
    voidedBy: session.user.uid,
    voidedAt: serverTimestamp(),
  })
  for (const i of sale.items) {
    if (!productIds.has(i.productId) || i.madeToOrder) continue
    batch.update(doc(db, 'products', i.productId), {
      stock: increment(i.qty),
      updatedAt: serverTimestamp(),
    })
  }
  if (sale.creditAmount > 0 && sale.customerId) {
    const cRef = doc(db, 'customers', sale.customerId)
    batch.update(cRef, { balance: increment(-sale.creditAmount), updatedAt: serverTimestamp() })
    batch.set(doc(collection(cRef, 'ledger')), {
      type: 'void',
      amount: sale.creditAmount,
      saleId: sale.id,
      note: `Sale voided${reason ? `: ${reason}` : ''}`,
      ...who(session),
      createdAt: serverTimestamp(),
      clientAt: Date.now(),
    })
  }
  return batch.commit()
}

export function recordPayment({ customer, amount, note, session }) {
  const batch = writeBatch(db)
  const cRef = doc(db, 'customers', customer.id)
  batch.update(cRef, {
    balance: increment(-r2(amount)),
    updatedAt: serverTimestamp(),
    lastActivity: serverTimestamp(),
  })
  batch.set(doc(collection(cRef, 'ledger')), {
    type: 'payment',
    amount: r2(amount),
    note: note || '',
    ...who(session),
    createdAt: serverTimestamp(),
    clientAt: Date.now(),
  })
  return batch.commit()
}

export function saveProduct({ product, data, session }) {
  const batch = writeBatch(db)
  const ref = product?.id ? doc(db, 'products', product.id) : doc(collection(db, 'products'))
  const clean = {
    name: data.name.trim(),
    nameLower: data.name.trim().toLowerCase(),
    category: (data.category || 'Others').trim(),
    price: r2(data.price),
    cost: r2(data.cost),
    lowStock: Number(data.lowStock) || 0,
    barcode: (data.barcode || '').trim(),
    unit: (data.unit || 'pc').trim(),
    madeToOrder: !!data.madeToOrder,
    updatedAt: serverTimestamp(),
  }
  if (product?.id) {
    batch.update(ref, clean)
  } else {
    const stock = data.madeToOrder ? 0 : Number(data.stock) || 0
    batch.set(ref, { ...clean, stock, createdAt: serverTimestamp() })
    if (stock) {
      batch.set(doc(collection(db, 'stockMoves')), {
        productId: ref.id,
        name: clean.name,
        delta: stock,
        reason: 'initial',
        ...who(session),
        createdAt: serverTimestamp(),
      })
    }
  }
  return batch.commit()
}

/** Adds many products at once (each with the same starting stock). */
export function importProducts({ items, stock, session }) {
  const batch = writeBatch(db)
  const qty = Math.max(0, parseInt(stock, 10) || 0)
  for (const p of items) {
    const ref = doc(collection(db, 'products'))
    batch.set(ref, {
      name: p.name,
      nameLower: p.name.toLowerCase(),
      category: p.category,
      price: r2(p.price),
      cost: r2(p.cost),
      lowStock: p.lowStock,
      unit: p.unit,
      barcode: '',
      madeToOrder: !!p.madeToOrder,
      stock: p.madeToOrder ? 0 : qty,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    if (qty && !p.madeToOrder) {
      batch.set(doc(collection(db, 'stockMoves')), {
        productId: ref.id,
        name: p.name,
        delta: qty,
        reason: 'initial',
        ...who(session),
        createdAt: serverTimestamp(),
      })
    }
  }
  return batch.commit()
}

export function changeStock({ product, delta, reason, newCost, note, session }) {
  const batch = writeBatch(db)
  const update = { stock: increment(delta), updatedAt: serverTimestamp() }
  if (newCost != null && newCost !== '' && !Number.isNaN(Number(newCost))) update.cost = r2(newCost)
  batch.update(doc(db, 'products', product.id), update)
  batch.set(doc(collection(db, 'stockMoves')), {
    productId: product.id,
    name: product.name,
    delta,
    reason,
    note: note || '',
    ...who(session),
    createdAt: serverTimestamp(),
  })
  return batch.commit()
}
