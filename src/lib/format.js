const pesoFmt = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
})

export const peso = (n) => pesoFmt.format(Number(n) || 0)

/** Round to centavos to avoid floating point drift. */
export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100

export const TZ = 'Asia/Manila'

/** YYYY-MM-DD in Manila time. */
export const dayKey = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: TZ })

export const toDate = (v) => {
  if (!v) return null
  if (v instanceof Date) return v
  if (typeof v.toDate === 'function') return v.toDate()
  if (typeof v === 'number') return new Date(v)
  return null
}

export const fmtDateTime = (v) => {
  const d = toDate(v)
  if (!d) return '—'
  return d.toLocaleString('en-PH', {
    timeZone: TZ,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export const fmtDay = (key) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-PH', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** Start of the given Manila day, as a JS Date. */
export const startOfManilaDay = (daysAgo = 0) => {
  const key = dayKey(new Date(Date.now() - daysAgo * 86400000))
  return new Date(`${key}T00:00:00+08:00`)
}

export const startOfManilaMonth = () => {
  const key = dayKey()
  return new Date(`${key.slice(0, 8)}01T00:00:00+08:00`)
}

/** Cafe drinks/food are made to order: no stock counting, never "out of stock". */
export const tracksStock = (p) => !p?.madeToOrder

export const shortId = (id) => (id || '').slice(-6).toUpperCase()

export const CATEGORY_SUGGESTIONS = [
  'Beverages',
  'Coffee & Milk',
  'Snacks',
  'Noodles',
  'Canned Goods',
  'Rice & Grains',
  'Condiments',
  'Bread',
  'Frozen',
  'Toiletries',
  'Household',
  'Cigarettes',
  'Others',
]
