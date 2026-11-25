import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

const cx = (...c) => c.filter(Boolean).join(' ')

export function Button({ variant = 'primary', size = 'md', className, ...props }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none'
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2.5', lg: 'px-5 py-3.5 text-lg' }
  const variants = {
    primary: 'bg-brand-700 text-white hover:bg-brand-800',
    secondary: 'bg-brand-100 text-brand-800 hover:bg-brand-200',
    outline: 'border border-brand-300 text-brand-800 bg-white hover:bg-brand-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-brand-700 hover:bg-brand-100',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  }
  return <button className={cx(base, sizes[size], variants[variant], className)} {...props} />
}

export function Field({ label, hint, children, className }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="mb-1 block text-sm font-medium text-brand-900/80">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-xs text-brand-900/50">{hint}</span>}
    </label>
  )
}

export function Input(props) {
  return <input {...props} className={cx('field', props.className)} />
}

export function Select({ children, ...props }) {
  return (
    <select {...props} className={cx('field appearance-none', props.className)}>
      {children}
    </select>
  )
}

/** Bottom sheet on phones, centered dialog on larger screens. */
export function Modal({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className={cx(
          'animate-sheet flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-brand-100 px-5 py-4">
          <h2 className="font-display text-lg font-bold text-brand-900">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-brand-700 hover:bg-brand-100" aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="pb-safe border-t border-brand-100 px-5 pt-3">{footer}</div>}
      </div>
    </div>
  )
}

export function Empty({ icon = 'box', title, children }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center text-brand-900/60">
      <div className="mb-3 rounded-full bg-brand-100 p-4 text-brand-600">
        <Icon name={icon} size={28} />
      </div>
      <p className="font-semibold text-brand-900">{title}</p>
      {children && <div className="mt-1 text-sm">{children}</div>}
    </div>
  )
}

export function Badge({ tone = 'neutral', children }) {
  const tones = {
    neutral: 'bg-brand-100 text-brand-800',
    low: 'bg-amber-100 text-amber-800',
    out: 'bg-red-100 text-red-700',
    ok: 'bg-emerald-100 text-emerald-700',
    info: 'bg-sky-100 text-sky-700',
  }
  return <span className={cx('rounded-full px-2 py-0.5 text-xs font-semibold', tones[tone])}>{children}</span>
}

export function SearchBox({ value, onChange, placeholder = 'Search…', autoFocus }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-400">
        <Icon name="search" size={18} />
      </span>
      <input
        className="field pl-10"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        type="search"
      />
    </div>
  )
}

const ICONS = {
  cart: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13 5.4 5M7 13l-2.3 2.3c-.6.6-.2 1.7.7 1.7H17m0 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm-8 2a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  box: 'M20 7 12 3 4 7m16 0-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  users: 'M17 20h5v-2a3 3 0 0 0-5.4-1.9M17 20H7m10 0v-2c0-.7-.1-1.3-.4-1.9M7 20H2v-2a3 3 0 0 1 5.4-1.9M7 20v-2c0-.7.1-1.3.4-1.9m0 0a5 5 0 0 1 9.2 0M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  chart: 'M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2Zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2Z',
  cog: 'M10.3 4.3c.4-1.8 3-1.8 3.4 0a1.7 1.7 0 0 0 2.6 1c1.5-.9 3.3.8 2.4 2.4a1.7 1.7 0 0 0 1 2.6c1.8.4 1.8 3 0 3.4a1.7 1.7 0 0 0-1 2.6c.9 1.5-.8 3.3-2.4 2.4a1.7 1.7 0 0 0-2.6 1c-.4 1.8-3 1.8-3.4 0a1.7 1.7 0 0 0-2.6-1c-1.5.9-3.3-.8-2.4-2.4a1.7 1.7 0 0 0-1-2.6c-1.8-.4-1.8-3 0-3.4a1.7 1.7 0 0 0 1-2.6c-.9-1.5.8-3.3 2.4-2.4 1 .6 2.3.1 2.6-1ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  plus: 'M12 4v16m8-8H4',
  minus: 'M20 12H4',
  x: 'M6 18 18 6M6 6l12 12',
  search: 'm21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  trash: 'm19 7-.9 12.1A2 2 0 0 1 16.1 21H7.9a2 2 0 0 1-2-1.9L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16',
  edit: 'M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.4-9.6a2 2 0 1 1 2.8 2.8L11.8 15H9v-2.8l8.6-8.6Z',
  check: 'm5 13 4 4L19 7',
  alert: 'M12 9v2m0 4h.01M5.1 19h13.8c1.5 0 2.5-1.7 1.7-3L13.7 4c-.8-1.3-2.6-1.3-3.4 0L3.4 16c-.8 1.3.2 3 1.7 3Z',
  logout: 'M17 16l4-4m0 0-4-4m4 4H7m6 4v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1',
  wallet: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3Z',
  receipt: 'M9 14l2 2 4-4m5 9V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v16l4-2 4 2 4-2 4 2Z',
  restock: 'M4 4v5h.6m15.4 2A8 8 0 0 0 4.6 9m0 0H9m11 11v-5h-.6m0 0a8 8 0 0 1-15.4-2m15.4 2H15',
  wifiOff: 'M3 3l18 18M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.2-2.7M12 20h.01M1.4 9a15 15 0 0 1 4.3-2.6m6.3-.4a15 15 0 0 1 10.6 3',
  chevron: 'm9 5 7 7-7 7',
}

export function Icon({ name, size = 20, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={ICONS[name] || ICONS.box} />
    </svg>
  )
}

/* ─── Toasts ─────────────────────────────────────────────────────────────── */

const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)
  const push = useCallback((message, tone = 'ok') => {
    const id = ++idRef.current
    setToasts((t) => [...t, { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 2800)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              'animate-sheet pointer-events-auto max-w-sm rounded-2xl px-4 py-3 text-sm font-medium shadow-lg',
              t.tone === 'error' ? 'bg-red-600 text-white' : 'bg-brand-900 text-white',
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/** Use when the user must confirm something destructive. */
export function useConfirm() {
  const [state, setState] = useState(null)
  const confirm = (opts) => new Promise((resolve) => setState({ ...opts, resolve }))
  const close = (v) => {
    state?.resolve(v)
    setState(null)
  }
  const dialog = (
    <Modal
      open={!!state}
      onClose={() => close(false)}
      title={state?.title || 'Are you sure?'}
      footer={
        <div className="flex gap-2 pb-2">
          <Button variant="outline" className="flex-1" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button variant={state?.danger ? 'danger' : 'primary'} className="flex-1" onClick={() => close(true)}>
            {state?.confirmText || 'Confirm'}
          </Button>
        </div>
      }
    >
      <p className="text-brand-900/80">{state?.message}</p>
    </Modal>
  )
  return [confirm, dialog]
}

export { cx }
