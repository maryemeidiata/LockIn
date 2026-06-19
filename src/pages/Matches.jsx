import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getCurrentWeekStartStr } from '../lib/weekUtils'
import Avatar from '../components/ui/Avatar'
import CardTag from '../components/ui/CardTag'
import LoadingPulse from '../components/ui/LoadingPulse'
import { generateMatchReason } from '../lib/ai'

export default function Matches() {
  const { user, profile } = useAuth()
  const [currentMatch, setCurrentMatch] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [freshMatch, setFreshMatch] = useState(false)
  const [noPool, setNoPool] = useState(false)

  useEffect(() => {
    if (user) init()
  }, [user])

  async function init() {
    setLoading(true)
    const existing = await fetchMatches()
    setLoading(false)
    if (!existing) generateMatch()
  }

  async function fetchMatches() {
    const weekStart = getCurrentWeekStartStr()
    const { data: matches } = await supabase
      .from('matches')
      .select('*')
      .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`)
      .order('week_start', { ascending: false })

    if (!matches?.length) return null

    const enriched = await Promise.all(
      matches.map(async (m) => {
        const otherId = m.user_id_1 === user.id ? m.user_id_2 : m.user_id_1
        const { data: other } = await supabase.from('users').select('*').eq('id', otherId).single()
        const { data: commitment } = await supabase
          .from('commitments')
          .select('commitment_text')
          .eq('user_id', otherId)
          .eq('week_start', m.week_start)
          .maybeSingle()
        return { ...m, other, other_commitment: commitment?.commitment_text }
      })
    )

    const current = enriched.find(m => m.week_start === weekStart)
    setCurrentMatch(current || null)
    setHistory(enriched.filter(m => m.week_start !== weekStart))
    return current || null
  }

  async function generateMatch() {
    setGenerating(true)
    setNoPool(false)
    const weekStart = getCurrentWeekStartStr()

    // Get all group members
    const { data: myGroups } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id)

    if (!myGroups?.length) { setNoPool(true); setGenerating(false); return }

    const groupIds = myGroups.map(g => g.group_id)

    const { data: members } = await supabase
      .from('group_members')
      .select('user_id, users(id, name, avatar_initials, avatar_url, north_star)')
      .in('group_id', groupIds)
      .neq('user_id', user.id)

    if (!members?.length) { setNoPool(true); setGenerating(false); return }

    // Recent matches to avoid repeats
    const { data: recentMatches } = await supabase
      .from('matches')
      .select('user_id_1, user_id_2')
      .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`)
      .order('week_start', { ascending: false })
      .limit(4)

    const recentIds = new Set(
      (recentMatches || []).map(m => m.user_id_1 === user.id ? m.user_id_2 : m.user_id_1)
    )

    // Get commitments for this week
    const memberIds = [...new Set(members.map(m => m.user_id))]
    const { data: commitments } = await supabase
      .from('commitments')
      .select('user_id, commitment_text')
      .in('user_id', memberIds)
      .eq('week_start', weekStart)

    const commitmentMap = Object.fromEntries((commitments || []).map(c => [c.user_id, c.commitment_text]))

    // Deduplicate members
    const unique = new Map()
    for (const m of members) {
      if (m.users && !unique.has(m.user_id)) {
        unique.set(m.user_id, { ...m.users, commitment: commitmentMap[m.user_id] })
      }
    }

    const all = [...unique.values()]
    // Prefer: has commitment this week + not recently matched
    const preferred = all.filter(c => c.commitment && !recentIds.has(c.id))
    const withCommitment = all.filter(c => c.commitment)
    const notRecent = all.filter(c => !recentIds.has(c.id))
    const pool = preferred.length ? preferred : withCommitment.length ? withCommitment : notRecent.length ? notRecent : all

    if (!pool.length) { setNoPool(true); setGenerating(false); return }

    const pick = pool[Math.floor(Math.random() * pool.length)]

    // Get my own commitment for AI context
    const { data: myCommitment } = await supabase
      .from('commitments')
      .select('commitment_text')
      .eq('user_id', user.id)
      .eq('week_start', weekStart)
      .maybeSingle()

    let reason = ''
    try {
      reason = await generateMatchReason(
        { north_star: profile?.north_star, commitment_text: myCommitment?.commitment_text },
        { north_star: pick.north_star, commitment_text: pick.commitment }
      )
    } catch (_) {}

    const { data: newMatch } = await supabase
      .from('matches')
      .insert({ user_id_1: user.id, user_id_2: pick.id, week_start: weekStart, match_reason: reason || null })
      .select()
      .single()

    if (newMatch) {
      setCurrentMatch({ ...newMatch, other: pick, other_commitment: pick.commitment })
      setFreshMatch(true)
    }

    setGenerating(false)
  }

  if (loading) return <LoadingPulse lines={4} />

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-[26px] text-text tracking-tight">Matches</h1>

      {generating ? (
        <div className="bg-white border border-border rounded-xl shadow-card p-8 text-center">
          <div className="w-10 h-10 rounded-full bg-cream2 flex items-center justify-center mx-auto mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--burg-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
          </div>
          <p className="text-sm text-text3">Finding your match for this week…</p>
        </div>
      ) : currentMatch ? (
        <div className={`bg-white border rounded-2xl shadow-card p-5 transition-all ${freshMatch ? 'border-burg/40 shadow-card-md' : 'border-border'}`}>
          {freshMatch ? (
            <p className="text-[10px] font-medium text-burg uppercase tracking-widest mb-3">✦ Your match this week</p>
          ) : (
            <CardTag label="This week's match" variant="match" />
          )}

          <div className="flex items-start gap-4 mt-3">
            <Avatar userId={currentMatch.other?.id} initials={currentMatch.other?.avatar_initials} avatarUrl={currentMatch.other?.avatar_url} size="lg" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-text text-base">{currentMatch.other?.name}</p>
              {currentMatch.other?.north_star && (
                <p className="text-xs text-text3 italic mt-1 leading-relaxed">{currentMatch.other.north_star}</p>
              )}
              {currentMatch.other_commitment && (
                <div className="mt-2 inline-flex items-start gap-1.5">
                  <span className="text-[10px] text-burg uppercase tracking-wider font-medium mt-0.5 flex-shrink-0">This week:</span>
                  <span className="text-xs text-text2">{currentMatch.other_commitment}</span>
                </div>
              )}
            </div>
          </div>

          {currentMatch.match_reason && (
            <div className="mt-4 bg-cream2 px-4 py-3 rounded-xl" style={{ borderLeft: '2px solid var(--burg-muted)' }}>
              <p className="text-[10px] font-medium text-burg uppercase tracking-widest mb-1">Why you're matched</p>
              <p className="text-sm text-text2 leading-relaxed">{currentMatch.match_reason}</p>
            </div>
          )}
        </div>
      ) : noPool ? (
        <div className="bg-white border border-border rounded-xl shadow-card p-8 text-center">
          <p className="text-sm font-medium text-text mb-1">No match available</p>
          <p className="text-xs text-text3 max-w-xs mx-auto">Join a group with other members to get weekly matches.</p>
        </div>
      ) : (
        <div className="bg-white border border-border rounded-xl shadow-card p-8 text-center">
          <p className="text-sm font-medium text-text mb-1">No match yet this week</p>
          <p className="text-xs text-text3 max-w-xs mx-auto mb-4">Something went wrong generating your match.</p>
          <button
            onClick={generateMatch}
            className="px-4 py-2 bg-burg text-cream text-sm font-medium rounded-[10px] hover:bg-burg-light transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <h2 className="font-serif text-lg text-text mb-3">Previous matches</h2>
          <div className="space-y-3">
            {history.map(m => (
              <div key={m.id} className="bg-white border border-border rounded-xl shadow-card px-5 py-4 flex items-center gap-4">
                <Avatar userId={m.other?.id} initials={m.other?.avatar_initials} avatarUrl={m.other?.avatar_url} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text">{m.other?.name}</p>
                  {m.match_reason && <p className="text-xs text-text3 truncate mt-0.5">{m.match_reason}</p>}
                </div>
                <span className="text-xs text-text3 flex-shrink-0">
                  {new Date(m.week_start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
