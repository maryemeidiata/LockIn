import { useState } from 'react'

export default function NotificationBanner({ onEnable, onDismiss }) {
  const [loading, setLoading] = useState(false)

  async function handleEnable() {
    setLoading(true)
    await onEnable()
    setLoading(false)
  }

  return (
    <div className="flex items-center gap-3 bg-white border border-border rounded-xl px-4 py-3 shadow-card">
      <div className="w-8 h-8 rounded-full bg-cream2 flex items-center justify-center flex-shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-burg">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text">Enable notifications</p>
        <p className="text-xs text-text3 leading-snug">Daily check-in reminders + friend nudges</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onDismiss}
          className="text-xs text-text3 hover:text-text2 transition-colors px-2 py-1"
        >
          Not now
        </button>
        <button
          onClick={handleEnable}
          disabled={loading}
          className="px-3 py-1.5 bg-burg text-cream text-xs font-medium rounded-[8px] hover:bg-burg-light transition-colors disabled:opacity-50"
        >
          {loading ? 'Enabling…' : 'Enable'}
        </button>
      </div>
    </div>
  )
}
