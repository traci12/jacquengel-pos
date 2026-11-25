import { useEffect, useState } from 'react'
import { Button, Icon } from './ui'

const DISMISS_KEY = 'install-dismissed-at'
const SNOOZE_DAYS = 3

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

const snoozed = () => {
  const at = Number(localStorage.getItem(DISMISS_KEY) || 0)
  return Date.now() - at < SNOOZE_DAYS * 86400000
}

/**
 * Shows an "Install app" banner when the site is opened in a browser.
 * Android/Chrome/Edge: the Install button opens the browser's own install prompt.
 * iPhone/iPad: shows the Share → Add to Home Screen steps (Safari has no prompt).
 */
export default function InstallBanner() {
  const [deferred, setDeferred] = useState(() => window.__installPrompt || null)
  const [hidden, setHidden] = useState(() => isStandalone() || snoozed())
  const [showIOSHelp, setShowIOSHelp] = useState(false)

  useEffect(() => {
    const onPrompt = () => setDeferred(window.__installPrompt)
    const onInstalled = () => setHidden(true)
    window.addEventListener('installprompt-ready', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('installprompt-ready', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const ios = isIOS()
  if (hidden || (!deferred && !ios)) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setHidden(true)
  }

  const install = async () => {
    if (ios) return setShowIOSHelp(true)
    deferred.prompt()
    const { outcome } = await deferred.userChoice
    window.__installPrompt = null
    setDeferred(null)
    if (outcome === 'accepted') setHidden(true)
    else dismiss()
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[55] px-3 pt-[max(env(safe-area-inset-top),0.5rem)]">
      <div className="animate-sheet mx-auto max-w-md rounded-2xl bg-white p-3 shadow-2xl ring-1 ring-brand-200">
        <div className="flex items-center gap-3">
          <img src="/logo-192.png" alt="" className="h-11 w-11 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-tight text-brand-900">Install JacqueNgel POS</p>
            <p className="text-xs text-brand-900/60">Opens like an app from your home screen, even offline.</p>
          </div>
          <button onClick={dismiss} className="rounded-full p-1.5 text-brand-400 hover:bg-brand-50" aria-label="Not now">
            <Icon name="x" size={18} />
          </button>
        </div>

        {showIOSHelp ? (
          <ol className="mt-3 space-y-1.5 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
            <li>
              1. Tap the <b>Share</b> button <ShareIcon /> in Safari’s toolbar.
            </li>
            <li>
              2. Scroll down and tap <b>Add to Home Screen</b>.
            </li>
            <li>
              3. Tap <b>Add</b>.
            </li>
          </ol>
        ) : (
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={dismiss}>
              Not now
            </Button>
            <Button size="sm" className="flex-1" onClick={install}>
              {ios ? 'Show me how' : 'Install'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline -mt-1 text-sky-600">
      <path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
