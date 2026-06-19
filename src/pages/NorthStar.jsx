import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { weeksSince } from '../lib/weekUtils'

export default function NorthStar() {
  const { user, profile, refreshProfile } = useAuth()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (user) fetchHistory()
  }, [user])

  async function fetchHistory() {
    const { data } = await supabase
      .from('north_star_history')
      .select('*')
      .eq('user_id', user.id)
      .order('recorded_at', { ascending: false })
    setHistory(data || [])
  }

  async function handleSave() {
    if (!draft.trim()) return
    setSaveError('')
    setLoading(true)
    const { error } = await supabase.from('users').update({ north_star: draft.trim() }).eq('id', user.id)
    if (error) { setSaveError(error.message || 'Could not save.'); setLoading(false); return }
    await supabase.from('north_star_history').insert({ user_id: user.id, north_star: draft.trim() })
    await refreshProfile()
    fetchHistory()
    setLoading(false)
    setEditing(false)
    setConfirm(false)
  }

  const weeks = weeksSince(profile?.created_at)

  return (
    <div>
      {/* Hero card */}
      <div
        className="rounded-2xl overflow-hidden shadow-card-md mb-6 relative"
        style={{ background: 'linear-gradient(135deg, #1A0A10 0%, #4A1228 60%, #6B1E3A 100%)', minHeight: 220 }}
      >
        {/* Decorative star burst */}
        <div className="absolute top-6 right-6 opacity-15 pointer-events-none select-none" aria-hidden>
          <svg width="90" height="90" viewBox="0 0 90 90" fill="none">
            <path d="M45 5 L48.5 38.5 L82 45 L48.5 51.5 L45 85 L41.5 51.5 L8 45 L41.5 38.5 Z" fill="white"/>
            <path d="M45 18 L46.8 41.2 L70 45 L46.8 48.8 L45 72 L43.2 48.8 L20 45 L43.2 41.2 Z" fill="white" opacity="0.4"/>
          </svg>
        </div>

        {/* Subtle grid texture */}
        <div className="absolute inset-0 pointer-events-none opacity-5" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

        <div className="relative px-6 pt-7 pb-6">
          <p className="text-[10px] font-medium uppercase tracking-widest text-cream/50 mb-5">✦ Your North Star</p>

          {editing ? (
            <div className="space-y-3">
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                rows={4}
                autoFocus
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-cream text-base font-serif italic resize-none focus:outline-none focus:border-white/40 placeholder-cream/40"
                placeholder="The honest motivation behind everything you're working on…"
              />
              {confirm ? (
                <div className="bg-white/10 border border-white/15 rounded-xl p-3 text-xs text-cream/70">
                  Updating your North Star resets the drift baseline. Your old one is saved in history.
                  {saveError && <p className="mt-1 text-red-300">{saveError}</p>}
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => setConfirm(false)} className="flex-1 py-2 bg-white/10 text-cream/70 rounded-[10px] text-xs font-medium border border-white/10">
                      Go back
                    </button>
                    <button onClick={handleSave} disabled={loading} className="flex-1 py-2 bg-cream text-burg-deep rounded-[10px] text-xs font-medium hover:bg-cream2 transition-colors disabled:opacity-50">
                      {loading ? 'Saving…' : 'Yes, update it'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="flex-1 py-2.5 bg-white/10 text-cream/70 rounded-[10px] text-sm font-medium border border-white/10">
                    Cancel
                  </button>
                  <button onClick={() => setConfirm(true)} disabled={!draft.trim()} className="flex-1 py-2.5 bg-cream text-burg-deep rounded-[10px] text-sm font-medium hover:bg-cream2 transition-colors disabled:opacity-50">
                    Save
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <p className="font-serif italic text-cream text-[22px] leading-relaxed mb-6 max-w-lg">
                {profile?.north_star ? `"${profile.north_star}"` : (
                  <span className="text-cream/40 not-italic text-lg">Not set yet. What's the honest reason behind everything you're working toward?</span>
                )}
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {weeks > 0 && (
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-serif text-cream leading-none">{weeks}</span>
                      <span className="text-xs text-cream/50">weeks in</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { setDraft(profile?.north_star || ''); setEditing(true) }}
                  className="text-xs text-cream/60 hover:text-cream border border-cream/20 hover:border-cream/40 px-3 py-1.5 rounded-full transition-colors"
                >
                  {profile?.north_star ? 'Edit' : 'Set yours'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* What is a North Star */}
      {!profile?.north_star && (
        <div className="bg-white border border-border rounded-2xl shadow-card p-6 mb-5">
          <p className="text-[11px] font-medium text-text3 uppercase tracking-widest mb-3">What makes a good North Star?</p>
          <div className="space-y-2 text-sm text-text2 leading-relaxed">
            <p className="flex gap-2"><span className="text-burg mt-0.5">✦</span> It's honest — not what sounds good, what's actually true.</p>
            <p className="flex gap-2"><span className="text-burg mt-0.5">✦</span> It's emotional — it touches on identity, not just achievement.</p>
            <p className="flex gap-2"><span className="text-burg mt-0.5">✦</span> It stays stable — weeks go by, your North Star shouldn't waver.</p>
          </div>
          <div className="mt-4 bg-cream2 rounded-xl p-3 space-y-1">
            <p className="text-xs text-text3 italic">"Feel in control of my health before I start my career."</p>
            <p className="text-xs text-text3 italic">"Prove to myself I can finish something I start."</p>
            <p className="text-xs text-text3 italic">"Be someone my kids can look up to."</p>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div>
          <h2 className="font-serif text-lg text-text mb-3">History</h2>
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={h.id} className="bg-white border border-border rounded-2xl shadow-card px-5 py-4 flex gap-4 items-start">
                <div className="flex-shrink-0 mt-1">
                  <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-burg' : 'bg-border'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text italic font-serif leading-relaxed">"{h.north_star}"</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[11px] text-text3">
                    {new Date(h.recorded_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </p>
                  {i === 0 && <p className="text-[10px] text-burg font-medium uppercase tracking-wide mt-0.5">Current</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
