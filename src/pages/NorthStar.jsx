import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { weeksSince } from '../lib/weekUtils'

export default function NorthStar() {
  const { user, profile, refreshProfile } = useAuth()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [history, setHistory] = useState([])
  const [driftInsight, setDriftInsight] = useState(null)
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState(false)

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

    const { data: drift } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('user_id', user.id)
      .eq('insight_type', 'drift')
      .order('created_at', { ascending: false })
      .limit(1)
    if (drift?.length) setDriftInsight(drift[0])
  }

  async function handleSave() {
    if (!draft.trim()) return
    setLoading(true)
    const { error } = await supabase
      .from('users')
      .update({ north_star: draft.trim() })
      .eq('id', user.id)
    if (!error) {
      // history table is optional — ignore if it doesn't exist
      await supabase.from('north_star_history').insert({ user_id: user.id, north_star: draft.trim() })
      await refreshProfile()
      fetchHistory()
    }
    setLoading(false)
    setEditing(false)
    setConfirm(false)
  }

  const weeks = weeksSince(profile?.created_at)

  return (
    <div className="max-w-xl">
      <h1 className="font-serif text-[26px] text-text tracking-tight mb-6">North Star</h1>

      {/* Current North Star */}
      <div className="bg-white border border-border rounded-xl shadow-card p-6 mb-5">
        <p className="text-[10px] font-medium text-burg uppercase tracking-widest mb-3">Your North Star</p>
        {editing ? (
          <div className="space-y-3">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={3}
              className="w-full border border-border rounded-xl px-4 py-3 text-base text-text resize-none focus:outline-none focus:border-burg"
            />
            {confirm ? (
              <div className="bg-cream2 border border-border rounded-xl p-3 text-xs text-text2">
                Updating your North Star will reset the drift detection baseline. Your old one is saved in history.
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setConfirm(false)} className="flex-1 py-2 bg-cream3 text-text2 rounded-[10px] border border-border text-xs font-medium">
                    Go back
                  </button>
                  <button onClick={handleSave} disabled={loading} className="flex-1 py-2 bg-burg text-cream rounded-[10px] text-xs font-medium hover:bg-burg-light transition-colors disabled:opacity-50">
                    {loading ? 'Saving...' : 'Yes, update it'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="flex-1 py-2 bg-cream2 text-text2 rounded-[10px] border border-border text-sm font-medium">
                  Cancel
                </button>
                <button onClick={() => setConfirm(true)} disabled={!draft.trim()} className="flex-1 py-2 bg-burg text-cream rounded-[10px] text-sm font-medium hover:bg-burg-light transition-colors disabled:opacity-50">
                  Save
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="font-serif italic text-xl text-text leading-relaxed mb-4">
              {profile?.north_star || 'Not set yet.'}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-text3">{weeks} weeks in</span>
              <button
                onClick={() => { setDraft(profile?.north_star || ''); setEditing(true) }}
                className="text-xs font-medium text-burg hover:underline"
              >
                Edit
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Drift alert */}
      {driftInsight && (
        <div className="bg-cream2 border border-border rounded-xl p-4 mb-5" style={{ borderLeft: '3px solid var(--burg-muted)' }}>
          <p className="text-xs font-medium text-text2 uppercase tracking-wider mb-1">Drift detected</p>
          <p className="text-sm text-text2 leading-relaxed">{driftInsight.insight_text}</p>
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div>
          <h2 className="font-serif text-lg text-text mb-3">History</h2>
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={h.id} className="bg-white border border-border rounded-xl shadow-card px-4 py-3 flex gap-4">
                <div className="flex-1">
                  <p className="text-sm text-text italic font-serif">{h.north_star}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[11px] text-text3">
                    {new Date(h.recorded_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </p>
                  {i === 0 && <p className="text-[9px] text-burg font-medium uppercase tracking-wide mt-0.5">Current</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
