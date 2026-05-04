import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getCurrentWeekStartStr } from '../lib/weekUtils'
import Avatar from '../components/ui/Avatar'
import CardTag from '../components/ui/CardTag'
import LoadingPulse from '../components/ui/LoadingPulse'

export default function Matches() {
  const { user } = useAuth()
  const [currentMatch, setCurrentMatch] = useState(null)
  const [history, setHistory] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) fetchAll()
  }, [user])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchMatches(), fetchSuggestions()])
    setLoading(false)
  }

  async function fetchMatches() {
    const weekStart = getCurrentWeekStartStr()
    const { data: matches } = await supabase
      .from('matches')
      .select('*')
      .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`)
      .order('week_start', { ascending: false })

    if (!matches?.length) return

    const enriched = await Promise.all(
      matches.map(async (m) => {
        const otherId = m.user_id_1 === user.id ? m.user_id_2 : m.user_id_1
        const { data: other } = await supabase.from('users').select('*').eq('id', otherId).single()
        const { data: commitment } = await supabase
          .from('commitments')
          .select('commitment_text')
          .eq('user_id', otherId)
          .eq('week_start', m.week_start)
          .single()
        return { ...m, other, other_commitment: commitment?.commitment_text }
      })
    )

    const current = enriched.find(m => m.week_start === weekStart)
    setCurrentMatch(current || null)
    setHistory(enriched.filter(m => m.week_start !== weekStart))
  }

  async function fetchSuggestions() {
    // Find users in groups of my group members (friend of friend)
    const { data: myGroups } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id)

    if (!myGroups?.length) return

    const groupIds = myGroups.map(g => g.group_id)

    const { data: groupmates } = await supabase
      .from('group_members')
      .select('user_id')
      .in('group_id', groupIds)
      .neq('user_id', user.id)

    if (!groupmates?.length) return

    const gmateIds = groupmates.map(g => g.user_id)

    const { data: extendedMembers } = await supabase
      .from('group_members')
      .select('user_id, users(id, name, avatar_initials, north_star)')
      .in('group_id', groupIds)
      .not('user_id', 'in', `(${[user.id, ...gmateIds].join(',')})`)

    const unique = new Map()
    for (const m of extendedMembers || []) {
      if (m.users && !unique.has(m.user_id)) unique.set(m.user_id, m.users)
    }
    setSuggestions([...unique.values()].slice(0, 5))
  }

  if (loading) return <LoadingPulse lines={4} />

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-[26px] text-text tracking-tight">Matches</h1>

      {/* Current match */}
      {currentMatch ? (
        <div className="bg-white border border-border rounded-xl shadow-card p-5">
          <CardTag label="This week's match" variant="match" />
          <div className="flex items-start gap-4 mt-3">
            <Avatar userId={currentMatch.other?.id} initials={currentMatch.other?.avatar_initials} size="lg" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-text">{currentMatch.other?.name}</p>
              {currentMatch.other?.north_star && (
                <p className="text-xs text-text3 italic mt-0.5">{currentMatch.other.north_star}</p>
              )}
              {currentMatch.other_commitment && (
                <p className="text-xs text-text2 mt-1">{currentMatch.other_commitment}</p>
              )}
            </div>
          </div>
          {currentMatch.match_reason && (
            <div className="mt-4 bg-cream px-4 py-3 rounded-xl border border-border" style={{ borderLeft: '2px solid var(--burg-muted)' }}>
              <p className="text-sm text-text2 leading-relaxed">{currentMatch.match_reason}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-border rounded-xl shadow-card p-10 text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--cream2)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--burg-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <p className="text-sm font-medium text-text mb-1">No match yet this week</p>
          <p className="text-xs text-text3 max-w-xs mx-auto">Matches are generated every Monday once all group members have set their commitments.</p>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <h2 className="font-serif text-lg text-text mb-3">Previous matches</h2>
          <div className="space-y-3">
            {history.map(m => (
              <div key={m.id} className="bg-white border border-border rounded-xl shadow-card px-5 py-4 flex items-center gap-4">
                <Avatar userId={m.other?.id} initials={m.other?.avatar_initials} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text">{m.other?.name}</p>
                  <p className="text-xs text-text3 truncate">{m.match_reason}</p>
                </div>
                <span className="text-xs text-text3 flex-shrink-0">{m.week_start}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div>
          <h2 className="font-serif text-lg text-text mb-1">People you might connect with</h2>
          <p className="text-xs text-text3 mb-3">Friends of your group members who share similar goals.</p>
          <div className="space-y-3">
            {suggestions.map(u => (
              <div key={u.id} className="bg-white border border-border rounded-xl shadow-card px-5 py-4 flex items-center gap-4">
                <Avatar userId={u.id} initials={u.avatar_initials} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text">{u.name?.split(' ')[0]}</p>
                  {u.north_star && <p className="text-xs text-text3 italic truncate">{u.north_star}</p>}
                </div>
                <button className="text-xs font-medium text-burg border border-burg rounded-[10px] px-3 py-1.5 hover:bg-burg hover:text-cream transition-colors">
                  Connect
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
