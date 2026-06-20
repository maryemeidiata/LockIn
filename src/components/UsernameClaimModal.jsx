import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function UsernameClaimModal({ onSkip }) {
  const { user, refreshProfile } = useAuth()
  const [username, setUsername] = useState('')
  const [status, setStatus] = useState('idle') // idle | checking | available | taken | invalid
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!username) { setStatus('idle'); return }
    if (username.length < 3 || !/^[a-z0-9_]+$/.test(username)) { setStatus('invalid'); return }
    setStatus('checking')
    const t = setTimeout(async () => {
      const { data } = await supabase.from('users').select('id').eq('username', username).maybeSingle()
      setStatus(data ? 'taken' : 'available')
    }, 400)
    return () => clearTimeout(t)
  }, [username])

  async function handleSave() {
    if (status !== 'available' || loading) return
    setLoading(true)
    await supabase.from('users').update({ username }).eq('id', user.id)
    await refreshProfile()
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(26,10,16,0.7)' }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 page-fade">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 font-serif text-2xl font-light text-burg" style={{ background: 'rgba(107,30,58,0.08)' }}>
            @
          </div>
          <h2 className="font-serif text-[24px] text-text mb-1">Claim your @handle</h2>
          <p className="text-sm text-text3 leading-relaxed">A unique handle lets friends find and invite you to groups by name.</p>
        </div>

        <div className="relative mb-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text2 font-medium text-sm select-none">@</span>
          <input
            value={username}
            onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
            placeholder="yourhandle"
            autoFocus
            className="w-full border border-border rounded-xl pl-8 pr-10 py-3.5 text-base text-text bg-white focus:outline-none focus:border-burg placeholder-text3"
          />
          {status === 'checking' && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-burg border-t-transparent rounded-full animate-spin" />
          )}
          {status === 'available' && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-green-600 font-semibold text-sm">✓</span>
          )}
          {(status === 'taken' || status === 'invalid') && username.length > 0 && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-burg font-semibold text-sm">✗</span>
          )}
        </div>

        <p className={`text-xs mb-5 min-h-[16px] transition-colors ${status === 'available' ? 'text-green-600' : status === 'taken' ? 'text-burg' : 'text-text3'}`}>
          {status === 'idle' && 'Letters, numbers, and _ only. 3–20 characters.'}
          {status === 'checking' && 'Checking availability…'}
          {status === 'available' && `@${username} is available!`}
          {status === 'taken' && 'That handle is taken. Try another.'}
          {status === 'invalid' && username.length > 0 && 'Letters, numbers, and _ only. At least 3 characters.'}
        </p>

        <button
          onClick={handleSave}
          disabled={status !== 'available' || loading}
          className="w-full py-3 bg-burg text-cream font-medium rounded-[10px] hover:bg-burg-light transition-colors disabled:opacity-50 mb-2"
        >
          {loading ? 'Saving…' : 'Claim @handle'}
        </button>
        <button
          onClick={onSkip}
          className="w-full py-2 text-xs text-text3 hover:text-text2 transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}
